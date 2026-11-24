import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { LOAN_PRODUCTS, type LoanStatus } from "@/lib/constants";
import { buildSchedule, totalPayable } from "@/lib/loan-math";
import { formatMoney, toCents, toMajor } from "@/lib/money";
import type { LoanApplicationInput } from "@/lib/validators";
import { db, type DbLike } from "../db";
import { accounts, loanInstallments, loanNotes, loans, transactions, users, type Loan } from "../db/schema";
import { conflict, forbidden, notFound, unprocessable } from "../errors";
import { newLoanNumber } from "../security";
import { audit, credit, debit, effectiveLimits, getSettings, lockAccounts, notify, notifyAdmins, pageMeta } from "./common";
import { insertLedger, insertTransaction, requireSecondFactor, verifyPin, type Actor } from "./transactions";

const borrower = alias(users, "borrower");
const today = () => new Date().toISOString().slice(0, 10);

type LoanRow = { l: Loan; borrowerName: string; borrowerId: string; accountNumber: string };

async function installmentSummary(db: DbLike, loanIds: string[]) {
  if (!loanIds.length) return new Map<string, { paid: number; paidAmount: number; remaining: number; count: number; next: { number: number; dueDate: string; amount: number } | null; overdue: number }>();
  const rows = await db.select().from(loanInstallments).where(inArray(loanInstallments.loanId, loanIds)).orderBy(asc(loanInstallments.loanId), asc(loanInstallments.number));
  const map = new Map<string, { paid: number; paidAmount: number; remaining: number; count: number; next: { number: number; dueDate: string; amount: number } | null; overdue: number }>();
  for (const r of rows) {
    const m = map.get(r.loanId) ?? { paid: 0, paidAmount: 0, remaining: 0, count: 0, next: null, overdue: 0 };
    m.count++;
    if (r.status === "PAID") {
      m.paid++;
      m.paidAmount += r.amount;
    } else {
      m.remaining += r.amount;
      if (!m.next) m.next = { number: r.number, dueDate: r.dueDate, amount: toMajor(r.amount) };
      if (r.dueDate < today()) m.overdue++;
    }
    map.set(r.loanId, m);
  }
  return map;
}

function loanDTO(row: LoanRow, summary: Awaited<ReturnType<typeof installmentSummary>> extends Map<string, infer V> ? V | undefined : never, staff: boolean) {
  const { l } = row;
  const principal = l.approvedAmount ?? l.requestedAmount;
  const projected = !l.emi ? buildSchedule(principal, l.interestBps, l.durationMonths, new Date()) : null;
  const emi = l.emi ?? (projected ? projected[0].amount : 0);
  const total = l.totalPayable ?? (projected ? totalPayable(projected) : 0);
  return {
    id: l.id,
    loanNumber: l.loanNumber,
    type: l.type,
    status: l.status as LoanStatus,
    requestedAmount: toMajor(l.requestedAmount),
    approvedAmount: l.approvedAmount === null ? null : toMajor(l.approvedAmount),
    durationMonths: l.durationMonths,
    interestRate: l.interestBps / 100,
    emi: toMajor(emi),
    totalPayable: toMajor(total),
    totalInterest: toMajor(total - principal),
    employmentStatus: l.employmentStatus,
    monthlyIncome: toMajor(l.monthlyIncome),
    description: l.description,
    decisionNote: l.decisionNote,
    createdAt: l.createdAt,
    forwardedAt: l.forwardedAt,
    decidedAt: l.decidedAt,
    disbursedAt: l.disbursedAt,
    remainingBalance: summary ? toMajor(summary.remaining) : l.status === "COMPLETED" ? 0 : null,
    paidAmount: summary ? toMajor(summary.paidAmount) : 0,
    installmentsPaid: summary?.paid ?? 0,
    installmentsTotal: summary?.count ?? l.durationMonths,
    overdueInstallments: summary?.overdue ?? 0,
    nextInstallment: summary?.next ?? null,
    incomeRatio: staff ? Math.round((emi / l.monthlyIncome) * 1000) / 10 : undefined, // EMI as % of monthly income
    borrower: staff ? { id: row.borrowerId, name: row.borrowerName } : undefined,
    accountId: l.accountId,
    accountNumber: row.accountNumber,
  };
}

const baseSelect = () =>
  db
    .select({ l: loans, borrowerName: borrower.name, borrowerId: borrower.id, accountNumber: accounts.accountNumber })
    .from(loans)
    .innerJoin(borrower, eq(loans.userId, borrower.id))
    .innerJoin(accounts, eq(loans.accountId, accounts.id));

export async function listLoans(actor: Actor, q: { status?: LoanStatus; q?: string; userId?: string; page: number; pageSize: number }) {
  const conds: SQL[] = [];
  const staff = actor.role !== "CUSTOMER";
  if (!staff) conds.push(eq(loans.userId, actor.id));
  else if (q.userId) conds.push(eq(loans.userId, q.userId));
  if (q.status) conds.push(eq(loans.status, q.status));
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(loans.loanNumber, like), ilike(borrower.name, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, [{ count }]] = await Promise.all([
    baseSelect()
      .where(where)
      .orderBy(sql`case ${loans.status} when 'UNDER_REVIEW' then 0 when 'PENDING' then 1 else 2 end`, desc(loans.createdAt), desc(loans.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(loans).innerJoin(borrower, eq(loans.userId, borrower.id)).where(where),
  ]);
  const sums = await installmentSummary(db, rows.map((r) => r.l.id));
  return { items: rows.map((r) => loanDTO(r, sums.get(r.l.id), staff)), ...pageMeta(q.page, q.pageSize, count) };
}

export async function getLoan(actor: Actor, id: string) {
  const [row] = await baseSelect().where(eq(loans.id, id)).limit(1);
  if (!row || (actor.role === "CUSTOMER" && row.l.userId !== actor.id)) throw notFound("Loan");
  const staff = actor.role !== "CUSTOMER";
  const sums = await installmentSummary(db, [id]);
  const dto = loanDTO(row, sums.get(id), staff);

  const rows = await db
    .select({ i: loanInstallments, txnRef: transactions.txnId })
    .from(loanInstallments)
    .leftJoin(transactions, eq(loanInstallments.transactionId, transactions.id))
    .where(eq(loanInstallments.loanId, id))
    .orderBy(asc(loanInstallments.number));
  const projected = !rows.length ? buildSchedule(row.l.approvedAmount ?? row.l.requestedAmount, row.l.interestBps, row.l.durationMonths, new Date()) : null;
  const schedule = rows.length
    ? rows.map(({ i }) => ({ number: i.number, dueDate: i.dueDate, principal: toMajor(i.principal), interest: toMajor(i.interest), amount: toMajor(i.amount), status: i.status, paidAt: i.paidAt, overdue: i.status === "PENDING" && i.dueDate < today() }))
    : projected!.map((p) => ({ number: p.number, dueDate: p.dueDate, principal: toMajor(p.principal), interest: toMajor(p.interest), amount: toMajor(p.amount), status: "PENDING" as const, paidAt: null, overdue: false }));
  const repayments = rows.filter(({ i }) => i.status === "PAID").map(({ i, txnRef }) => ({ installmentNumber: i.number, amount: toMajor(i.amount), paidAt: i.paidAt, transactionRef: txnRef, transactionId: i.transactionId }));

  let notes: { id: string; body: string; createdAt: Date; author: string }[] = [];
  let borrowerInfo = null;
  if (staff) {
    const author = alias(users, "author");
    const n = await db.select({ id: loanNotes.id, body: loanNotes.body, createdAt: loanNotes.createdAt, author: author.name }).from(loanNotes).innerJoin(author, eq(loanNotes.authorId, author.id)).where(eq(loanNotes.loanId, id)).orderBy(desc(loanNotes.createdAt));
    notes = n;
    const [u] = await db.select().from(users).where(eq(users.id, row.l.userId)).limit(1);
    const [bal] = await db.select({ total: sql<number>`coalesce(sum(${accounts.balance}), 0)::bigint`, n: sql<number>`count(*)::int` }).from(accounts).where(eq(accounts.userId, u.id));
    const [other] = await db.select({ n: sql<number>`count(*)::int` }).from(loans).where(and(eq(loans.userId, u.id), inArray(loans.status, ["ACTIVE", "APPROVED"]))).limit(1);
    borrowerInfo = {
      id: u.id, name: u.name, email: u.email, phone: u.phone, customerNumber: u.customerNumber, verified: u.verified, status: u.status, memberSince: u.createdAt,
      totalBalance: toMajor(Number(bal.total)), accounts: bal.n, activeLoans: other.n,
    };
  }
  return { ...dto, schedule, scheduleIsProjection: !rows.length, repayments, notes: staff ? notes : undefined, borrowerInfo: staff ? borrowerInfo : undefined, products: undefined };
}

/* ------------------------------------------------------------- workflow */

export async function applyForLoan(actor: Actor, input: LoanApplicationInput) {
  if (actor.role !== "CUSTOMER") throw forbidden("Only customers can apply for loans.");
  const [me] = await db.select({ verified: users.verified, name: users.name }).from(users).where(eq(users.id, actor.id)).limit(1);
  if (!me.verified) throw unprocessable("Your identity verification is still pending. Please visit a branch or contact support before applying for a loan.", "NOT_VERIFIED");
  const [acc] = await db.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.userId, actor.id))).limit(1);
  if (!acc) throw notFound("Account");
  if (acc.status !== "ACTIVE") throw unprocessable("The selected account is not active.", "ACCOUNT_NOT_ACTIVE");
  const [{ open }] = await db.select({ open: sql<number>`count(*)::int` }).from(loans).where(and(eq(loans.userId, actor.id), inArray(loans.status, ["PENDING", "UNDER_REVIEW", "APPROVED", "ACTIVE"])));
  if (open >= 3) throw unprocessable("You already have 3 open loans or applications. Complete one before applying for another.", "TOO_MANY_LOANS");

  const product = LOAN_PRODUCTS[input.type];
  const [created] = await db
    .insert(loans)
    .values({
      loanNumber: newLoanNumber(), userId: actor.id, accountId: acc.id, type: input.type, requestedAmount: toCents(input.requestedAmount), durationMonths: input.durationMonths,
      interestBps: product.interestBps, monthlyIncome: toCents(input.monthlyIncome), employmentStatus: input.employmentStatus, description: input.description,
    })
    .returning();
  await notifyStaff(db, { type: "LOAN_APPLICATION", title: "New loan application", message: `${me.name} applied for ${formatMoney(input.requestedAmount)} (${product.label}).`, link: `/admin/loans/${created.id}` });
  await audit(db, actor.id, "LOAN_APPLIED", "loan", created.id, { amount: created.requestedAmount });
  return { id: created.id, loanNumber: created.loanNumber, status: created.status };
}

async function notifyStaff(tx: DbLike, input: { type: string; title: string; message: string; link: string }) {
  const staff = await tx.select({ id: users.id, role: users.role }).from(users).where(and(inArray(users.role, ["STAFF", "ADMIN"]), eq(users.status, "ACTIVE")));
  await notify(tx, staff.map((s) => ({ userId: s.id, type: input.type, title: input.title, message: input.message, link: s.role === "ADMIN" ? input.link : input.link.replace("/admin/", "/staff/") })));
}

export async function addLoanNote(actor: Actor, loanId: string, body: string) {
  if (actor.role === "CUSTOMER") throw forbidden();
  const [l] = await db.select({ id: loans.id }).from(loans).where(eq(loans.id, loanId)).limit(1);
  if (!l) throw notFound("Loan");
  await db.insert(loanNotes).values({ loanId, authorId: actor.id, body });
  return { ok: true };
}

/** Staff step: review done, hand the application to an administrator. Staff cannot approve. */
export async function forwardLoan(actor: Actor, loanId: string, note?: string) {
  if (actor.role === "CUSTOMER") throw forbidden();
  await db.transaction(async (tx) => {
    const [l] = await tx.select().from(loans).where(eq(loans.id, loanId)).for("update").limit(1);
    if (!l) throw notFound("Loan");
    if (l.status !== "PENDING") throw conflict("Only pending applications can be forwarded for admin approval.", "INVALID_STATE");
    if (l.userId === actor.id) throw forbidden("You cannot process your own loan application.");
    await tx.update(loans).set({ status: "UNDER_REVIEW", forwardedById: actor.id, forwardedAt: new Date(), updatedAt: new Date() }).where(eq(loans.id, loanId));
    if (note) await tx.insert(loanNotes).values({ loanId, authorId: actor.id, body: note });
    await notify(tx, { userId: l.userId, type: "LOAN_UNDER_REVIEW", title: "Loan under review", message: `Your application ${l.loanNumber} has been reviewed by our staff and sent for final approval.`, link: `/customer/loans/${l.id}` });
    await notifyAdmins(tx, { type: "LOAN_FORWARDED", title: "Loan forwarded for approval", message: `${actor.name} forwarded ${l.loanNumber}.`, link: `/admin/loans/${l.id}` });
    await audit(tx, actor.id, "LOAN_FORWARDED", "loan", loanId);
  });
  return getLoan(actor, loanId);
}

async function disburseInTx(tx: DbLike, loan: Loan, actor: Actor) {
  const principal = loan.approvedAmount ?? loan.requestedAmount;
  const locked = await lockAccounts(tx, [loan.accountId]);
  const acc = locked.get(loan.accountId)!;
  if (acc.status !== "ACTIVE") throw unprocessable("The destination account is not active, so the loan cannot be disbursed.", "ACCOUNT_NOT_ACTIVE");
  const now = new Date();
  const schedule = buildSchedule(principal, loan.interestBps, loan.durationMonths, now);
  const balanceAfter = await credit(tx, acc.id, principal);
  const t = await insertTransaction(tx, { type: "LOAN_DISBURSEMENT", receiverAccountId: acc.id, amount: principal, description: `Disbursement of loan ${loan.loanNumber}`, initiatedById: actor.id });
  await insertLedger(tx, t.id, acc.id, "CREDIT", principal, balanceAfter);
  await tx.insert(loanInstallments).values(schedule.map((s) => ({ loanId: loan.id, number: s.number, dueDate: s.dueDate, principal: s.principal, interest: s.interest, amount: s.amount })));
  await tx.update(loans).set({ status: "ACTIVE", disbursedAt: now, disbursementTxnId: t.id, emi: schedule[0].amount, totalPayable: totalPayable(schedule), updatedAt: now }).where(eq(loans.id, loan.id));
  await notify(tx, { userId: loan.userId, type: "LOAN_DISBURSED", title: "Loan disbursed", message: `${formatMoney(toMajor(principal))} has been credited to account ${acc.accountNumber}. First instalment is due ${schedule[0].dueDate}.`, link: `/customer/loans/${loan.id}` });
  await audit(tx, actor.id, "LOAN_DISBURSED", "loan", loan.id, { amount: principal, txnId: t.txnId });
}

export async function decideLoan(actor: Actor, loanId: string, input: { action: "approve" | "reject"; note?: string; approvedAmount?: number; interestRate?: number; disburse: boolean }) {
  if (actor.role !== "ADMIN") throw forbidden("Only administrators can approve or reject loans.");
  await db.transaction(async (tx) => {
    const [l] = await tx.select().from(loans).where(eq(loans.id, loanId)).for("update").limit(1);
    if (!l) throw notFound("Loan");
    if (l.status !== "PENDING" && l.status !== "UNDER_REVIEW") throw conflict(`This loan is already ${l.status.toLowerCase().replace("_", " ")}.`, "INVALID_STATE");
    if (l.userId === actor.id) throw forbidden("You cannot decide your own loan application.");

    if (input.action === "reject") {
      await tx.update(loans).set({ status: "REJECTED", decidedById: actor.id, decidedAt: new Date(), decisionNote: input.note || null, updatedAt: new Date() }).where(eq(loans.id, loanId));
      await notify(tx, { userId: l.userId, type: "LOAN_REJECTED", title: "Loan application rejected", message: `Your application ${l.loanNumber} was not approved.${input.note ? ` Reason: ${input.note}` : ""}`, link: `/customer/loans/${l.id}` });
      await audit(tx, actor.id, "LOAN_REJECTED", "loan", loanId, { note: input.note });
      return;
    }

    const approved = input.approvedAmount ? toCents(input.approvedAmount) : l.requestedAmount;
    if (approved > l.requestedAmount) throw unprocessable("The approved amount cannot exceed the requested amount.", "AMOUNT_TOO_HIGH");
    const bps = input.interestRate ? Math.round(input.interestRate * 100) : l.interestBps;
    const schedule = buildSchedule(approved, bps, l.durationMonths, new Date());
    const [updated] = await tx
      .update(loans)
      .set({ status: "APPROVED", approvedAmount: approved, interestBps: bps, emi: schedule[0].amount, totalPayable: totalPayable(schedule), decidedById: actor.id, decidedAt: new Date(), decisionNote: input.note || null, updatedAt: new Date() })
      .where(eq(loans.id, loanId))
      .returning();
    await notify(tx, { userId: l.userId, type: "LOAN_APPROVED", title: "Loan approved", message: `Great news - your application ${l.loanNumber} for ${formatMoney(toMajor(approved))} was approved.`, link: `/customer/loans/${l.id}` });
    await audit(tx, actor.id, "LOAN_APPROVED", "loan", loanId, { approved, bps });
    if (input.disburse) await disburseInTx(tx, updated, actor);
  });
  return getLoan(actor, loanId);
}

export async function disburseLoan(actor: Actor, loanId: string) {
  if (actor.role !== "ADMIN") throw forbidden("Only administrators can disburse loans.");
  await db.transaction(async (tx) => {
    const [l] = await tx.select().from(loans).where(eq(loans.id, loanId)).for("update").limit(1);
    if (!l) throw notFound("Loan");
    if (l.status !== "APPROVED") throw conflict("Only approved loans that have not been disbursed can be disbursed.", "INVALID_STATE");
    await disburseInTx(tx, l, actor);
  });
  return getLoan(actor, loanId);
}

/** Customer pays the next outstanding instalment from one of their own accounts (PIN protected, atomic). */
export async function repayInstallment(actor: Actor, loanId: string, input: { accountId: string; pin: string; totp?: string }) {
  if (actor.role !== "CUSTOMER") throw forbidden("Only the borrower can repay a loan.");
  const [loan] = await db.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.userId, actor.id))).limit(1);
  if (!loan) throw notFound("Loan");
  const [acc] = await db.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.userId, actor.id))).limit(1);
  if (!acc) throw notFound("Account");
  await verifyPin(actor.id, input.pin);
  await requireSecondFactor(actor.id, input.totp);

  await db.transaction(async (tx) => {
    const [l] = await tx.select().from(loans).where(eq(loans.id, loanId)).for("update").limit(1);
    if (l.status !== "ACTIVE") throw conflict("This loan has no instalments to pay.", "INVALID_STATE");
    // the loan row lock serialises concurrent repayments, so the same instalment can never be paid twice
    const [next] = await tx.select().from(loanInstallments).where(and(eq(loanInstallments.loanId, loanId), eq(loanInstallments.status, "PENDING"))).orderBy(asc(loanInstallments.number)).limit(1);
    if (!next) throw conflict("All instalments are already paid.", "INVALID_STATE");

    const locked = await lockAccounts(tx, [acc.id]);
    const a = locked.get(acc.id)!;
    if (a.status !== "ACTIVE") throw unprocessable("The selected account is not active.", "ACCOUNT_NOT_ACTIVE");
    const settings = await getSettings(tx);
    const floor = effectiveLimits(a, settings).minBalance;
    const after = await debit(tx, a.id, next.amount, floor);
    if (after === null) throw unprocessable(`Insufficient funds. This instalment is ${formatMoney(toMajor(next.amount))}.`, "INSUFFICIENT_FUNDS");

    const t = await insertTransaction(tx, { type: "LOAN_REPAYMENT", senderAccountId: a.id, amount: next.amount, description: `Loan ${l.loanNumber} - instalment ${next.number}/${l.durationMonths}`, initiatedById: actor.id });
    await insertLedger(tx, t.id, a.id, "DEBIT", next.amount, after);
    await tx.update(loanInstallments).set({ status: "PAID", paidAt: new Date(), transactionId: t.id }).where(eq(loanInstallments.id, next.id));
    const [{ left }] = await tx.select({ left: sql<number>`count(*)::int` }).from(loanInstallments).where(and(eq(loanInstallments.loanId, loanId), eq(loanInstallments.status, "PENDING")));
    if (left === 0) {
      await tx.update(loans).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(loans.id, loanId));
      await notify(tx, { userId: actor.id, type: "LOAN_COMPLETED", title: "Loan fully repaid", message: `Congratulations! Loan ${l.loanNumber} is fully repaid.`, link: `/customer/loans/${l.id}` });
    }
    await notify(tx, { userId: actor.id, type: "LOAN_REPAYMENT", title: "Repayment received", message: `Instalment ${next.number} of ${formatMoney(toMajor(next.amount))} paid for ${l.loanNumber}.`, link: `/customer/loans/${l.id}` });
  });
  return getLoan(actor, loanId);
}
