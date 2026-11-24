import { and, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { toCents, toMajor, formatMoney } from "@/lib/money";
import type { Role, TxnStatus, TxnType } from "@/lib/constants";
import type { TransferInput } from "@/lib/validators";
import { db, type DbLike } from "../db";
import { accounts, ledgerEntries, transactionFlags, transactions, users, type Account, type BankSettings, type Transaction } from "../db/schema";
import { AppError, badRequest, conflict, forbidden, notFound, tooMany, unprocessable } from "../errors";
import { newTxnId, receiptReference, verifySecret, verifyTotp } from "../security";
import { audit, credit, debit, effectiveLimits, getSettings, lockAccounts, notify, notifyAdmins, pageMeta, startOfTodayUtc } from "./common";

export type Actor = { id: string; role: Role; name: string };

const s = alias(accounts, "s");
const r = alias(accounts, "r");
const su = alias(users, "su");
const ru = alias(users, "ru");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const selection = {
  t: transactions,
  sId: s.id, sNumber: s.accountNumber, sType: s.type, sOwnerId: s.userId, sOwner: su.name,
  rId: r.id, rNumber: r.accountNumber, rType: r.type, rOwnerId: r.userId, rOwner: ru.name,
  flagged: sql<boolean>`exists (select 1 from ${transactionFlags} f where f.transaction_id = ${transactions.id} and f.status = 'OPEN')`,
};

type Row = {
  t: Transaction;
  sId: string | null; sNumber: string | null; sType: string | null; sOwnerId: string | null; sOwner: string | null;
  rId: string | null; rNumber: string | null; rType: string | null; rOwnerId: string | null; rOwner: string | null;
  flagged: boolean;
};

export type TxnDTO = ReturnType<typeof mapRow>;

function mapRow(row: Row, viewer: { role: Role; accountIds: Set<string>; focusAccountId?: string }) {
  const { t } = row;
  const staff = viewer.role !== "CUSTOMER";
  const senderMine = !!row.sId && viewer.accountIds.has(row.sId);
  const receiverMine = !!row.rId && viewer.accountIds.has(row.rId);
  let direction: "IN" | "OUT" | "INTERNAL" | null = null;
  if (!staff || viewer.accountIds.size) {
    if (senderMine && receiverMine) direction = viewer.focusAccountId ? (row.sId === viewer.focusAccountId ? "OUT" : "IN") : "INTERNAL";
    else if (senderMine) direction = "OUT";
    else if (receiverMine) direction = "IN";
  }
  return {
    id: t.id,
    txnId: t.txnId,
    type: t.type as TxnType,
    status: t.status as TxnStatus,
    amount: toMajor(t.amount),
    fee: toMajor(t.fee),
    total: toMajor(t.amount + t.fee),
    description: t.description,
    failureReason: t.failureReason,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
    reversalOfId: t.reversalOfId,
    sender: row.sId ? { id: row.sId, accountNumber: row.sNumber!, type: row.sType!, ownerName: row.sOwner!, ownerId: staff ? row.sOwnerId : undefined } : null,
    receiver: row.rId ? { id: row.rId, accountNumber: row.rNumber!, type: row.rType!, ownerName: row.rOwner!, ownerId: staff ? row.rOwnerId : undefined } : null,
    direction,
    flagged: staff ? !!row.flagged : undefined,
  };
}

/* ------------------------------------------------------------------ queries */

export async function listTransactions(
  actor: Actor,
  q: { q?: string; type?: TxnType; status?: TxnStatus; from?: string; to?: string; accountId?: string; userId?: string; flagged?: "true" | "false"; page: number; pageSize: number },
) {
  const conds: SQL[] = [];
  let myIds = new Set<string>();

  if (actor.role === "CUSTOMER") {
    const mine = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, actor.id));
    myIds = new Set(mine.map((m) => m.id));
    if (!myIds.size) return { items: [], ...pageMeta(q.page, q.pageSize, 0) };
    if (q.accountId && !myIds.has(q.accountId)) throw notFound("Account");
    const scope = q.accountId ? [q.accountId] : [...myIds];
    // own debits always visible; incoming only once completed (never leak somebody else's failed attempt)
    conds.push(
      or(
        inArray(transactions.senderAccountId, scope),
        and(inArray(transactions.receiverAccountId, scope), or(sql`${transactions.senderAccountId} is null`, inArray(transactions.status, ["COMPLETED", "REVERSED"])))!,
      )!,
    );
  } else {
    if (q.accountId) conds.push(or(eq(transactions.senderAccountId, q.accountId), eq(transactions.receiverAccountId, q.accountId))!);
    if (q.userId) conds.push(or(eq(s.userId, q.userId), eq(r.userId, q.userId))!);
    if (q.flagged === "true") conds.push(sql`exists (select 1 from ${transactionFlags} f where f.transaction_id = ${transactions.id} and f.status = 'OPEN')`);
  }

  if (q.type) conds.push(eq(transactions.type, q.type));
  if (q.status) conds.push(eq(transactions.status, q.status));
  const day = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest("Dates must use the YYYY-MM-DD format");
    return new Date(`${v}T00:00:00.000Z`);
  };
  if (q.from) conds.push(gte(transactions.createdAt, day(q.from)));
  if (q.to) conds.push(lt(transactions.createdAt, new Date(day(q.to).getTime() + 86_400_000)));
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const searchable = [ilike(transactions.txnId, like), ilike(transactions.description, like)];
    if (actor.role !== "CUSTOMER") searchable.push(ilike(s.accountNumber, like), ilike(r.accountNumber, like), ilike(su.name, like), ilike(ru.name, like));
    conds.push(or(...searchable)!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const base = () =>
    db.select(selection).from(transactions).leftJoin(s, eq(transactions.senderAccountId, s.id)).leftJoin(r, eq(transactions.receiverAccountId, r.id)).leftJoin(su, eq(s.userId, su.id)).leftJoin(ru, eq(r.userId, ru.id));

  const [rows, [{ count }]] = await Promise.all([
    base().where(where).orderBy(desc(transactions.createdAt), desc(transactions.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .leftJoin(s, eq(transactions.senderAccountId, s.id))
      .leftJoin(r, eq(transactions.receiverAccountId, r.id))
      .leftJoin(su, eq(s.userId, su.id))
      .leftJoin(ru, eq(r.userId, ru.id))
      .where(where),
  ]);
  const viewer = { role: actor.role, accountIds: myIds, focusAccountId: q.accountId };
  return { items: rows.map((row) => mapRow(row as Row, viewer)), ...pageMeta(q.page, q.pageSize, count) };
}

export async function getTransaction(actor: Actor, idOrTxnId: string) {
  const rows = await db
    .select(selection)
    .from(transactions)
    .leftJoin(s, eq(transactions.senderAccountId, s.id))
    .leftJoin(r, eq(transactions.receiverAccountId, r.id))
    .leftJoin(su, eq(s.userId, su.id))
    .leftJoin(ru, eq(r.userId, ru.id))
    .where(UUID.test(idOrTxnId) ? eq(transactions.id, idOrTxnId) : eq(transactions.txnId, idOrTxnId))
    .limit(1);
  const row = rows[0] as Row | undefined;
  if (!row) throw notFound("Transaction");

  let myIds = new Set<string>();
  if (actor.role === "CUSTOMER") {
    const mine = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, actor.id));
    myIds = new Set(mine.map((m) => m.id));
    const senderMine = !!row.sId && myIds.has(row.sId);
    const receiverMine = !!row.rId && myIds.has(row.rId);
    const visibleAsReceiver = receiverMine && (!row.sId || row.t.status === "COMPLETED" || row.t.status === "REVERSED");
    // 404 (not 403) so customers cannot probe which transaction ids exist
    if (!senderMine && !visibleAsReceiver) throw notFound("Transaction");
  }

  const ledger = await db
    .select({ id: ledgerEntries.id, accountId: ledgerEntries.accountId, accountNumber: accounts.accountNumber, direction: ledgerEntries.direction, amount: ledgerEntries.amount, balanceAfter: ledgerEntries.balanceAfter, createdAt: ledgerEntries.createdAt })
    .from(ledgerEntries)
    .innerJoin(accounts, eq(ledgerEntries.accountId, accounts.id))
    .where(eq(ledgerEntries.transactionId, row.t.id));

  const staff = actor.role !== "CUSTOMER";
  const visibleLedger = ledger.filter((l) => staff || myIds.has(l.accountId));
  const dto = mapRow(row, { role: actor.role, accountIds: myIds });
  const flags = staff
    ? await db
        .select({ id: transactionFlags.id, source: transactionFlags.source, reason: transactionFlags.reason, status: transactionFlags.status, createdAt: transactionFlags.createdAt, resolutionNote: transactionFlags.resolutionNote })
        .from(transactionFlags)
        .where(eq(transactionFlags.transactionId, row.t.id))
        .orderBy(desc(transactionFlags.createdAt))
    : [];
  return {
    ...dto,
    reference: receiptReference(row.t.txnId, row.t.amount, row.t.createdAt),
    ledger: visibleLedger.map((l) => ({ ...l, amount: toMajor(l.amount), balanceAfter: toMajor(l.balanceAfter) })),
    flags,
  };
}

/* --------------------------------------------------- PIN / second factor */

const PIN_MAX_ATTEMPTS = 3;
const PIN_LOCK_MINUTES = 15;

export async function verifyPin(userId: string, pin: string) {
  const [u] = await db.select({ pinHash: users.pinHash, lockedUntil: users.pinLockedUntil }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.pinHash) throw unprocessable("No transaction PIN is set for your account. Please set one in Settings.", "PIN_NOT_SET");
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    const mins = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60_000);
    throw tooMany(`Transaction PIN is locked after too many wrong attempts. Try again in ${mins} minute(s).`);
  }
  if (await verifySecret(pin, u.pinHash)) {
    await db.update(users).set({ pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(users.id, userId));
    return;
  }
  // atomic increment so parallel guesses cannot dodge the counter
  const [row] = await db.update(users).set({ pinFailedAttempts: sql`${users.pinFailedAttempts} + 1` }).where(eq(users.id, userId)).returning({ n: users.pinFailedAttempts });
  if (row.n >= PIN_MAX_ATTEMPTS) {
    await db.update(users).set({ pinFailedAttempts: 0, pinLockedUntil: new Date(Date.now() + PIN_LOCK_MINUTES * 60_000) }).where(eq(users.id, userId));
    throw tooMany(`Too many wrong PIN attempts. Transactions are locked for ${PIN_LOCK_MINUTES} minutes.`);
  }
  throw unprocessable(`Invalid transaction PIN. ${PIN_MAX_ATTEMPTS - row.n} attempt(s) left.`, "INVALID_PIN");
}

export async function requireSecondFactor(userId: string, code?: string) {
  const [u] = await db.select({ enabled: users.twoFactorEnabled, secret: users.twoFactorSecret }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.enabled || !u.secret) return;
  if (!code) throw new AppError(422, "TWO_FACTOR_REQUIRED", "Enter the 6-digit code from your authenticator app to confirm this operation.");
  if (!verifyTotp(code, u.secret)) throw new AppError(422, "TWO_FACTOR_INVALID", "The authenticator code is incorrect or expired.");
}

/* ------------------------------------------------------- posting primitives */

type Posting = {
  type: TxnType;
  status?: TxnStatus;
  senderAccountId?: string | null;
  receiverAccountId?: string | null;
  amount: number;
  fee?: number;
  description?: string | null;
  idempotencyKey?: string | null;
  initiatedById: string;
  reversalOfId?: string | null;
  failureReason?: string | null;
};

export async function insertTransaction(tx: DbLike, p: Posting): Promise<Transaction> {
  const status = p.status ?? "COMPLETED";
  const [row] = await tx
    .insert(transactions)
    .values({
      txnId: newTxnId(),
      type: p.type,
      status,
      senderAccountId: p.senderAccountId ?? null,
      receiverAccountId: p.receiverAccountId ?? null,
      amount: p.amount,
      fee: p.fee ?? 0,
      description: p.description || null,
      idempotencyKey: p.idempotencyKey ?? null,
      initiatedById: p.initiatedById,
      reversalOfId: p.reversalOfId ?? null,
      failureReason: p.failureReason ?? null,
      completedAt: status === "COMPLETED" ? new Date() : null,
    })
    .returning();
  return row;
}

export async function insertLedger(tx: DbLike, transactionId: string, accountId: string, direction: "DEBIT" | "CREDIT", amount: number, balanceAfter: number) {
  await tx.insert(ledgerEntries).values({ transactionId, accountId, direction, amount, balanceAfter });
}

/* ---------------------------------------------------- suspicious activity */

/** Simple rule-based detector. Runs INSIDE the posting transaction so flags and money always commit together. */
export async function evaluateSuspicion(
  tx: DbLike,
  t: Transaction,
  ctx: { settings: BankSettings; sender?: Account | null; senderBalanceBefore?: number; singleLimit?: number },
) {
  const reasons: string[] = [];
  if (t.amount >= ctx.settings.largeTransactionThreshold) reasons.push(`Large transaction (≥ ${formatMoney(toMajor(ctx.settings.largeTransactionThreshold))})`);

  if (ctx.sender && (t.type === "TRANSFER" || t.type === "WITHDRAWAL")) {
    const since = new Date(Date.now() - 10 * 60_000);
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(transactions)
      .where(and(eq(transactions.senderAccountId, ctx.sender.id), inArray(transactions.type, ["TRANSFER", "WITHDRAWAL"]), eq(transactions.status, "COMPLETED"), gte(transactions.createdAt, since)));
    if (n >= 5) reasons.push(`High velocity: ${n} outgoing transactions within 10 minutes`);

    if (t.type === "TRANSFER" && t.receiverAccountId && ctx.senderBalanceBefore !== undefined) {
      const [{ prior }] = await tx
        .select({ prior: sql<number>`count(*)::int` })
        .from(transactions)
        .where(and(eq(transactions.senderAccountId, ctx.sender.id), eq(transactions.receiverAccountId, t.receiverAccountId), eq(transactions.status, "COMPLETED"), sql`${transactions.id} <> ${t.id}`));
      if (prior === 0 && t.amount >= 50_000 && t.amount * 2 >= ctx.senderBalanceBefore)
        reasons.push("Large share (≥ 50%) of the balance sent to a first-time recipient");
    }
    if (ctx.singleLimit && t.amount >= ctx.singleLimit * 0.9 && t.amount <= ctx.singleLimit) reasons.push("Amount sits just below the single-transaction limit");
  }

  let created = 0;
  for (const reason of reasons) {
    const inserted = await tx.insert(transactionFlags).values({ transactionId: t.id, source: "SYSTEM", reason }).onConflictDoNothing().returning({ id: transactionFlags.id });
    created += inserted.length;
  }
  if (created) {
    await notifyAdmins(tx, { type: "SUSPICIOUS_ACTIVITY", title: "Suspicious transaction flagged", message: `${t.txnId} for ${formatMoney(toMajor(t.amount))} triggered ${created} automatic rule(s).`, link: "/admin/flags" });
  }
  return reasons;
}

/* --------------------------------------------------------- fund transfer */

type TransferResult = { transaction: Awaited<ReturnType<typeof getTransaction>>; duplicate: boolean };

/**
 * Customer fund transfer.
 *
 * Consistency guarantees
 *  1. ownership of the source account is verified against the session user (never trusts client ids alone)
 *  2. PIN (+ optional TOTP) verified before any money moves
 *  3. both account rows are locked (FOR UPDATE, ordered) and ALL validation runs on the locked rows
 *  4. debit, credit, transaction row, both ledger entries, notifications and fraud flags happen in ONE
 *     database transaction - an error anywhere rolls everything back, so money can never leave one account only
 *  5. idempotency key => a double click / network retry returns the original transaction instead of paying twice
 */
export async function transferFunds(actor: Actor, input: TransferInput): Promise<TransferResult> {
  let amount: number;
  try {
    amount = toCents(input.amount);
  } catch (e) {
    throw badRequest((e as Error).message);
  }
  if (amount <= 0) throw badRequest("Amount must be greater than zero");

  // duplicate prevention (replay)
  const [prior] = await db.select({ id: transactions.id, initiatedById: transactions.initiatedById }).from(transactions).where(eq(transactions.idempotencyKey, input.idempotencyKey)).limit(1);
  if (prior) {
    if (prior.initiatedById !== actor.id) throw conflict("This request key has already been used");
    return { transaction: await getTransaction(actor, prior.id), duplicate: true };
  }

  const [from] = await db.select().from(accounts).where(and(eq(accounts.id, input.fromAccountId), eq(accounts.userId, actor.id))).limit(1);
  if (!from) throw notFound("Source account"); // not yours == does not exist

  await verifyPin(actor.id, input.pin);
  await requireSecondFactor(actor.id, input.totp);

  const [to] = await db.select().from(accounts).where(eq(accounts.accountNumber, input.toAccountNumber)).limit(1);
  if (!to) throw unprocessable("Recipient account was not found. Check the account number and try again.", "RECIPIENT_NOT_FOUND");
  if (to.id === from.id) throw unprocessable("You cannot transfer to the same account.", "SAME_ACCOUNT");

  try {
    const txn = await db.transaction(async (tx) => {
      const locked = await lockAccounts(tx, [from.id, to.id]);
      const f = locked.get(from.id)!;
      const t = locked.get(to.id)!;
      const settings = await getSettings(tx);
      const owners = await tx.select({ id: users.id, status: users.status, name: users.name }).from(users).where(inArray(users.id, [f.userId, t.userId]));
      const fOwner = owners.find((o) => o.id === f.userId)!;
      const tOwner = owners.find((o) => o.id === t.userId)!;

      const fail = (message: string, code: string): never => {
        throw unprocessable(message, code);
      };
      if (f.status !== "ACTIVE") fail(`Your ${f.status.toLowerCase()} account cannot send money. Please contact the bank.`, "ACCOUNT_NOT_ACTIVE");
      if (fOwner.status !== "ACTIVE") fail("Your profile is not active. Please contact the bank.", "USER_NOT_ACTIVE");
      if (t.status !== "ACTIVE" || tOwner.status !== "ACTIVE") fail("The recipient account cannot receive funds right now.", "RECIPIENT_NOT_ACTIVE");

      const limits = effectiveLimits(f, settings);
      if (amount > limits.single) fail(`Amount exceeds the single transaction limit of ${formatMoney(toMajor(limits.single))}.`, "SINGLE_LIMIT_EXCEEDED");

      const [{ sent }] = await tx
        .select({ sent: sql<number>`coalesce(sum(${transactions.amount}), 0)::bigint` })
        .from(transactions)
        .where(and(eq(transactions.senderAccountId, f.id), eq(transactions.type, "TRANSFER"), eq(transactions.status, "COMPLETED"), gte(transactions.createdAt, startOfTodayUtc())));
      const sentToday = Number(sent);
      if (sentToday + amount > limits.daily)
        fail(`Daily transfer limit of ${formatMoney(toMajor(limits.daily))} would be exceeded (already sent ${formatMoney(toMajor(sentToday))} today).`, "DAILY_LIMIT_EXCEEDED");

      const fee = f.userId === t.userId ? 0 : settings.transferFee;
      if (f.balance - amount - fee < limits.minBalance)
        fail(limits.minBalance > 0 ? `Insufficient funds. A minimum balance of ${formatMoney(toMajor(limits.minBalance))} must remain.` : "Insufficient funds for this transfer (including fees).", "INSUFFICIENT_FUNDS");

      const senderBefore = f.balance;
      const senderAfter = await debit(tx, f.id, amount + fee, limits.minBalance);
      if (senderAfter === null) fail("Insufficient funds for this transfer (including fees).", "INSUFFICIENT_FUNDS");
      const receiverAfter = await credit(tx, t.id, amount);

      const row = await insertTransaction(tx, {
        type: "TRANSFER",
        senderAccountId: f.id,
        receiverAccountId: t.id,
        amount,
        fee,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        initiatedById: actor.id,
      });
      await insertLedger(tx, row.id, f.id, "DEBIT", amount + fee, senderAfter!);
      await insertLedger(tx, row.id, t.id, "CREDIT", amount, receiverAfter);

      await notify(tx, { userId: f.userId, type: "TRANSFER_COMPLETED", title: "Transfer completed", message: `You sent ${formatMoney(toMajor(amount))} to ${tOwner.name} (${t.accountNumber.slice(-4)}). Ref ${row.txnId}.`, link: `/customer/transactions?id=${row.id}` });
      if (f.userId !== t.userId)
        await notify(tx, { userId: t.userId, type: "MONEY_RECEIVED", title: "Money received", message: `You received ${formatMoney(toMajor(amount))} from ${fOwner.name}. Ref ${row.txnId}.`, link: `/customer/transactions?id=${row.id}` });

      await evaluateSuspicion(tx, row, { settings, sender: f, senderBalanceBefore: senderBefore, singleLimit: limits.single });
      return row;
    });
    return { transaction: await getTransaction(actor, txn.id), duplicate: false };
  } catch (e) {
    // business-rule rejection: keep an audit trail row (status FAILED) outside the rolled-back transaction
    if (e instanceof AppError && e.status === 422) {
      try {
        await insertTransaction(db, { type: "TRANSFER", status: "FAILED", senderAccountId: from.id, receiverAccountId: to.id, amount, description: input.description, initiatedById: actor.id, failureReason: e.message });
      } catch {
        /* best effort */
      }
    }
    throw e;
  }
}

/* ------------------------------------------------------------- reversal */

export async function reverseTransaction(actor: Actor, id: string, reason: string) {
  if (actor.role !== "ADMIN") throw forbidden("Only administrators can reverse transactions.");
  await db.transaction(async (tx) => {
    const [orig] = await tx.select().from(transactions).where(eq(transactions.id, id)).for("update").limit(1);
    if (!orig) throw notFound("Transaction");
    if (orig.type !== "TRANSFER") throw unprocessable("Only fund transfers can be reversed.", "NOT_REVERSIBLE");
    if (orig.status !== "COMPLETED") throw unprocessable(`A ${orig.status.toLowerCase()} transaction cannot be reversed.`, "NOT_REVERSIBLE");
    if (orig.reversalOfId) throw unprocessable("A reversal cannot be reversed.", "NOT_REVERSIBLE");
    if (!orig.senderAccountId || !orig.receiverAccountId) throw unprocessable("Transaction has no counter-party.", "NOT_REVERSIBLE");

    const locked = await lockAccounts(tx, [orig.senderAccountId, orig.receiverAccountId]);
    const sender = locked.get(orig.senderAccountId)!;
    const receiver = locked.get(orig.receiverAccountId)!;
    const receiverAfter = await debit(tx, receiver.id, orig.amount, 0);
    if (receiverAfter === null) throw unprocessable("The recipient has already spent these funds, so the transfer cannot be reversed automatically.", "RECIPIENT_FUNDS_UNAVAILABLE");
    const senderAfter = await credit(tx, sender.id, orig.amount + orig.fee); // fee is refunded as well

    const rev = await insertTransaction(tx, {
      type: "TRANSFER",
      senderAccountId: receiver.id,
      receiverAccountId: sender.id,
      amount: orig.amount,
      description: `Reversal of ${orig.txnId}: ${reason}`,
      initiatedById: actor.id,
      reversalOfId: orig.id,
    });
    await insertLedger(tx, rev.id, receiver.id, "DEBIT", orig.amount, receiverAfter);
    await insertLedger(tx, rev.id, sender.id, "CREDIT", orig.amount + orig.fee, senderAfter);
    await tx.update(transactions).set({ status: "REVERSED" }).where(eq(transactions.id, orig.id));

    const note = `Transaction ${orig.txnId} (${formatMoney(toMajor(orig.amount))}) was reversed by the bank. Reason: ${reason}`;
    await notify(tx, [
      { userId: sender.userId, type: "TRANSACTION_REVERSED", title: "Transaction reversed", message: note, link: `/customer/transactions?id=${orig.id}` },
      ...(receiver.userId !== sender.userId ? [{ userId: receiver.userId, type: "TRANSACTION_REVERSED", title: "Transaction reversed", message: note, link: `/customer/transactions?id=${orig.id}` }] : []),
    ]);
    await audit(tx, actor.id, "TRANSACTION_REVERSED", "transaction", orig.id, { reason, reversalTxnId: rev.id });
  });
  return getTransaction(actor, id);
}

/* ---------------------------------------------------------------- flags */

export async function flagTransaction(actor: Actor, id: string, reason: string) {
  if (actor.role === "CUSTOMER") throw forbidden();
  const [t] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!t) throw notFound("Transaction");
  const inserted = await db.insert(transactionFlags).values({ transactionId: t.id, source: "STAFF", reason, raisedById: actor.id }).onConflictDoNothing().returning({ id: transactionFlags.id });
  if (!inserted.length) throw conflict("This transaction is already flagged for the same reason.");
  await notifyAdmins(db, { type: "SUSPICIOUS_ACTIVITY", title: "Transaction flagged by staff", message: `${actor.name} flagged ${t.txnId}: ${reason}`, link: "/admin/flags" });
  await audit(db, actor.id, "TRANSACTION_FLAGGED", "transaction", t.id, { reason });
  return { ok: true };
}

export async function listFlags(q: { status?: "OPEN" | "DISMISSED" | "CONFIRMED"; page: number; pageSize: number }) {
  const where = q.status ? eq(transactionFlags.status, q.status) : undefined;
  const raisedBy = alias(users, "raised_by");
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        flag: transactionFlags,
        txnId: transactions.txnId, type: transactions.type, amount: transactions.amount, txnStatus: transactions.status, txnCreatedAt: transactions.createdAt, transactionRowId: transactions.id,
        senderNumber: s.accountNumber, senderOwner: su.name, senderAccountId: s.id,
        receiverNumber: r.accountNumber, receiverOwner: ru.name,
        raisedByName: raisedBy.name,
      })
      .from(transactionFlags)
      .innerJoin(transactions, eq(transactionFlags.transactionId, transactions.id))
      .leftJoin(s, eq(transactions.senderAccountId, s.id))
      .leftJoin(r, eq(transactions.receiverAccountId, r.id))
      .leftJoin(su, eq(s.userId, su.id))
      .leftJoin(ru, eq(r.userId, ru.id))
      .leftJoin(raisedBy, eq(transactionFlags.raisedById, raisedBy.id))
      .where(where)
      .orderBy(sql`case ${transactionFlags.status} when 'OPEN' then 0 else 1 end`, desc(transactionFlags.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(transactionFlags).where(where),
  ]);
  return {
    items: rows.map((x) => ({
      id: x.flag.id, source: x.flag.source, reason: x.flag.reason, status: x.flag.status, createdAt: x.flag.createdAt, resolvedAt: x.flag.resolvedAt, resolutionNote: x.flag.resolutionNote,
      raisedBy: x.raisedByName,
      transaction: { id: x.transactionRowId, txnId: x.txnId, type: x.type, status: x.txnStatus, amount: toMajor(x.amount), createdAt: x.txnCreatedAt, senderNumber: x.senderNumber, senderOwner: x.senderOwner, receiverNumber: x.receiverNumber, receiverOwner: x.receiverOwner },
    })),
    ...pageMeta(q.page, q.pageSize, count),
  };
}

export async function resolveFlag(actor: Actor, flagId: string, input: { action: "dismiss" | "confirm"; note?: string; freezeAccount?: boolean }) {
  if (actor.role !== "ADMIN") throw forbidden("Only administrators can resolve flags.");
  await db.transaction(async (tx) => {
    const [flag] = await tx.select().from(transactionFlags).where(eq(transactionFlags.id, flagId)).for("update").limit(1);
    if (!flag) throw notFound("Flag");
    if (flag.status !== "OPEN") throw conflict("This flag has already been resolved.");
    await tx
      .update(transactionFlags)
      .set({ status: input.action === "dismiss" ? "DISMISSED" : "CONFIRMED", resolvedById: actor.id, resolvedAt: new Date(), resolutionNote: input.note || null })
      .where(eq(transactionFlags.id, flagId));
    if (input.action === "confirm" && input.freezeAccount) {
      const [t] = await tx.select({ sender: transactions.senderAccountId }).from(transactions).where(eq(transactions.id, flag.transactionId)).limit(1);
      if (t?.sender) {
        await tx.update(accounts).set({ status: "FROZEN", updatedAt: new Date() }).where(eq(accounts.id, t.sender));
        await audit(tx, actor.id, "ACCOUNT_FROZEN", "account", t.sender, { via: "flag", flagId });
      }
    }
    await audit(tx, actor.id, input.action === "dismiss" ? "FLAG_DISMISSED" : "FLAG_CONFIRMED", "transaction_flag", flagId, { note: input.note });
  });
  return { ok: true };
}
