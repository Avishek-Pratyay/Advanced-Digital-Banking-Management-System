import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { toMajor } from "@/lib/money";
import { db } from "../db";
import { accounts, fundRequests, ledgerEntries, loans, transactionFlags, transactions, users } from "../db/schema";
import { notFound } from "../errors";
import { getSettings } from "./common";
import { accountDTO } from "./accounts";
import { listTransactions, type Actor } from "./transactions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Last `n` calendar months (UTC), oldest first, as 'YYYY-MM' keys. */
export function lastMonths(n = 12, now = new Date()) {
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: d.toISOString().slice(0, 7), label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` });
  }
  return out;
}
const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const windowStart = (n = 12) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (n - 1), 1));

export async function adminDashboard() {
  const [[c], [a], [t], [l], [req], [fl]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "CUSTOMER")),
    db.select({ n: sql<number>`count(*)::int`, balance: sql<number>`coalesce(sum(${accounts.balance}), 0)::bigint` }).from(accounts),
    db
      .select({
        total: sql<number>`count(*)::int`,
        deposits: sql<number>`coalesce(sum(case when ${transactions.type} = 'DEPOSIT' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} end), 0)::bigint`,
        withdrawals: sql<number>`coalesce(sum(case when ${transactions.type} = 'WITHDRAWAL' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} end), 0)::bigint`,
      })
      .from(transactions),
    db.select({ n: sql<number>`count(*)::int` }).from(loans).where(inArray(loans.status, ["PENDING", "UNDER_REVIEW"])),
    db.select({ n: sql<number>`count(*)::int` }).from(fundRequests).where(eq(fundRequests.status, "PENDING")),
    db.select({ n: sql<number>`count(*)::int` }).from(transactionFlags).where(eq(transactionFlags.status, "OPEN")),
  ]);

  const months = lastMonths(12);
  const since = windowStart(12);
  const txRows = await db.select({ at: transactions.createdAt, type: transactions.type, amount: transactions.amount }).from(transactions).where(and(eq(transactions.status, "COMPLETED"), gte(transactions.createdAt, since)));
  const accRows = await db.select({ at: accounts.createdAt }).from(accounts).where(gte(accounts.createdAt, since));
  const custRows = await db.select({ at: users.createdAt }).from(users).where(and(eq(users.role, "CUSTOMER"), gte(users.createdAt, since)));

  const vol = new Map(months.map((m) => [m.key, { volume: 0, count: 0, deposits: 0, withdrawals: 0, transfers: 0, newAccounts: 0, newCustomers: 0 }]));
  for (const r of txRows) {
    const m = vol.get(monthKey(r.at));
    if (!m) continue;
    m.volume += r.amount;
    m.count++;
    if (r.type === "DEPOSIT") m.deposits += r.amount;
    if (r.type === "WITHDRAWAL") m.withdrawals += r.amount;
    if (r.type === "TRANSFER") m.transfers += r.amount;
  }
  for (const r of accRows) { const m = vol.get(monthKey(r.at)); if (m) m.newAccounts++; }
  for (const r of custRows) { const m = vol.get(monthKey(r.at)); if (m) m.newCustomers++; }

  const dist = await db.select({ type: accounts.type, count: sql<number>`count(*)::int`, balance: sql<number>`coalesce(sum(${accounts.balance}), 0)::bigint` }).from(accounts).groupBy(accounts.type);
  const loanStats = await db.select({ status: loans.status, count: sql<number>`count(*)::int`, amount: sql<number>`coalesce(sum(coalesce(${loans.approvedAmount}, ${loans.requestedAmount})), 0)::bigint` }).from(loans).groupBy(loans.status);

  const recent = await db
    .select({ id: transactions.id })
    .from(transactions)
    .orderBy(desc(transactions.createdAt))
    .limit(6);
  const recentTransactions = recent.length ? (await listTransactions({ id: "", role: "ADMIN", name: "" }, { page: 1, pageSize: 6 })).items : [];

  return {
    stats: {
      totalCustomers: c.n, totalAccounts: a.n, totalBalance: toMajor(Number(a.balance)), totalDeposits: toMajor(Number(t.deposits)), totalWithdrawals: toMajor(Number(t.withdrawals)),
      totalTransactions: t.total, pendingLoans: l.n, pendingRequests: req.n, openFlags: fl.n,
    },
    charts: {
      monthlyVolume: months.map((m) => ({ month: m.label, volume: toMajor(vol.get(m.key)!.volume), count: vol.get(m.key)!.count })),
      depositVsWithdrawal: months.map((m) => ({ month: m.label, deposits: toMajor(vol.get(m.key)!.deposits), withdrawals: toMajor(vol.get(m.key)!.withdrawals) })),
      accountDistribution: dist.map((d) => ({ type: d.type, count: d.count, balance: toMajor(Number(d.balance)) })),
      loanApprovals: loanStats.map((x) => ({ status: x.status, count: x.count, amount: toMajor(Number(x.amount)) })),
      monthlyActivity: months.map((m) => ({ month: m.label, transactions: vol.get(m.key)!.count, newAccounts: vol.get(m.key)!.newAccounts, newCustomers: vol.get(m.key)!.newCustomers })),
    },
    recentTransactions,
  };
}

export async function staffDashboard() {
  const [[req], [pendingTx], [loansToReview], [fl], [cust], [unverified]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(fundRequests).where(eq(fundRequests.status, "PENDING")),
    db.select({ n: sql<number>`count(*)::int` }).from(transactions).where(eq(transactions.status, "PENDING")),
    db.select({ n: sql<number>`count(*)::int` }).from(loans).where(eq(loans.status, "PENDING")),
    db.select({ n: sql<number>`count(*)::int` }).from(transactionFlags).where(eq(transactionFlags.status, "OPEN")),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "CUSTOMER")),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(and(eq(users.role, "CUSTOMER"), eq(users.verified, false))),
  ]);
  const recent = (await listTransactions({ id: "", role: "STAFF", name: "" }, { page: 1, pageSize: 6 })).items;
  return { stats: { pendingRequests: req.n, pendingTransactions: pendingTx.n, loansToReview: loansToReview.n, openFlags: fl.n, totalCustomers: cust.n, unverifiedCustomers: unverified.n }, recentTransactions: recent };
}

export async function customerDashboard(actor: Actor, accountId?: string) {
  const settings = await getSettings(db);
  const accs = await db.select().from(accounts).where(eq(accounts.userId, actor.id)).orderBy(accounts.createdAt);
  const mine = new Set(accs.map((a) => a.id));
  if (accountId && accountId !== "all" && !mine.has(accountId)) throw notFound("Account");
  const scope = accountId && accountId !== "all" ? [accountId] : accs.map((a) => a.id);
  const selected = accountId && accountId !== "all" ? accs.find((a) => a.id === accountId)! : null;

  const months = lastMonths(12);
  const since = windowStart(12);
  const rows = scope.length
    ? await db
        .select({
          at: ledgerEntries.createdAt, direction: ledgerEntries.direction, amount: ledgerEntries.amount, type: transactions.type, status: transactions.status,
          sender: transactions.senderAccountId, receiver: transactions.receiverAccountId,
        })
        .from(ledgerEntries)
        .innerJoin(transactions, eq(ledgerEntries.transactionId, transactions.id))
        .where(and(inArray(ledgerEntries.accountId, scope), gte(ledgerEntries.createdAt, since)))
    : [];

  const m = new Map(months.map((x) => [x.key, { spending: 0, deposits: 0, received: 0 }]));
  const typeAgg = new Map<string, { count: number; amount: number }>();
  for (const r of rows) {
    const internal = !!r.sender && !!r.receiver && mine.has(r.sender) && mine.has(r.receiver);
    const bucket = m.get(monthKey(r.at));
    if (bucket) {
      if (r.direction === "DEBIT" && !(internal && !selected)) bucket.spending += r.amount;
      if (r.direction === "CREDIT" && r.type === "DEPOSIT") bucket.deposits += r.amount;
      if (r.direction === "CREDIT" && (r.type === "TRANSFER" || r.type === "LOAN_DISBURSEMENT") && !(internal && !selected)) bucket.received += r.amount;
    }
    if (r.direction === "DEBIT" || r.type === "DEPOSIT" || r.type === "LOAN_DISBURSEMENT" || !internal) {
      const key = r.type;
      const cur = typeAgg.get(key) ?? { count: 0, amount: 0 };
      cur.count++;
      cur.amount += r.amount;
      typeAgg.set(key, cur);
    }
  }

  const [totals] = scope.length
    ? await db
        .select({
          deposits: sql<number>`coalesce(sum(case when ${transactions.type} = 'DEPOSIT' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} end), 0)::bigint`,
          withdrawals: sql<number>`coalesce(sum(case when ${transactions.type} = 'WITHDRAWAL' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} end), 0)::bigint`,
        })
        .from(transactions)
        .where(sql`(${inArray(transactions.senderAccountId, scope)} or ${inArray(transactions.receiverAccountId, scope)})`)
    : [{ deposits: 0, withdrawals: 0 }];

  const activeLoans = await db.select().from(loans).where(and(eq(loans.userId, actor.id), eq(loans.status, "ACTIVE")));
  const loanSums = activeLoans.length
    ? await db.execute<{ loan_id: string; remaining: string; next_due: string | null }>(sql`select loan_id, coalesce(sum(amount) filter (where status = 'PENDING'), 0)::bigint as remaining, min(due_date) filter (where status = 'PENDING') as next_due from loan_installments where loan_id in ${activeLoans.map((l) => l.id)} group by loan_id`)
    : [];
  const loanRows: { loan_id: string; remaining: string; next_due: string | null }[] = Array.isArray(loanSums) ? (loanSums as never) : ((loanSums as { rows?: never[] }).rows ?? []);

  const recent = scope.length ? (await listTransactions(actor, { accountId: selected?.id, page: 1, pageSize: 6 })).items : [];
  const balance = selected ? selected.balance : accs.reduce((s, a) => s + a.balance, 0);

  return {
    accounts: accs.map((a) => accountDTO(a, settings)),
    selectedAccountId: selected?.id ?? "all",
    stats: { totalBalance: toMajor(balance), totalDeposits: toMajor(Number(totals.deposits)), totalWithdrawals: toMajor(Number(totals.withdrawals)), accountCount: accs.length, activeLoans: activeLoans.length },
    recentTransactions: recent,
    activeLoans: activeLoans.map((l) => {
      const s = loanRows.find((x) => x.loan_id === l.id);
      return { id: l.id, loanNumber: l.loanNumber, type: l.type, approvedAmount: toMajor(l.approvedAmount ?? l.requestedAmount), emi: toMajor(l.emi ?? 0), remainingBalance: toMajor(Number(s?.remaining ?? 0)), nextDueDate: s?.next_due ?? null };
    }),
    charts: {
      monthlySpending: months.map((x) => ({ month: x.label, spending: toMajor(m.get(x.key)!.spending) })),
      monthlyDeposits: months.map((x) => ({ month: x.label, deposits: toMajor(m.get(x.key)!.deposits), received: toMajor(m.get(x.key)!.received) })),
      distribution: [...typeAgg.entries()].map(([type, v]) => ({ type, count: v.count, amount: toMajor(v.amount) })),
    },
  };
}
