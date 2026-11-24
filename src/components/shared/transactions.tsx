"use client";
import { ArrowDownLeft, ArrowUpRight, Download, Flag, RotateCcw, Search, ShieldAlert, X, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { label } from "@/lib/constants";
import { TXN_STATUSES, TXN_TYPES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { downloadReceipt } from "@/lib/pdf";
import { toApiError } from "@/lib/forms";
import { useFlagTransactionMutation, useGetTransactionQuery, useListAccountsQuery, useListTransactionsQuery, useReverseTransactionMutation } from "@/store/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { openTransaction, resetTxnFilters, setTxnFilters, type TxnFilters } from "@/store/slices/transactionSlice";
import { pushToast } from "@/store/slices/uiSlice";
import type { Role } from "@/lib/constants";
import type { TxnItem } from "@/types/api";
import { Badge, Button, Card, ConfirmDialog, DataRow, EmptyState, ErrorState, Input, Modal, Money, Pagination, Select, Skeleton, StatusBadge, TableShell, TableSkeleton } from "../ui";

export function CopyText({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch {} }} title="Copy" className={cn("inline-flex items-center gap-1.5 font-mono text-[12.5px] hover:text-primary", className)}>
      {text}
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 opacity-50" />}
    </button>
  );
}

const when = (d: string | Date) => new Date(d).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const shortDate = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

function Party({ p }: { p: TxnItem["sender"] }) {
  if (!p) return <span className="text-muted">—</span>;
  return (
    <span className="block min-w-0 leading-tight">
      <span className="block truncate text-[13px] font-medium">{p.ownerName}</span>
      <span className="font-mono text-[11.5px] text-muted">•••• {p.accountNumber.slice(-4)}</span>
    </span>
  );
}

function TypeIcon({ t }: { t: TxnItem }) {
  const inbound = t.direction === "IN";
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", inbound ? "bg-success-soft text-success" : "bg-primary-soft text-primary")}>
      {inbound ? <ArrowDownLeft className="size-[18px]" /> : <ArrowUpRight className="size-[18px]" />}
    </span>
  );
}

/** Reusable transaction table (desktop) / list (mobile). `viewer` controls amount sign + visible columns. */
export function TransactionTable({ items, loading, error, onRetry, viewer, onOpen, compact }: { items?: TxnItem[]; loading?: boolean; error?: boolean; onRetry?: () => void; viewer: Role; onOpen: (id: string) => void; compact?: boolean }) {
  if (error) return <ErrorState onRetry={onRetry} />;
  if (loading) return <TableSkeleton rows={compact ? 4 : 8} cols={5} />;
  if (!items?.length) return <EmptyState icon={<Search />} title="No transactions found" description="Try changing the filters or the date range." />;
  const customer = viewer === "CUSTOMER";
  return (
    <>
      <div className="hidden md:block">
        <TableShell>
          <thead>
            <tr className="border-b border-border bg-surface-2/60">
              <th className="th">Date</th>
              <th className="th">Transaction</th>
              <th className="th">Type</th>
              <th className="th">{customer ? "Counterparty" : "From → To"}</th>
              <th className="th text-right">Amount</th>
              {!compact && <th className="th text-right">Fee</th>}
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((t) => {
              const other = t.direction === "IN" ? t.sender : t.receiver;
              return (
                <tr key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer transition hover:bg-surface-2/70">
                  <td className="td whitespace-nowrap text-[13px] text-muted">{shortDate(t.createdAt)}</td>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      {customer && <TypeIcon t={t} />}
                      <div className="min-w-0">
                        <p className="font-mono text-[12.5px] font-medium">{t.txnId}</p>
                        <p className="max-w-[220px] truncate text-xs text-muted">{t.description || "—"}</p>
                      </div>
                      {t.flagged && <ShieldAlert className="size-4 shrink-0 text-warning" aria-label="Flagged" />}
                    </div>
                  </td>
                  <td className="td text-[13px]">{label(t.type)}</td>
                  <td className="td">
                    {customer ? (
                      <Party p={other ?? (t.direction === "IN" ? t.receiver : t.sender)} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Party p={t.sender} />
                        <span className="text-muted">→</span>
                        <Party p={t.receiver} />
                      </div>
                    )}
                  </td>
                  <td className="td text-right font-semibold">
                    <Money value={t.amount} sign={customer ? (t.direction === "INTERNAL" ? null : t.direction) : null} />
                  </td>
                  {!compact && <td className="td tabular text-right text-[13px] text-muted">{t.fee ? formatMoney(t.fee) : "—"}</td>}
                  <td className="td"><StatusBadge status={t.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {items.map((t) => (
          <li key={t.id}>
            <button onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2">
              <TypeIcon t={t} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold">{label(t.type)} {t.flagged && <ShieldAlert className="size-3.5 text-warning" />}</span>
                <span className="block truncate text-xs text-muted">{t.description || t.txnId}</span>
                <span className="mt-1 flex items-center gap-2 text-[11px] text-muted">{shortDate(t.createdAt)} <StatusBadge status={t.status} /></span>
              </span>
              <Money value={t.amount} sign={customer ? (t.direction === "INTERNAL" ? null : t.direction) : null} className="text-sm font-semibold" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Filter bar bound to the Redux `transactions` slice. */
export function TransactionFilters({ showAccount, showFlagged }: { showAccount?: boolean; showFlagged?: boolean }) {
  const f = useAppSelector((s) => s.transactions.filters);
  const dispatch = useAppDispatch();
  const [q, setQ] = useState(f.q);
  const accounts = useListAccountsQuery({ pageSize: 50 }, { skip: !showAccount });
  useEffect(() => { setQ(f.q); }, [f.q]);
  useEffect(() => {
    if (q === f.q) return;
    const h = setTimeout(() => dispatch(setTxnFilters({ q })), 350);
    return () => clearTimeout(h);
  }, [q, f.q, dispatch]);
  const set = (p: Partial<TxnFilters>) => dispatch(setTxnFilters(p));
  const active = !!(f.q || f.type || f.status || f.from || f.to || f.accountId || f.flagged);
  return (
    <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-6">
      <div className="relative sm:col-span-2 lg:col-span-2">
        <Search className="pointer-events-none absolute left-3.5 top-[13px] size-4 text-muted" />
        <input aria-label="Search by transaction ID" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by transaction ID…" className="input pl-10" />
      </div>
      <Select aria-label="Type" value={f.type} onChange={(e) => set({ type: e.target.value as TxnFilters["type"] })}>
        <option value="">All types</option>
        {TXN_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
      </Select>
      <Select aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value as TxnFilters["status"] })}>
        <option value="">All statuses</option>
        {TXN_STATUSES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
      </Select>
      <Input aria-label="From date" type="date" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} />
      <Input aria-label="To date" type="date" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} />
      {showAccount && (
        <Select aria-label="Account" value={f.accountId} onChange={(e) => set({ accountId: e.target.value })} wrapperClassName="lg:col-span-2">
          <option value="">All my accounts</option>
          {accounts.data?.items.map((a) => <option key={a.id} value={a.id}>{label(a.type)} ••{a.accountNumber.slice(-4)}</option>)}
        </Select>
      )}
      {showFlagged && (
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={f.flagged === "true"} onChange={(e) => set({ flagged: e.target.checked ? "true" : "" })} className="size-4 accent-[rgb(var(--primary))]" /> Flagged only</label>
      )}
      {active && <Button variant="ghost" size="md" icon={<X className="size-4" />} onClick={() => dispatch(resetTxnFilters())} className="justify-self-start">Clear filters</Button>}
    </div>
  );
}

/** Full paginated transaction history card used by all three roles. */
export function TransactionHistory({ viewer, userId, fixedAccountId, title = "Transaction history", showFlagged }: { viewer: Role; userId?: string; fixedAccountId?: string; title?: string; showFlagged?: boolean }) {
  const f = useAppSelector((s) => s.transactions.filters);
  const dispatch = useAppDispatch();
  const args = { ...f, accountId: fixedAccountId ?? f.accountId, userId, q: f.q || undefined };
  const { data, isFetching, isLoading, isError, refetch } = useListTransactionsQuery(args, { refetchOnMountOrArgChange: true });
  // reset filters when the view mounts so one page's filters never leak into another
  useEffect(() => { dispatch(resetTxnFilters()); return () => { dispatch(resetTxnFilters()); }; }, [dispatch]);
  return (
    <>
      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-5"><h3 className="text-[15px] font-semibold">{title}</h3>{isFetching && !isLoading && <span className="text-xs text-muted">Updating…</span>}</div>
        <TransactionFilters showAccount={viewer === "CUSTOMER" && !fixedAccountId} showFlagged={showFlagged} />
        <TransactionTable items={data?.items} loading={isLoading} error={isError} onRetry={refetch} viewer={viewer} onOpen={(id) => dispatch(openTransaction(id))} />
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} loading={isFetching} onPage={(p) => dispatch(setTxnFilters({ page: p }))} />}
      </Card>
      <TransactionDetailModal viewer={viewer} />
    </>
  );
}

/** Details drawer: ledger entries, flags, PDF receipt, staff flagging and admin reversal. */
export function TransactionDetailModal({ viewer }: { viewer: Role }) {
  const id = useAppSelector((s) => s.transactions.selectedId);
  const dispatch = useAppDispatch();
  const close = () => dispatch(openTransaction(null));
  const { data: t, isLoading, isError } = useGetTransactionQuery(id!, { skip: !id });
  const [flag, flagState] = useFlagTransactionMutation();
  const [reverse, reverseState] = useReverseTransactionMutation();
  const [dialog, setDialog] = useState<"flag" | "reverse" | null>(null);
  const [busy, setBusy] = useState(false);
  const staff = viewer !== "CUSTOMER";

  const receipt = async () => {
    if (!t) return;
    setBusy(true);
    try { await downloadReceipt(t); } finally { setBusy(false); }
  };
  return (
    <>
      <Modal open={!!id} onClose={close} title="Transaction details" size="lg" footer={t && (
        <>
          {staff && <Button variant="secondary" icon={<Flag className="size-4" />} onClick={() => setDialog("flag")}>Flag as suspicious</Button>}
          {viewer === "ADMIN" && t.type === "TRANSFER" && t.status === "COMPLETED" && !t.reversalOfId && <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => setDialog("reverse")}>Reverse</Button>}
          <Button icon={<Download className="size-4" />} loading={busy} onClick={receipt}>Download receipt</Button>
        </>
      )}>
        {isLoading && <div className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-40" /></div>}
        {isError && <ErrorState message="This transaction could not be loaded." />}
        {t && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">{label(t.type)}</p>
                <p className="tabular mt-1 text-3xl font-semibold tracking-tight"><Money value={t.amount} /></p>
              </div>
              <StatusBadge status={t.status} />
            </div>
            {t.failureReason && <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{t.failureReason}</div>}
            <dl className="rounded-xl border border-border px-4">
              <DataRow label="Transaction ID"><CopyText text={t.txnId} /></DataRow>
              <DataRow label="Reference code" mono>VL-{t.reference}</DataRow>
              <DataRow label="Date">{when(t.createdAt)}</DataRow>
              <DataRow label="From">{t.sender ? <>{t.sender.ownerName} <span className="font-mono text-xs text-muted">{t.sender.accountNumber}</span></> : "—"}</DataRow>
              <DataRow label="To">{t.receiver ? <>{t.receiver.ownerName} <span className="font-mono text-xs text-muted">{t.receiver.accountNumber}</span></> : "—"}</DataRow>
              <DataRow label="Fee">{formatMoney(t.fee)}</DataRow>
              {t.sender && <DataRow label="Total debited">{formatMoney(t.total)}</DataRow>}
              <DataRow label="Description">{t.description || "—"}</DataRow>
            </dl>
            {t.ledger.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Ledger entries</h4>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm"><thead><tr className="bg-surface-2/60"><th className="th">Account</th><th className="th">Entry</th><th className="th text-right">Amount</th><th className="th text-right">Balance after</th></tr></thead>
                    <tbody className="divide-y divide-border">{t.ledger.map((l) => (
                      <tr key={l.id}><td className="td font-mono text-[12.5px]">{l.accountNumber}</td><td className="td"><Badge tone={l.direction === "CREDIT" ? "success" : "neutral"}>{l.direction === "CREDIT" ? "Credit" : "Debit"}</Badge></td><td className="td tabular text-right">{formatMoney(l.amount)}</td><td className="td tabular text-right">{formatMoney(l.balanceAfter)}</td></tr>
                    ))}</tbody></table>
                </div>
              </div>
            )}
            {staff && t.flags.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Review flags</h4>
                <ul className="space-y-2">{t.flags.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm"><span><Badge tone={f.source === "SYSTEM" ? "accent" : "info"} className="mr-2">{f.source === "SYSTEM" ? "Auto" : "Staff"}</Badge>{f.reason}</span><StatusBadge status={f.status} /></li>
                ))}</ul>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog open={dialog === "flag"} onClose={() => setDialog(null)} title="Flag this transaction" description="It will be sent to administrators for review." confirmLabel="Flag transaction" reasonLabel="Why does it look suspicious?" reasonRequired loading={flagState.isLoading}
        onConfirm={async (reason) => { try { await flag({ id: t!.id, reason }).unwrap(); dispatch(pushToast({ kind: "success", title: "Flagged for admin review" })); setDialog(null); } catch (e) { dispatch(pushToast({ kind: "error", title: "Could not flag", message: toApiError(e).message })); } }} />
      <ConfirmDialog open={dialog === "reverse"} onClose={() => setDialog(null)} tone="danger" title="Reverse this transfer?" description="Funds (and the fee) are returned to the sender and taken back from the recipient. The original record is preserved." confirmLabel="Reverse transfer" reasonLabel="Reason for reversal" reasonRequired loading={reverseState.isLoading}
        onConfirm={async (reason) => { try { await reverse({ id: t!.id, reason }).unwrap(); dispatch(pushToast({ kind: "success", title: "Transfer reversed" })); setDialog(null); } catch (e) { dispatch(pushToast({ kind: "error", title: "Reversal failed", message: toApiError(e).message })); setDialog(null); } }} />
    </>
  );
}
