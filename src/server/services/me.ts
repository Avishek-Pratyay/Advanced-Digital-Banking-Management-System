import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { SettingsInput } from "@/lib/validators";
import { toCents } from "@/lib/money";
import { db } from "../db";
import { accounts, auditLogs, notifications, users } from "../db/schema";
import { badRequest, forbidden, notFound, unprocessable } from "../errors";
import { hashSecret, newTotpSecret, qrDataUrl, totpUri, verifySecret, verifyTotp } from "../security";
import { audit, getSettings, pageMeta, settingsDTO } from "./common";
import type { Actor } from "./transactions";
import { bankSettings } from "../db/schema";

export async function getMe(actor: Actor) {
  const [u] = await db.select().from(users).where(eq(users.id, actor.id)).limit(1);
  if (!u) throw notFound("User");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(accounts).where(eq(accounts.userId, u.id));
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, customerNumber: u.customerNumber, phone: u.phone, address: u.address,
    verified: u.verified, twoFactorEnabled: u.twoFactorEnabled, hasPin: !!u.pinHash, accountCount: n, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
  };
}

export async function changePin(actor: Actor, input: { currentPin: string; newPin: string }) {
  const [u] = await db.select().from(users).where(eq(users.id, actor.id)).limit(1);
  if (!u.pinHash || !(await verifySecret(input.currentPin, u.pinHash))) throw unprocessable("Current PIN is incorrect.", "INVALID_PIN");
  if (input.currentPin === input.newPin) throw badRequest("Choose a PIN different from your current one.");
  if (/^(\d)\1+$/.test(input.newPin) || "0123456789".includes(input.newPin) || "9876543210".includes(input.newPin)) throw badRequest("Choose a PIN that is not a repeated or sequential number.");
  await db.update(users).set({ pinHash: await hashSecret(input.newPin), pinFailedAttempts: 0, pinLockedUntil: null, updatedAt: new Date() }).where(eq(users.id, actor.id));
  await audit(db, actor.id, "PIN_CHANGED", "user", actor.id);
  return { ok: true };
}

export async function changePassword(actor: Actor, input: { currentPassword: string; newPassword: string }) {
  const [u] = await db.select().from(users).where(eq(users.id, actor.id)).limit(1);
  if (!(await verifySecret(input.currentPassword, u.passwordHash))) throw unprocessable("Current password is incorrect.", "INVALID_PASSWORD");
  await db.update(users).set({ passwordHash: await hashSecret(input.newPassword), updatedAt: new Date() }).where(eq(users.id, actor.id));
  await audit(db, actor.id, "PASSWORD_CHANGED", "user", actor.id);
  return { ok: true };
}

/** TOTP two-factor: setup returns a QR code, enable confirms a code, disable needs the password. */
export async function twoFactor(actor: Actor, input: { action: "setup" | "enable" | "disable"; code?: string; password?: string }) {
  const [u] = await db.select().from(users).where(eq(users.id, actor.id)).limit(1);
  if (input.action === "setup") {
    if (u.twoFactorEnabled) throw unprocessable("Two-factor authentication is already enabled.");
    const secret = newTotpSecret();
    await db.update(users).set({ twoFactorSecret: secret }).where(eq(users.id, actor.id));
    const uri = totpUri(u.email, secret);
    return { secret, uri, qr: await qrDataUrl(uri) };
  }
  if (input.action === "enable") {
    if (!u.twoFactorSecret) throw unprocessable("Start the setup first.");
    if (!input.code || !verifyTotp(input.code, u.twoFactorSecret)) throw unprocessable("That code is not valid. Check your authenticator app and try again.", "TWO_FACTOR_INVALID");
    await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, actor.id));
    await audit(db, actor.id, "2FA_ENABLED", "user", actor.id);
    return { enabled: true };
  }
  if (!input.password || !(await verifySecret(input.password, u.passwordHash))) throw unprocessable("Password is incorrect.", "INVALID_PASSWORD");
  await db.update(users).set({ twoFactorEnabled: false, twoFactorSecret: null }).where(eq(users.id, actor.id));
  await audit(db, actor.id, "2FA_DISABLED", "user", actor.id);
  return { enabled: false };
}

/* ------------------------------------------------------------ notifications */
export async function listNotifications(actor: Actor, q: { unread?: boolean; page: number; pageSize: number }) {
  const where = and(eq(notifications.userId, actor.id), q.unread ? eq(notifications.read, false) : undefined);
  const [items, [{ total }], [{ unread }]] = await Promise.all([
    db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(notifications).where(where),
    db.select({ unread: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, actor.id), eq(notifications.read, false))),
  ]);
  return { items, unread, ...pageMeta(q.page, q.pageSize, total) };
}

export async function markNotifications(actor: Actor, input: { ids?: string[]; all?: boolean }) {
  const cond = input.all ? eq(notifications.userId, actor.id) : and(eq(notifications.userId, actor.id), inArray(notifications.id, input.ids?.length ? input.ids : ["00000000-0000-0000-0000-000000000000"]));
  await db.update(notifications).set({ read: true }).where(cond);
  return { ok: true };
}

/* ------------------------------------------------------------------ settings */
export async function readSettings() {
  return settingsDTO(await getSettings(db));
}

export async function updateSettings(actor: Actor, input: SettingsInput) {
  if (actor.role !== "ADMIN") throw forbidden("Only administrators can change bank-wide settings.");
  if (input.maxTransactionAmount > input.dailyTransferLimit) throw badRequest("The single transaction limit cannot be higher than the daily transfer limit.");
  await getSettings(db);
  await db
    .update(bankSettings)
    .set({
      dailyTransferLimit: toCents(input.dailyTransferLimit), maxTransactionAmount: toCents(input.maxTransactionAmount), minAccountBalance: toCents(input.minAccountBalance),
      transferFee: toCents(input.transferFee), largeTransactionThreshold: toCents(input.largeTransactionThreshold), updatedById: actor.id, updatedAt: new Date(),
    })
    .where(eq(bankSettings.id, "global"));
  await audit(db, actor.id, "SETTINGS_UPDATED", "bank_settings", "global", input as unknown as Record<string, unknown>);
  return readSettings();
}

export async function listAudit(q: { page: number; pageSize: number }) {
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actor: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs),
  ]);
  return { items: rows, ...pageMeta(q.page, q.pageSize, count) };
}

