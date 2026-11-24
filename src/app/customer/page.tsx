"use client";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Banknote, Landmark, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { AccountCard } from "@/components/shared/account-card";
import { TransactionDetailModal, TransactionTable } from "@/components/shared/transactions";
import { DepositHistoryChart, DonutChart, SimpleBarChart } from "@/components/charts";
import { Button, Card, CardHeader, DataRow, ErrorState, Money, PageHeader, Skeleton, StatCard, StatusBadge } from "@/components/ui";
import { label } from "@/lib/constants";
import { useCustomerDashboardQuery, useGetMeQuery } from "@/store/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccount } from "@/store/slices/accountSlice";
import { openTransaction } from "@/store/slices/transactionSlice";
import { cn } from "@/lib/cn";

export default function CustomerDashboard() {
  const dispatch = useAppDispatch();
  const selected = useAppSelector((s) => s.account.selectedAccountId);
  const { data: me } = useGetMeQuery();
  const { data, isLoading, isFetching, isError, refetch } = useCustomerDashboardQuery(selected === "all" ? undefined : selected);
  // fall back to "all" if the stored account no longer exists
  useEffect(() => { if (data && selected !== "all" && data.selectedAccountId === "all") dispatch(selectAccount("all")); }, [data, selected, dispatch]);

  if (isError) return <ErrorState onRetry={refetch} />;
  const accounts = data?.accounts ?? [];
  const current = selected === "all" ? null : accounts.find((a) => a.id === selected) ?? null;
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader title={`${greet}${me ? `, ${me.name.split(" ")[0]}` : ""}`} description="Here is what is happening across your accounts." actions={
        <>
          <Link href="/customer/requests"><Button variant="secondary" icon={<Banknote className="size-4" />}>Deposit / Withdraw</Button></Link>
          <Link href="/customer/transfer"><Button icon={<ArrowLeftRight className="size-4" />}>Send money</Button></Link>
        </>
      } />

      {/* account switcher */}
      {accounts.length > 1 && (
        <div role="tablist" aria-label="Switch account" className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "all", name: "All accounts" }, ...accounts.map((a) => ({ id: a.id, name: `${a.nickname || label(a.type)} ••${a.accountNumber.slice(-4)}` }))].map((x) => (
            <button key={x.id} role="tab" aria-selected={selected === x.id} onClick={() => dispatch(selectAccount(x.id))} className={cn("shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium transition", selected === x.id ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted hover:text-ink")}>{x.name}</button>
          ))}
        </div>
      )}

      <div className={cn("mb-5 grid gap-4 transition-opacity", isFetching && !isLoading && "opacity-70")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard loading={isLoading} label={current ? "Account balance" : "Total balance"} value={<Money value={data?.stats.totalBalance} />} hint={current ? label(current.type) : `${data?.stats.accountCount ?? 0} account(s)`} icon={<Wallet />} />
          <StatCard loading={isLoading} tone="success" label="Total deposits" value={<Money value={data?.stats.totalDeposits} />} hint="Completed deposits" icon={<ArrowDownToLine />} />
          <StatCard loading={isLoading} tone="accent" label="Total withdrawals" value={<Money value={data?.stats.totalWithdrawals} />} hint="Completed withdrawals" icon={<ArrowUpFromLine />} />
          <StatCard loading={isLoading} tone="info" label="Active loans" value={data?.stats.activeLoans ?? 0} hint={data?.activeLoans.length ? `Next EMI ${data.activeLoans[0].nextDueDate ?? "—"}` : "No active loans"} icon={<Landmark />} />
        </div>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {isLoading ? <Skeleton className="h-[188px] rounded-2xl" /> : current ? <AccountCard a={current} /> : accounts.slice(0, 2).map((a) => <AccountCard key={a.id} a={a} total={total} onClick={() => dispatch(selectAccount(a.id))} />)}
          {!isLoading && !accounts.length && <Card><p className="text-sm text-muted">You do not have an account yet. Please visit a branch or contact support.</p></Card>}
        </div>
        <Card className="lg:col-span-2">
          <CardHeader title="Account information" description={current ? "Details of the selected account" : "Select an account above for full details"} />
          {current ? (
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <div><DataRow label="Account number" mono>{current.accountNumber}</DataRow><DataRow label="Account type">{label(current.type)}</DataRow><DataRow label="Status"><StatusBadge status={current.status} /></DataRow></div>
              <div><DataRow label="Available balance"><Money value={current.availableBalance} /></DataRow><DataRow label="Daily transfer limit"><Money value={current.effectiveLimits.daily} /></DataRow><DataRow label="Per-transaction limit"><Money value={current.effectiveLimits.single} /></DataRow></div>
            </dl>
          ) : (
            <ul className="divide-y divide-border">
              {accounts.map((a) => (
                <li key={a.id}><button onClick={() => dispatch(selectAccount(a.id))} className="flex w-full items-center justify-between gap-3 py-3 text-left"><span><span className="block text-sm font-semibold">{a.nickname || `${label(a.type)} account`}</span><span className="font-mono text-xs text-muted">{a.accountNumber}</span></span><span className="flex items-center gap-3"><StatusBadge status={a.status} /><Money value={a.balance} className="font-semibold" /></span></button></li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <Card><CardHeader title="Monthly spending" description="Money going out, last 12 months" />{isLoading ? <Skeleton className="h-[260px]" /> : <SimpleBarChart data={data!.charts.monthlySpending} xKey="month" yKey="spending" color="accent" names={{ spending: "Spending" }} />}</Card>
        <Card><CardHeader title="Deposit history" description="Deposits and received transfers" />{isLoading ? <Skeleton className="h-[260px]" /> : <DepositHistoryChart data={data!.charts.monthlyDeposits} />}</Card>
        <Card><CardHeader title="Transaction distribution" description="By number of transactions" />{isLoading ? <Skeleton className="h-[260px]" /> : <DonutChart stack data={data!.charts.distribution.map((d) => ({ name: d.type, value: d.count }))} centerLabel="transactions" />}</Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5"><h3 className="text-[15px] font-semibold">Recent transactions</h3><Link href="/customer/transactions" className="text-[13px] font-medium text-primary hover:underline">View all</Link></div>
          <div className="mt-3"><TransactionTable compact items={data?.recentTransactions} loading={isLoading} viewer="CUSTOMER" onOpen={(id) => dispatch(openTransaction(id))} /></div>
        </Card>
        <Card>
          <CardHeader title="Active loans" action={<Link href="/customer/loans" className="text-[13px] font-medium text-primary hover:underline">Manage</Link>} />
          {isLoading ? <Skeleton className="h-24" /> : data!.activeLoans.length ? (
            <ul className="space-y-3">{data!.activeLoans.map((l) => (
              <li key={l.id}><Link href={`/customer/loans/${l.id}`} className="block rounded-xl border border-border p-3.5 transition hover:border-primary">
                <div className="flex items-center justify-between text-sm"><span className="font-semibold">{label(l.type)} loan</span><span className="font-mono text-xs text-muted">{l.loanNumber}</span></div>
                <p className="mt-2 text-xs text-muted">Remaining balance</p><p className="tabular text-lg font-semibold"><Money value={l.remainingBalance} /></p>
                <p className="mt-1 text-xs text-muted">EMI <b className="text-ink"><Money value={l.emi} /></b> · next due {l.nextDueDate ?? "—"}</p>
              </Link></li>
            ))}</ul>
          ) : <p className="text-sm text-muted">You have no active loans. <Link className="font-medium text-primary hover:underline" href="/customer/loans">Explore loan options</Link>.</p>}
        </Card>
      </div>
      <TransactionDetailModal viewer="CUSTOMER" />
    </>
  );
}
