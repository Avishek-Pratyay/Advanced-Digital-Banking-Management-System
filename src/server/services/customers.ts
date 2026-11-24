import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { toCents, toMajor } from "@/lib/money";
import type { Role, UserStatus } from "@/lib/constants";
import type { CreateCustomerInput } from "@/lib/validators";
import { db } from "../db";
import { accounts, loans, transactions, users, type User } from "../db/schema";
import { conflict, forbidden, notFound, unprocessable } from "../errors";
import { generatePassword, generatePin, hashSecret, newAccountNumber, newCustomerNumber } from "../security";
import { audit, getSettings, notify, pageMeta } from "./common";
import { accountDTO } from "./accounts";
import { insertLedger, insertTransaction, type Actor } from "./transactions";

export const customerDTO = (u: User) => ({
  id: u.id,
  customerNumber: u.customerNumber,
  name: u.name,
  email: u.email,
  phone: u.phone,
  address: u.address,
  dateOfBirth: u.dateOfBirth,
  nationalId: u.nationalId ? `${"•".repeat(Math.max(0, u.nationalId.length - 3))}${u.nationalId.slice(-3)}` : null,
  status: u.status as UserStatus,
  statusReason: u.statusReason,
  verified: u.verified,
  verifiedAt: u.verifiedAt,
  twoFactorEnabled: u.twoFactorEnabled,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});

export async function listCustomers(q: { q?: string; status?: UserStatus; verified?: "true" | "false"; page: number; pageSize: number }) {
  const conds: SQL[] = [eq(users.role, "CUSTOMER")];
  if (q.status) conds.push(eq(users.status, q.status));
  if (q.verified) conds.push(eq(users.verified, q.verified === "true"));
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(users.name, like), ilike(users.email, like), ilike(users.customerNumber, like), ilike(users.phone, like), sql`exists (select 1 from ${accounts} a where a.user_id = ${users.id} and a.account_number ilike ${like})`)!);
  }
  const where = and(...conds);
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        u: users,
        accountsCount: sql<number>`(select count(*)::int from ${accounts} a where a.user_id = ${users.id})`,
        totalBalance: sql<number>`(select coalesce(sum(a.balance), 0)::bigint from ${accounts} a where a.user_id = ${users.id})`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return { items: rows.map((r) => ({ ...customerDTO(r.u), accountsCount: Number(r.accountsCount), totalBalance: toMajor(Number(r.totalBalance)) })), ...pageMeta(q.page, q.pageSize, count) };
}

export async function getCustomer(id: string) {
  const [u] = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, "CUSTOMER"))).limit(1);
  if (!u) throw notFound("Customer");
  const settings = await getSettings(db);
  const accs = await db.select().from(accounts).where(eq(accounts.userId, id)).orderBy(accounts.createdAt);
  const ids = accs.map((a) => a.id);
  const [stats] = ids.length
    ? await db
        .select({
          deposits: sql<number>`coalesce(sum(case when ${transactions.type} = 'DEPOSIT' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} end), 0)::bigint`,
          withdrawals: sql<number>`coalesce(sum(case when ${transactions.type} = 'WITHDRAWAL' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} end), 0)::bigint`,
          count: sql<number>`count(*)::int`,
        })
        .from(transactions)
        .where(sql`(${transactions.senderAccountId} in ${ids} or ${transactions.receiverAccountId} in ${ids})`)
    : [{ deposits: 0, withdrawals: 0, count: 0 }];
  const customerLoans = await db.select({ id: loans.id, loanNumber: loans.loanNumber, type: loans.type, status: loans.status, requestedAmount: loans.requestedAmount, approvedAmount: loans.approvedAmount, createdAt: loans.createdAt }).from(loans).where(eq(loans.userId, id)).orderBy(desc(loans.createdAt));
  return {
    ...customerDTO(u),
    accounts: accs.map((a) => accountDTO(a, settings)),
    stats: { totalBalance: toMajor(accs.reduce((s, a) => s + a.balance, 0)), totalDeposits: toMajor(Number(stats.deposits)), totalWithdrawals: toMajor(Number(stats.withdrawals)), transactionCount: stats.count },
    loans: customerLoans.map((l) => ({ ...l, requestedAmount: toMajor(l.requestedAmount), approvedAmount: l.approvedAmount === null ? null : toMajor(l.approvedAmount) })),
  };
}

/** Staff/admin onboarding. Returns generated credentials ONCE (they are only stored hashed). */
export async function createCustomer(actor: Actor, input: CreateCustomerInput) {
  if (actor.role === "CUSTOMER") throw forbidden();
  const email = input.email.toLowerCase();
  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (dup) throw conflict("A user with this email already exists.", "EMAIL_TAKEN");
  const password = input.password ?? generatePassword();
  const pin = input.pin ?? generatePin();
  const [passwordHash, pinHash] = await Promise.all([hashSecret(password), hashSecret(pin)]);
  const opening = input.openingDeposit ? toCents(input.openingDeposit) : 0;

  const result = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ customerNumber: newCustomerNumber(), name: input.name, email, passwordHash, pinHash, role: "CUSTOMER", phone: input.phone, address: input.address, dateOfBirth: input.dateOfBirth, nationalId: input.nationalId, createdById: actor.id })
      .returning();
    let account = null;
    if (input.accountType) {
      const [acc] = await tx.insert(accounts).values({ accountNumber: newAccountNumber(), userId: u.id, type: input.accountType, createdById: actor.id, balance: opening }).returning();
      if (opening > 0) {
        const t = await insertTransaction(tx, { type: "DEPOSIT", receiverAccountId: acc.id, amount: opening, description: "Opening deposit", initiatedById: actor.id });
        await insertLedger(tx, t.id, acc.id, "CREDIT", opening, opening);
      }
      account = acc;
    }
    await notify(tx, { userId: u.id, type: "WELCOME", title: "Welcome to Vaultline", message: "Your profile has been created. Please change your temporary password and PIN in Settings.", link: "/customer/settings" });
    await audit(tx, actor.id, "CUSTOMER_REGISTERED", "user", u.id, { email });
    return { u, account };
  });
  const settings = await getSettings(db);
  return {
    customer: customerDTO(result.u),
    account: result.account ? accountDTO(result.account, settings) : null,
    // shown exactly once - the server only keeps hashes
    temporaryCredentials: { email, password: input.password ? undefined : password, pin: input.pin ? undefined : pin },
  };
}

export async function updateCustomerInfo(actor: Actor, id: string, patch: { name?: string; phone?: string; address?: string }) {
  if (actor.role === "CUSTOMER") throw forbidden();
  const [u] = await db.update(users).set({ ...patch, updatedAt: new Date() }).where(and(eq(users.id, id), eq(users.role, "CUSTOMER"))).returning();
  if (!u) throw notFound("Customer");
  await audit(db, actor.id, "CUSTOMER_UPDATED", "user", id, patch);
  return getCustomer(id);
}

export async function setCustomerStatus(actor: Actor, id: string, status: UserStatus, reason?: string) {
  if (actor.role !== "ADMIN") throw forbidden("Only administrators can activate, deactivate or block customers.");
  const [u] = await db.update(users).set({ status, statusReason: status === "ACTIVE" ? null : reason || null, updatedAt: new Date() }).where(and(eq(users.id, id), eq(users.role, "CUSTOMER"))).returning();
  if (!u) throw notFound("Customer");
  await audit(db, actor.id, `CUSTOMER_${status}`, "user", id, { reason });
  return getCustomer(id);
}

export async function setCustomerVerified(actor: Actor, id: string, verified: boolean) {
  if (actor.role === "CUSTOMER") throw forbidden();
  const [u] = await db
    .update(users)
    .set({ verified, verifiedAt: verified ? new Date() : null, verifiedById: verified ? actor.id : null, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.role, "CUSTOMER")))
    .returning();
  if (!u) throw notFound("Customer");
  if (verified) await notify(db, { userId: id, type: "KYC_VERIFIED", title: "Identity verified", message: "Your customer information has been verified. You can now apply for loans.", link: "/customer/loans" });
  await audit(db, actor.id, verified ? "CUSTOMER_VERIFIED" : "CUSTOMER_UNVERIFIED", "user", id);
  return getCustomer(id);
}

/* ----------------------------------------------------------- staff admin */
export async function listStaff() {
  const rows = await db.select().from(users).where(or(eq(users.role, "STAFF"), eq(users.role, "ADMIN"))).orderBy(users.role, users.name);
  return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role as Role, status: u.status as UserStatus, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt }));
}

export async function createStaff(actor: Actor, input: { name: string; email: string; password: string }) {
  if (actor.role !== "ADMIN") throw forbidden();
  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (dup) throw conflict("A user with this email already exists.", "EMAIL_TAKEN");
  const [u] = await db.insert(users).values({ name: input.name, email: input.email, passwordHash: await hashSecret(input.password), role: "STAFF", createdById: actor.id }).returning();
  await audit(db, actor.id, "STAFF_CREATED", "user", u.id, { email: input.email });
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function setStaffStatus(actor: Actor, id: string, status: UserStatus) {
  if (actor.role !== "ADMIN") throw forbidden();
  if (id === actor.id) throw unprocessable("You cannot change your own status.");
  const [u] = await db.update(users).set({ status, updatedAt: new Date() }).where(and(eq(users.id, id), eq(users.role, "STAFF"))).returning();
  if (!u) throw notFound("Staff member");
  await audit(db, actor.id, `STAFF_${status}`, "user", id);
  return { ok: true };
}
