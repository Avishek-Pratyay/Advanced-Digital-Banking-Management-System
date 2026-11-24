"use client";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Flag, Landmark, ReceiptText, ShieldCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { ActivityLineChart, DepositWithdrawalChart, DonutChart, SimpleBarChart, VolumeAreaChart } from "../charts";
import { TransactionDetailModal, TransactionTable } from "../shared/transactions";
import { Card, CardHeader, ErrorState, Money, PageHeader, Skeleton, StatCard } from "../ui";
import { useAdminDashboardQuery, useStaffDashboardQuery } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { openTransaction } from "@/store/slices/transactionSlice";
import type { Role } from "@/lib/constants";

export function AdminDashboardView() {
  const dispatch = useAppDispatch();
  const { data, isLoading, isError, refetch } = useAdminDashboardQuery(undefined, { pollingInterval: 60_000 });
  if (isError) return <ErrorState onRetry={refetch} />;
  const s = data?.stats;
  return (
    <>
      <PageHeader title="Bank overview" description="Live figures computed from the ledger, accounts and loan book." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={isLoading} label="Registered customers" value={s?.totalCustomers} icon={<Users />} />
        <StatCard loading={isLoading} label="Bank accounts" value={s?.totalAccounts} icon={<Wallet />} tone="info" />
        <StatCard loading={isLoading} label="Total bank balance" value={<Money value={s?.totalBalance} />} icon={<ShieldCheck />} tone="accent" />
        <StatCard loading={isLoading} label="Pending loan applications" value={s?.pendingLoans} icon={<Landmark />} tone="warning" hint="Awaiting a decision" />
        <StatCard loading={isLoading} label="Total deposits" value={<Money value={s?.totalDeposits} />} icon={<ArrowDownToLine />} tone="success" />
        <StatCard loading={isLoading} label="Total withdrawals" value={<Money value={s?.totalWithdrawals} />} icon={<ArrowUpFromLine />} tone="danger" />
        <StatCard loading={isLoading} label="Total transactions" value={s?.totalTransactions} icon={<ReceiptText />} />
        <Link href="/admin/flags" className="block"><StatCard loading={isLoading} label="Open flags" value={s?.openFlags} icon={<Flag />} tone="warning" hint={`${s?.pendingRequests ?? 0} requests waiting`} /></Link>
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card><CardHeader title="Monthly transaction volume" description="Completed transactions, last 12 months" />{isLoading ? <Skeleton className="h-[260px]" /> : <VolumeAreaChart data={data!.charts.monthlyVolume} />}</Card>
        <Card><CardHeader title="Deposits vs withdrawals" description="Monthly comparison" />{isLoading ? <Skeleton className="h-[260px]" /> : <DepositWithdrawalChart data={data!.charts.depositVsWithdrawal} />}</Card>
        <Card><CardHeader title="Account distribution" description="Balance held per account type" />{isLoading ? <Skeleton className="h-[260px]" /> : <DonutChart money data={data!.charts.accountDistribution.map((d) => ({ name: d.type, value: d.balance }))} centerLabel="total balance" />}</Card>
        <Card><CardHeader title="Loan approval statistics" description="Applications by status" />{isLoading ? <Skeleton className="h-[260px]" /> : <SimpleBarChart horizontal money={false} data={data!.charts.loanApprovals as unknown as Record<string, string | number>[]} xKey="status" yKey="count" names={{ count: "Loans" }} />}</Card>
      </div>
      <Card className="mb-5"><CardHeader title="Monthly banking activity" description="Transactions, new accounts and new customers" />{isLoading ? <Skeleton className="h-[260px]" /> : <ActivityLineChart data={data!.charts.monthlyActivity} />}</Card>
      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-5"><h3 className="text-[15px] font-semibold">Latest transactions</h3><Link href="/admin/transactions" className="text-[13px] font-medium text-primary hover:underline">View all</Link></div>
        <div className="mt-3"><TransactionTable compact viewer="ADMIN" items={data?.recentTransactions} loading={isLoading} onOpen={(id) => dispatch(openTransaction(id))} /></div>
      </Card>
      <TransactionDetailModal viewer="ADMIN" />
    </>
  );
}

export function StaffDashboardView({ role = "STAFF" }: { role?: Role }) {
  const dispatch = useAppDispatch();
  const { data, isLoading, isError, refetch } = useStaffDashboardQuery(undefined, { pollingInterval: 60_000 });
  if (isError) return <ErrorState onRetry={refetch} />;
  const s = data?.stats;
  return (
    <>
      <PageHeader title="Operations desk" description="Work through requests, applications and flagged items." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link href="/staff/requests"><StatCard loading={isLoading} label="Requests to review" value={s?.pendingRequests} icon={<ClipboardCheck />} tone="warning" hint="Deposits & withdrawals" /></Link>
        <Link href="/staff/loans"><StatCard loading={isLoading} label="Loans awaiting review" value={s?.loansToReview} icon={<Landmark />} tone="info" /></Link>
        <StatCard loading={isLoading} label="Pending transactions" value={s?.pendingTransactions} icon={<ReceiptText />} />
        <StatCard loading={isLoading} label="Customers" value={s?.totalCustomers} icon={<Users />} tone="success" />
        <Link href="/staff/customers"><StatCard loading={isLoading} label="Unverified customers" value={s?.unverifiedCustomers} icon={<ShieldCheck />} tone="accent" hint="Need identity checks" /></Link>
        <StatCard loading={isLoading} label="Open flags (admin queue)" value={s?.openFlags} icon={<Flag />} tone="danger" />
      </div>
      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-5"><h3 className="text-[15px] font-semibold">Latest transactions</h3><Link href="/staff/transactions" className="text-[13px] font-medium text-primary hover:underline">View all</Link></div>
        <div className="mt-3"><TransactionTable compact viewer={role} items={data?.recentTransactions} loading={isLoading} onOpen={(id) => dispatch(openTransaction(id))} /></div>
      </Card>
      <TransactionDetailModal viewer={role} />
    </>
  );
}
