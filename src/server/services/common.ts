import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { toMajor } from "@/lib/money";
import type { DbLike } from "../db";
import { accounts, auditLogs, bankSettings, notifications, users, type Account, type BankSettings } from "../db/schema";

export async function getSettings(db: DbLike): Promise<BankSettings> {
  const [row] = await db.select().from(bankSettings).where(eq(bankSettings.id, "global")).limit(1);
  if (row) return row;
  const [created] = await db.insert(bankSettings).values({ id: "global" }).onConflictDoNothing().returning();
  if (created) return created;
  const [again] = await db.select().from(bankSettings).where(eq(bankSettings.id, "global")).limit(1);
  return again;
}

export const settingsDTO = (s: BankSettings) => ({
  dailyTransferLimit: toMajor(s.dailyTransferLimit),
  maxTransactionAmount: toMajor(s.maxTransactionAmount),
  minAccountBalance: toMajor(s.minAccountBalance),
  transferFee: toMajor(s.transferFee),
  largeTransactionThreshold: toMajor(s.largeTransactionThreshold),
  updatedAt: s.updatedAt,
});

/** Per-account override wins; otherwise bank-wide default. */
export function effectiveLimits(a: Pick<Account, "dailyTransferLimit" | "maxTransactionAmount" | "minBalance">, s: BankSettings) {
  return {
    daily: a.dailyTransferLimit ?? s.dailyTransferLimit,
    single: a.maxTransactionAmount ?? s.maxTransactionAmount,
    minBalance: a.minBalance ?? s.minAccountBalance,
  };
}

export function startOfTodayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

type NotifyInput = { userId: string; type: string; title: string; message: string; link?: string };
export async function notify(db: DbLike, items: NotifyInput | NotifyInput[]) {
  const list = Array.isArray(items) ? items : [items];
  if (list.length) await db.insert(notifications).values(list);
}

export async function notifyAdmins(db: DbLike, input: Omit<NotifyInput, "userId">) {
  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "ADMIN"), eq(users.status, "ACTIVE")));
  await notify(db, admins.map((a) => ({ ...input, userId: a.id })));
}

export async function audit(db: DbLike, actorId: string | null, action: string, entityType: string, entityId?: string | null, metadata: Record<string, unknown> = {}) {
  await db.insert(auditLogs).values({ actorId, action, entityType, entityId: entityId ?? null, metadata });
}

/**
 * Lock account rows for the rest of the surrounding transaction (SELECT ... FOR UPDATE).
 * Ids are sorted so two concurrent transfers A->B and B->A can never deadlock.
 */
export async function lockAccounts(tx: DbLike, ids: string[]): Promise<Map<string, Account>> {
  const unique = Array.from(new Set(ids)).sort();
  const rows = await tx.select().from(accounts).where(inArray(accounts.id, unique)).orderBy(accounts.id).for("update");
  return new Map(rows.map((r) => [r.id, r]));
}

/** Guarded debit: the WHERE clause re-checks the balance in the database, so it can never go below `floor`. */
export async function debit(tx: DbLike, accountId: string, amount: number, floor: number): Promise<number | null> {
  const [row] = await tx
    .update(accounts)
    .set({ balance: sql`${accounts.balance} - ${amount}`, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), gte(accounts.balance, amount + floor)))
    .returning({ balance: accounts.balance });
  return row ? row.balance : null;
}

export async function credit(tx: DbLike, accountId: string, amount: number): Promise<number> {
  const [row] = await tx
    .update(accounts)
    .set({ balance: sql`${accounts.balance} + ${amount}`, updatedAt: new Date() })
    .where(eq(accounts.id, accountId))
    .returning({ balance: accounts.balance });
  return row.balance;
}

export const maskAccount = (n: string) => `${"•".repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`;

export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
