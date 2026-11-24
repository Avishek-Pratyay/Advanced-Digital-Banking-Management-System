"use client";
import { Check, ClipboardList, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { label } from "@/lib/constants";
import { toApiError } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { useListRequestsQuery, useReviewRequestMutation } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { pushToast } from "@/store/slices/uiSlice";
import type { FundRequestItem } from "@/types/api";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Money, Pagination, Segmented, StatusBadge, TableShell, TableSkeleton } from "../ui";

const date = (d: string | Date) => new Date(d).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
type Status = "" | "PENDING" | "APPROVED" | "REJECTED";

/** Customer history (read-only) and staff/admin review queue share this table. */
export function RequestsList({ mode, initialStatus = "" }: { mode: "customer" | "review"; initialStatus?: Status }) {
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [type, setType] = useState<"" | "DEPOSIT" | "WITHDRAWAL">("");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const h = setTimeout(() => { setDq(q); setPage(1); }, 350); return () => clearTimeout(h); }, [q]);
  const { data, isLoading, isFetching, isError, refetch } = useListRequestsQuery({ status: status || undefined, type: type || undefined, q: dq || undefined, page, pageSize: 10 });
  const [review, state] = useReviewRequestMutation();
  const [target, setTarget] = useState<{ r: FundRequestItem; action: "approve" | "reject" } | null>(null);
  const reviewMode = mode === "review";

  const confirm = async (note: string) => {
    if (!target) return;
    try {
      await review({ id: target.r.id, action: target.action, note: note || undefined }).unwrap();
      dispatch(pushToast({ kind: "success", title: `Request ${target.action === "approve" ? "approved" : "rejected"}`, message: target.r.requestNumber }));
      setTarget(null);
    } catch (e) {
      dispatch(pushToast({ kind: "error", title: "Could not complete review", message: toApiError(e).message }));
      setTarget(null);
    }
  };

  return (
    <>
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <Segmented<Status> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "All" }, { value: "PENDING", label: "Pending" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }]} className="self-start" />
          <div className="flex flex-wrap gap-2">
            <select aria-label="Request type" value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(1); }} className="input w-auto">
              <option value="">Deposits & withdrawals</option><option value="DEPOSIT">Deposits</option><option value="WITHDRAWAL">Withdrawals</option>
            </select>
            {reviewMode && (
              <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-[13px] size-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer / request…" aria-label="Search requests" className="input w-full pl-10 sm:w-64" /></div>
            )}
          </div>
        </div>
        {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <TableSkeleton cols={6} /> : !data?.items.length ? (
          <EmptyState icon={<ClipboardList />} title={status === "PENDING" ? "Nothing waiting for review" : "No requests found"} description={reviewMode ? "New customer requests will show up here." : "Submit a deposit or withdrawal request and track it here."} />
        ) : (
          <>
            <div className="hidden md:block">
              <TableShell>
                <thead><tr className="border-b border-border bg-surface-2/60">
                  <th className="th">Request</th>{reviewMode && <th className="th">Customer</th>}<th className="th">Account</th><th className="th">Type</th><th className="th text-right">Amount</th><th className="th">Request date</th><th className="th">Status</th>{reviewMode && <th className="th text-right">Actions</th>}
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="td"><p className="font-mono text-[12.5px] font-medium">{r.requestNumber}</p><p className="max-w-[200px] truncate text-xs text-muted">{r.description || "—"}</p></td>
                      {reviewMode && <td className="td text-[13px] font-medium">{r.customer?.name}</td>}
                      <td className="td"><p className="font-mono text-[12.5px]">••{r.account.accountNumber.slice(-4)}</p><p className="text-xs text-muted">{label(r.account.type)}{r.account.balance !== undefined && <> · bal {formatMoney(r.account.balance)}</>}</p></td>
                      <td className="td"><Badge tone={r.type === "DEPOSIT" ? "success" : "accent"}>{label(r.type)}</Badge></td>
                      <td className="td text-right font-semibold"><Money value={r.amount} /></td>
                      <td className="td whitespace-nowrap text-[13px] text-muted">{date(r.requestDate)}</td>
                      <td className="td"><StatusBadge status={r.status} />{r.reviewNote && <p className="mt-1 max-w-[180px] text-xs text-muted">{r.reviewNote}</p>}</td>
                      {reviewMode && (
                        <td className="td text-right">{r.status === "PENDING" ? (
                          <div className="flex justify-end gap-1.5"><Button size="sm" variant="secondary" icon={<X className="size-4" />} onClick={() => setTarget({ r, action: "reject" })}>Reject</Button><Button size="sm" icon={<Check className="size-4" />} onClick={() => setTarget({ r, action: "approve" })}>Approve</Button></div>
                        ) : <span className="text-xs text-muted">{r.reviewedBy ?? "—"}</span>}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {data.items.map((r) => (
                <li key={r.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between"><Badge tone={r.type === "DEPOSIT" ? "success" : "accent"}>{label(r.type)}</Badge><StatusBadge status={r.status} /></div>
                  <p className="tabular text-xl font-semibold"><Money value={r.amount} /></p>
                  <p className="text-xs text-muted">{reviewMode && <>{r.customer?.name} · </>}••{r.account.accountNumber.slice(-4)} · {date(r.requestDate)}</p>
                  {r.description && <p className="text-[13px]">{r.description}</p>}
                  {reviewMode && r.status === "PENDING" && <div className="flex gap-2 pt-1"><Button size="sm" variant="secondary" className="flex-1" onClick={() => setTarget({ r, action: "reject" })}>Reject</Button><Button size="sm" className="flex-1" onClick={() => setTarget({ r, action: "approve" })}>Approve</Button></div>}
                </li>
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={setPage} loading={isFetching} />
          </>
        )}
      </Card>
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} loading={state.isLoading} tone={target?.action === "reject" ? "danger" : "primary"}
        title={target?.action === "approve" ? "Approve request" : "Reject request"} confirmLabel={target?.action === "approve" ? "Approve & post" : "Reject request"}
        description={target && <>{target.action === "approve" ? "The ledger and account balance will be updated immediately." : "The customer will be notified."} <b className="text-ink">{label(target.r.type)} of {formatMoney(target.r.amount)}</b> for {target.r.customer?.name} (••{target.r.account.accountNumber.slice(-4)}).</>}
        reasonLabel={target?.action === "reject" ? "Reason (shown to the customer)" : "Note (optional)"} reasonRequired={target?.action === "reject"} onConfirm={confirm} />
    </>
  );
}
