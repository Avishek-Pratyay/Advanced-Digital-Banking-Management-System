import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { toCents, toMajor } from "@/lib/money";
import type { AccountStatus, AccountType } from "@/lib/constants";
import { db } from "../db";
import { accounts, ledgerEntries, transactions, users, type Account } from "../db/schema";
import { badRequest, forbidden, notFound, unprocessable } from "../errors";
import { newAccountNumber } from "../security";
import { audit, effectiveLimits, getSettings, notify, pageMeta } from "./common";
import { insertLedger, insertTransaction, type Actor } from "./transactions";

type Owner = { id: string; name: string; email: string; customerNumber: string | null };

export function accountDTO(a: Account, settings: Awaited<ReturnType<typeof getSettings>>, owner?: Owner | null) {
  const eff = effectiveLimits(a, settings);
  return {
    id: a.id,
    accountNumber: a.accountNumber,
    type: a.type as AccountType,
    nickname: a.nickname,
    currency: a.currency,
    balance: toMajor(a.balance),
    availableBalance: toMajor(Math.max(0, a.balance - eff.minBalance)),
    status: a.status as AccountStatus,
    dailyTransferLimit: a.dailyTransferLimit === null ? null : toMajor(a.dailyTransferLimit),
    maxTransactionAmount: a.maxTransactionAmount === null ? null : toMajor(a.maxTransactionAmount),
    minBalance: a.minBalance === null ? null : toMajor(a.minBalance),
    effectiveLimits: { daily: toMajor(eff.daily), single: toMajor(eff.single), minBalance: toMajor(eff.minBalance) },
    createdAt: a.createdAt,
    owner: owner ?? undefined,
  };
}

export async function listAccounts(actor: Actor, q: { q?: string; status?: AccountStatus; type?: AccountType; userId?: string; page: number; pageSize: number }) {
  const settings = await getSettings(db);
  const conds: SQL[] = [];
  if (actor.role === "CUSTOMER") conds.push(eq(accounts.userId, actor.id));
  else if (q.userId) conds.push(eq(accounts.userId, q.userId));
  if (q.status) conds.push(eq(accounts.status, q.status));
  if (q.type) conds.push(eq(accounts.type, q.type));
  if (q.q && actor.role !== "CUSTOMER") {
    const like = `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(accounts.accountNumber, like), ilike(users.name, like), ilike(users.email, like), ilike(users.customerNumber, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ a: accounts, owner: { id: users.id, name: users.name, email: users.email, customerNumber: users.customerNumber } })
      .from(accounts)
      .innerJoin(users, eq(accounts.userId, users.id))
      .where(where)
      .orderBy(asc(accounts.createdAt), asc(accounts.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(accounts).innerJoin(users, eq(accounts.userId, users.id)).where(where),
  ]);
  return { items: rows.map((r) => accountDTO(r.a, settings, r.owner)), ...pageMeta(q.page, q.pageSize, count) };
}

export async function getAccount(actor: Actor, id: string) {
  const [row] = await db
    .select({ a: accounts, owner: { id: users.id, name: users.name, email: users.email, customerNumber: users.customerNumber } })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(eq(accounts.id, id))
    .limit(1);
  if (!row || (actor.role === "CUSTOMER" && row.a.userId !== actor.id)) throw notFound("Account"); // ownership verification
  return accountDTO(row.a, await getSettings(db), row.owner);
}

export async function createAccount(actor: Actor, input: { userId: string; type: AccountType; nickname?: string; openingDeposit?: number }) {
  if (actor.role === "CUSTOMER") throw forbidden();
  const [owner] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!owner || owner.role !== "CUSTOMER") throw notFound("Customer");
  if (owner.status !== "ACTIVE") throw unprocessable("Accounts can only be opened for active customers.");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(accounts).where(eq(accounts.userId, owner.id));
  if (n >= 5) throw unprocessable("A customer can hold at most 5 accounts.");
  const opening = input.openingDeposit ? toCents(input.openingDeposit) : 0;

  let created: Account | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      created = await db.transaction(async (tx) => {
        const [acc] = await tx.insert(accounts).values({ accountNumber: newAccountNumber(), userId: owner.id, type: input.type, nickname: input.nickname || null, createdById: actor.id, balance: opening }).returning();
        if (opening > 0) {
          const t = await insertTransaction(tx, { type: "DEPOSIT", receiverAccountId: acc.id, amount: opening, description: "Opening deposit", initiatedById: actor.id });
          await insertLedger(tx, t.id, acc.id, "CREDIT", opening, opening);
        }
        await notify(tx, { userId: owner.id, type: "ACCOUNT_OPENED", title: "New account opened", message: `Your ${input.type.toLowerCase()} account ${acc.accountNumber} is ready to use.`, link: "/customer/accounts" });
        await audit(tx, actor.id, "ACCOUNT_CREATED", "account", acc.id, { type: input.type, opening });
        return acc;
      });
    } catch (e) {
      if (attempt === 4 || !String((e as Error).message + String((e as { cause?: Error }).cause?.message)).includes("account_number")) throw e; // retry only on account number collision
    }
  }
  return accountDTO(created!, await getSettings(db), { id: owner.id, name: owner.name, email: owner.email, customerNumber: owner.customerNumber });
}

export async function updateAccount(
  actor: Actor,
  id: string,
  input: { type?: AccountType; nickname?: string | null; status?: AccountStatus; dailyTransferLimit?: number | null; maxTransactionAmount?: number | null; minBalance?: number | null },
) {
  if (actor.role !== "ADMIN") throw forbidden("Only administrators can change account settings.");
  const cents = (v: number | null | undefined) => (v === undefined ? undefined : v === null ? null : toCents(v));
  await db.transaction(async (tx) => {
    const [acc] = await tx.select().from(accounts).where(eq(accounts.id, id)).for("update").limit(1);
    if (!acc) throw notFound("Account");
    if (acc.status === "CLOSED" && input.status && input.status !== "CLOSED") throw unprocessable("A closed account cannot be reopened.");
    if (input.status === "CLOSED" && acc.balance > 0) throw unprocessable("Withdraw or transfer the remaining balance before closing the account.");
    const patch: Partial<typeof accounts.$inferInsert> = { updatedAt: new Date() };
    if (input.type) patch.type = input.type;
    if (input.nickname !== undefined) patch.nickname = input.nickname || null;
    if (input.status) patch.status = input.status;
    const d = cents(input.dailyTransferLimit), m = cents(input.maxTransactionAmount), b = cents(input.minBalance);
    if (d !== undefined) patch.dailyTransferLimit = d;
    if (m !== undefined) patch.maxTransactionAmount = m;
    if (b !== undefined) patch.minBalance = b;
    if (d && m && m > d) throw badRequest("Single transaction limit cannot exceed the daily limit.");
    await tx.update(accounts).set(patch).where(eq(accounts.id, id));
    if (input.status && input.status !== acc.status) {
      const verb = input.status === "FROZEN" ? "frozen" : input.status === "CLOSED" ? "closed" : "reactivated";
      await notify(tx, { userId: acc.userId, type: "ACCOUNT_STATUS", title: `Account ${verb}`, message: `Your account ${acc.accountNumber} has been ${verb}.${input.status === "FROZEN" ? " Please contact the bank for assistance." : ""}`, link: "/customer/accounts" });
      await audit(tx, actor.id, `ACCOUNT_${input.status === "ACTIVE" ? "UNFROZEN" : input.status}`, "account", id, { from: acc.status });
    }
    await audit(tx, actor.id, "ACCOUNT_UPDATED", "account", id, input as Record<string, unknown>);
  });
  return getAccount(actor, id);
}

/** Recipient validation for the transfer form. Reveals only a masked owner name. */
export async function lookupAccount(actor: Actor, accountNumber: string) {
  const [row] = await db
    .select({ id: accounts.id, number: accounts.accountNumber, type: accounts.type, status: accounts.status, userId: accounts.userId, owner: users.name, ownerStatus: users.status })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(eq(accounts.accountNumber, accountNumber))
    .limit(1);
  if (!row) throw notFound("Recipient account");
  const [first, ...rest] = row.owner.split(" ");
  const maskedName = rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
  return {
    accountNumber: row.number,
    ownerName: row.userId === actor.id ? row.owner : maskedName,
    type: row.type,
    own: row.userId === actor.id,
    canReceive: row.status === "ACTIVE" && row.ownerStatus === "ACTIVE",
  };
}

/** Account statement built from the immutable ledger. */
export async function getStatement(actor: Actor, accountId: string, range: { from?: string; to?: string }) {
  const account = await getAccount(actor, accountId); // enforces ownership
  const from = range.from ? new Date(`${range.from}T00:00:00.000Z`) : new Date(Date.now() - 30 * 86_400_000);
  const to = range.to ? new Date(new Date(`${range.to}T00:00:00.000Z`).getTime() + 86_400_000) : new Date(Date.now() + 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw badRequest("Invalid date range");
  if (from >= to) throw badRequest("'From' date must be before 'To' date");

  const rows = await db
    .select({ at: ledgerEntries.createdAt, direction: ledgerEntries.direction, amount: ledgerEntries.amount, balanceAfter: ledgerEntries.balanceAfter, txnId: transactions.txnId, type: transactions.type, status: transactions.status, description: transactions.description })
    .from(ledgerEntries)
    .innerJoin(transactions, eq(ledgerEntries.transactionId, transactions.id))
    .where(and(eq(ledgerEntries.accountId, accountId), sql`${ledgerEntries.createdAt} >= ${from}`, sql`${ledgerEntries.createdAt} < ${to}`))
    .orderBy(asc(ledgerEntries.createdAt), asc(ledgerEntries.id));
  // opening balance = balance after the last ledger entry before the period (0 if the account did not exist yet)
  const [before] = await db
    .select({ balanceAfter: ledgerEntries.balanceAfter })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.accountId, accountId), sql`${ledgerEntries.createdAt} < ${from}`))
    .orderBy(sql`${ledgerEntries.createdAt} desc`, sql`${ledgerEntries.id} desc`)
    .limit(1);
  const openingBalance = before ? before.balanceAfter : 0;
  const credits = rows.filter((r) => r.direction === "CREDIT").reduce((a, r) => a + r.amount, 0);
  const debits = rows.filter((r) => r.direction === "DEBIT").reduce((a, r) => a + r.amount, 0);
  return {
    account: { accountNumber: account.accountNumber, type: account.type, owner: account.owner?.name ?? "", currency: account.currency },
    period: { from: from.toISOString().slice(0, 10), to: new Date(to.getTime() - 1).toISOString().slice(0, 10) },
    openingBalance: toMajor(openingBalance),
    closingBalance: toMajor(rows.length ? rows[rows.length - 1].balanceAfter : openingBalance),
    totalCredits: toMajor(credits),
    totalDebits: toMajor(debits),
    entries: rows.map((r) => ({ date: r.at, txnId: r.txnId, type: r.type, description: r.description ?? "", debit: r.direction === "DEBIT" ? toMajor(r.amount) : 0, credit: r.direction === "CREDIT" ? toMajor(r.amount) : 0, balance: toMajor(r.balanceAfter) })),
  };
}

