import { and, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { formatMoney, toCents, toMajor } from "@/lib/money";
import type { FundRequestInput } from "@/lib/validators";
import { db } from "../db";
import { accounts, fundRequests, transactions, users } from "../db/schema";
import { conflict, forbidden, notFound, unprocessable } from "../errors";
import { newRequestNumber } from "../security";
import { audit, credit, debit, effectiveLimits, getSettings, lockAccounts, notify, pageMeta } from "./common";
import { evaluateSuspicion, insertLedger, insertTransaction, requireSecondFactor, type Actor } from "./transactions";

const reviewer = alias(users, "reviewer");

export async function listFundRequests(actor: Actor, q: { status?: "PENDING" | "APPROVED" | "REJECTED"; type?: "DEPOSIT" | "WITHDRAWAL"; q?: string; page: number; pageSize: number }) {
  const conds: SQL[] = [];
  if (actor.role === "CUSTOMER") conds.push(eq(fundRequests.userId, actor.id));
  if (q.status) conds.push(eq(fundRequests.status, q.status));
  if (q.type) conds.push(eq(fundRequests.type, q.type));
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(fundRequests.requestNumber, like), ilike(accounts.accountNumber, like), ilike(users.name, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        f: fundRequests, accountNumber: accounts.accountNumber, accountType: accounts.type, balance: accounts.balance, customer: users.name, customerId: users.id, reviewer: reviewer.name, txnRef: transactions.txnId,
      })
      .from(fundRequests)
      .innerJoin(accounts, eq(fundRequests.accountId, accounts.id))
      .innerJoin(users, eq(fundRequests.userId, users.id))
      .leftJoin(reviewer, eq(fundRequests.reviewedById, reviewer.id))
      .leftJoin(transactions, eq(fundRequests.transactionId, transactions.id))
      .where(where)
      .orderBy(sql`case ${fundRequests.status} when 'PENDING' then 0 else 1 end`, desc(fundRequests.createdAt), desc(fundRequests.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(fundRequests).innerJoin(accounts, eq(fundRequests.accountId, accounts.id)).innerJoin(users, eq(fundRequests.userId, users.id)).where(where),
  ]);
  const staff = actor.role !== "CUSTOMER";
  return {
    items: rows.map((r) => ({
      id: r.f.id, requestNumber: r.f.requestNumber, type: r.f.type as "DEPOSIT" | "WITHDRAWAL", status: r.f.status, amount: toMajor(r.f.amount), description: r.f.description,
      requestDate: r.f.createdAt, reviewedAt: r.f.reviewedAt, reviewNote: r.f.reviewNote, reviewedBy: r.reviewer, transactionId: r.f.transactionId, transactionRef: r.txnRef,
      account: { id: r.f.accountId, accountNumber: r.accountNumber, type: r.accountType, balance: staff ? toMajor(r.balance) : undefined },
      customer: staff ? { id: r.customerId, name: r.customer } : undefined,
    })),
    ...pageMeta(q.page, q.pageSize, count),
  };
}

export async function createFundRequest(actor: Actor, input: FundRequestInput) {
  if (actor.role !== "CUSTOMER") throw forbidden("Only customers can submit deposit or withdrawal requests.");
  const amount = toCents(input.amount);
  const [acc] = await db.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.userId, actor.id))).limit(1);
  if (!acc) throw notFound("Account");
  if (acc.status !== "ACTIVE") throw unprocessable(`This account is ${acc.status.toLowerCase()} and cannot accept requests.`, "ACCOUNT_NOT_ACTIVE");
  const settings = await getSettings(db);
  const limits = effectiveLimits(acc, settings);
  if (amount > limits.single) throw unprocessable(`Amount exceeds the single transaction limit of ${formatMoney(toMajor(limits.single))}.`, "SINGLE_LIMIT_EXCEEDED");
  if (input.type === "WITHDRAWAL") {
    await requireSecondFactor(actor.id, input.totp);
    if (acc.balance - amount < limits.minBalance) throw unprocessable("Insufficient available balance for this withdrawal.", "INSUFFICIENT_FUNDS");
  }

  // duplicate prevention: the same open request submitted twice within a minute is a double click
  const [dup] = await db
    .select({ id: fundRequests.id })
    .from(fundRequests)
    .where(and(eq(fundRequests.accountId, acc.id), eq(fundRequests.type, input.type), eq(fundRequests.amount, amount), eq(fundRequests.status, "PENDING"), gte(fundRequests.createdAt, new Date(Date.now() - 60_000))))
    .limit(1);
  if (dup) throw conflict("An identical request was just submitted. Please wait for it to be reviewed.", "DUPLICATE_REQUEST");

  const created = await db.transaction(async (tx) => {
    // a PENDING transaction is the ledger-side twin of the request; it completes or fails on review
    const t = await insertTransaction(tx, {
      type: input.type,
      status: "PENDING",
      senderAccountId: input.type === "WITHDRAWAL" ? acc.id : null,
      receiverAccountId: input.type === "DEPOSIT" ? acc.id : null,
      amount,
      description: input.description || (input.type === "DEPOSIT" ? "Deposit request" : "Withdrawal request"),
      idempotencyKey: input.idempotencyKey ?? null,
      initiatedById: actor.id,
    });
    const [req] = await tx.insert(fundRequests).values({ requestNumber: newRequestNumber(), type: input.type, accountId: acc.id, userId: actor.id, amount, description: input.description || null, transactionId: t.id }).returning();
    await audit(tx, actor.id, `${input.type}_REQUESTED`, "fund_request", req.id, { amount });
    return req;
  });
  return { id: created.id, requestNumber: created.requestNumber, status: created.status };
}

/**
 * Staff/admin review. Money moves only here, inside one transaction that locks the request and the account,
 * so a request can never be approved twice and a withdrawal can never overdraw the account.
 */
export async function reviewFundRequest(actor: Actor, id: string, input: { action: "approve" | "reject"; note?: string }) {
  if (actor.role === "CUSTOMER") throw forbidden("Customers cannot review requests.");
  await db.transaction(async (tx) => {
    const [req] = await tx.select().from(fundRequests).where(eq(fundRequests.id, id)).for("update").limit(1);
    if (!req) throw notFound("Request");
    if (req.status !== "PENDING") throw conflict(`This request was already ${req.status.toLowerCase()}.`, "ALREADY_REVIEWED");
    if (req.userId === actor.id) throw forbidden("You cannot review your own request."); // four-eyes principle
    const [txn] = await tx.select().from(transactions).where(eq(transactions.id, req.transactionId!)).for("update").limit(1);
    const label = req.type === "DEPOSIT" ? "Deposit" : "Withdrawal";
    const amountText = formatMoney(toMajor(req.amount));

    if (input.action === "reject") {
      await tx.update(transactions).set({ status: "FAILED", failureReason: input.note || "Rejected by the bank" }).where(eq(transactions.id, txn.id));
      await tx.update(fundRequests).set({ status: "REJECTED", reviewedById: actor.id, reviewedAt: new Date(), reviewNote: input.note || null }).where(eq(fundRequests.id, id));
      await notify(tx, { userId: req.userId, type: `${req.type}_REJECTED`, title: `${label} rejected`, message: `Your ${label.toLowerCase()} request ${req.requestNumber} for ${amountText} was rejected.${input.note ? ` Reason: ${input.note}` : ""}`, link: "/customer/requests" });
      await audit(tx, actor.id, `${req.type}_REJECTED`, "fund_request", id, { note: input.note });
      return;
    }

    const locked = await lockAccounts(tx, [req.accountId]);
    const acc = locked.get(req.accountId)!;
    if (acc.status !== "ACTIVE") throw unprocessable(`The account is ${acc.status.toLowerCase()}; approve only after it is reactivated.`, "ACCOUNT_NOT_ACTIVE");
    const settings = await getSettings(tx);
    let balanceAfter: number;
    if (req.type === "DEPOSIT") {
      balanceAfter = await credit(tx, acc.id, req.amount);
      await insertLedger(tx, txn.id, acc.id, "CREDIT", req.amount, balanceAfter);
    } else {
      const floor = effectiveLimits(acc, settings).minBalance;
      const after = await debit(tx, acc.id, req.amount, floor);
      if (after === null) throw unprocessable("The customer no longer has enough balance for this withdrawal. Reject the request instead.", "INSUFFICIENT_FUNDS");
      balanceAfter = after;
      await insertLedger(tx, txn.id, acc.id, "DEBIT", req.amount, balanceAfter);
    }
    const [done] = await tx.update(transactions).set({ status: "COMPLETED", completedAt: new Date() }).where(eq(transactions.id, txn.id)).returning();
    await tx.update(fundRequests).set({ status: "APPROVED", reviewedById: actor.id, reviewedAt: new Date(), reviewNote: input.note || null }).where(eq(fundRequests.id, id));
    await notify(tx, { userId: req.userId, type: `${req.type}_APPROVED`, title: `${label} approved`, message: `Your ${label.toLowerCase()} of ${amountText} was approved. New balance: ${formatMoney(toMajor(balanceAfter))}.`, link: "/customer/requests" });
    await evaluateSuspicion(tx, done, { settings, sender: req.type === "WITHDRAWAL" ? acc : null });
    await audit(tx, actor.id, `${req.type}_APPROVED`, "fund_request", id, { amount: req.amount });
  });
  return { ok: true };
}

export async function pendingCounts() {
  const [row] = await db.select({ pending: sql<number>`count(*) filter (where ${fundRequests.status} = 'PENDING')::int` }).from(fundRequests);
  return { pendingRequests: row.pending };
}

