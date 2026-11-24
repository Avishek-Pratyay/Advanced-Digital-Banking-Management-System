"use client";
import { Landmark, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LOAN_STATUSES, label, type Role } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { useListLoansQuery } from "@/store/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setLoanFilter } from "@/store/slices/loanSlice";
import { Card, EmptyState, ErrorState, Money, Pagination, Select, StatusBadge, TableShell, TableSkeleton } from "../ui";

const base = (role: Role) => (role === "CUSTOMER" ? "/customer" : role === "STAFF" ? "/staff" : "/admin");
const d = (x: string | Date) => new Date(x).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

/** Loan list for all roles. Filter + page state lives in the Redux `loans` slice. */
export function LoanList({ role }: { role: Role }) {
  const f = useAppSelector((s) => s.loans);
  const dispatch = useAppDispatch();
  const [q, setQ] = useState(f.search);
  useEffect(() => { const h = setTimeout(() => q !== f.search && dispatch(setLoanFilter({ search: q })), 350); return () => clearTimeout(h); }, [q, f.search, dispatch]);
  const { data, isLoading, isFetching, isError, refetch } = useListLoansQuery({ status: f.statusFilter || undefined, q: f.search || undefined, page: f.page, pageSize: 10 });
  const staff = role !== "CUSTOMER";
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <Select aria-label="Status" value={f.statusFilter} onChange={(e) => dispatch(setLoanFilter({ statusFilter: e.target.value as typeof f.statusFilter }))} wrapperClassName="w-full sm:w-52">
          <option value="">All statuses</option>{LOAN_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
        {staff && <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3.5 top-[13px] size-4 text-muted" /><input aria-label="Search loans" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search loan number or customer…" className="input pl-10" /></div>}
      </div>
      {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <TableSkeleton cols={6} /> : !data?.items.length ? (
        <EmptyState icon={<Landmark />} title="No loans found" description={staff ? "Applications will appear here." : "Apply for a loan to get started."} />
      ) : (
        <>
          <div className="hidden md:block"><TableShell>
            <thead><tr className="border-b border-border bg-surface-2/60"><th className="th">Loan</th>{staff && <th className="th">Customer</th>}<th className="th">Type</th><th className="th text-right">Amount</th><th className="th text-right">EMI</th><th className="th">Applied</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y divide-border">{data.items.map((l) => (
              <tr key={l.id} className="transition hover:bg-surface-2/70">
                <td className="td"><Link href={`${base(role)}/loans/${l.id}`} className="font-mono text-[12.5px] font-semibold text-primary hover:underline">{l.loanNumber}</Link><p className="text-xs text-muted">{l.durationMonths} months · {l.interestRate}%</p></td>
                {staff && <td className="td text-[13px] font-medium">{l.borrower?.name}</td>}
                <td className="td text-[13px]">{label(l.type)}</td>
                <td className="td text-right font-semibold"><Money value={l.approvedAmount ?? l.requestedAmount} /></td>
                <td className="td tabular text-right text-[13px] text-muted">{formatMoney(l.emi)}</td>
                <td className="td whitespace-nowrap text-[13px] text-muted">{d(l.createdAt)}</td>
                <td className="td"><StatusBadge status={l.status} /></td>
              </tr>))}</tbody></TableShell></div>
          <ul className="divide-y divide-border md:hidden">{data.items.map((l) => (
            <li key={l.id}><Link href={`${base(role)}/loans/${l.id}`} className="block space-y-1.5 p-4"><div className="flex items-center justify-between"><span className="font-mono text-[12.5px] font-semibold">{l.loanNumber}</span><StatusBadge status={l.status} /></div><p className="text-sm">{label(l.type)} loan{staff && <> · {l.borrower?.name}</>}</p><p className="tabular text-lg font-semibold"><Money value={l.approvedAmount ?? l.requestedAmount} /></p></Link></li>
          ))}</ul>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} loading={isFetching} onPage={(p) => dispatch(setLoanFilter({ page: p }))} />
        </>
      )}
    </Card>
  );
}
