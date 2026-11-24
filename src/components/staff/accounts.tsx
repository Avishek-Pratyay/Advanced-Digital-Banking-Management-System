"use client";
import { Pencil, Search, Snowflake, Sun, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { ACCOUNT_STATUSES, ACCOUNT_TYPES, label, type Role } from "@/lib/constants";
import { toApiError } from "@/lib/forms";
import { useListAccountsQuery, useUpdateAccountMutation } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { pushToast } from "@/store/slices/uiSlice";
import type { AccountDTO } from "@/types/api";
import { Button, Card, ConfirmDialog, DataRow, EmptyState, ErrorState, Input, Modal, Money, Pagination, Select, StatusBadge, TableShell, TableSkeleton } from "../ui";
import Link from "next/link";

export function AccountManager({ role }: { role: Role }) {
  const admin = role === "ADMIN";
  const dispatch = useAppDispatch();
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  const [status, setStatus] = useState(""); const [type, setType] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const h = setTimeout(() => { setDq(q); setPage(1); }, 350); return () => clearTimeout(h); }, [q]);
  const { data, isLoading, isFetching, isError, refetch } = useListAccountsQuery({ q: dq || undefined, status: status || undefined, type: type || undefined, page, pageSize: 10 });
  const [update, state] = useUpdateAccountMutation();
  const [edit, setEdit] = useState<AccountDTO | null>(null);
  const [toggle, setToggle] = useState<AccountDTO | null>(null);
  const base = admin ? "/admin" : "/staff";

  return (
    <>
      <Card padded={false}>
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
          <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-[13px] size-4 text-muted" /><input aria-label="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search account no., owner, email…" className="input pl-10" /></div>
          <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select aria-label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">All types</option>{ACCOUNT_TYPES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </div>
        {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <TableSkeleton cols={6} /> : !data?.items.length ? <EmptyState icon={<Wallet />} title="No accounts found" /> : (
          <>
            <TableShell>
              <thead><tr className="border-b border-border bg-surface-2/60"><th className="th">Account</th><th className="th">Owner</th><th className="th">Type</th><th className="th text-right">Balance</th><th className="th text-right">Daily / single limit</th><th className="th">Status</th>{admin && <th className="th text-right">Actions</th>}</tr></thead>
              <tbody className="divide-y divide-border">{data.items.map((a) => (
                <tr key={a.id}>
                  <td className="td"><p className="font-mono text-[12.5px] font-semibold">{a.accountNumber}</p>{a.nickname && <p className="text-xs text-muted">{a.nickname}</p>}</td>
                  <td className="td text-[13px]">{a.owner ? <Link className="font-medium hover:text-primary" href={`${base}/customers/${a.owner.id}`}>{a.owner.name}</Link> : "—"}<p className="text-xs text-muted">{a.owner?.customerNumber}</p></td>
                  <td className="td text-[13px]">{label(a.type)}</td>
                  <td className="td text-right font-semibold"><Money value={a.balance} /></td>
                  <td className="td tabular text-right text-[12.5px] text-muted"><Money value={a.effectiveLimits.daily} /> / <Money value={a.effectiveLimits.single} />{(a.dailyTransferLimit !== null || a.maxTransactionAmount !== null) && <span className="ml-1 text-accent" title="Custom limit">●</span>}</td>
                  <td className="td"><StatusBadge status={a.status} /></td>
                  {admin && <td className="td text-right"><div className="flex justify-end gap-1.5">
                    {a.status !== "CLOSED" && <Button size="sm" variant="secondary" icon={a.status === "FROZEN" ? <Sun className="size-4" /> : <Snowflake className="size-4" />} onClick={() => setToggle(a)}>{a.status === "FROZEN" ? "Unfreeze" : "Freeze"}</Button>}
                    <Button size="sm" variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEdit(a)}>Edit</Button></div></td>}
                </tr>))}</tbody>
            </TableShell>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} loading={isFetching} onPage={setPage} />
          </>
        )}
      </Card>
      <ConfirmDialog open={!!toggle} onClose={() => setToggle(null)} loading={state.isLoading} tone={toggle?.status === "FROZEN" ? "primary" : "danger"} title={toggle?.status === "FROZEN" ? "Unfreeze account" : "Freeze account"} confirmLabel={toggle?.status === "FROZEN" ? "Unfreeze" : "Freeze account"}
        description={toggle?.status === "FROZEN" ? "The account can send and receive funds again." : "No money can leave or enter this account until it is unfrozen. The customer is notified."}
        onConfirm={async () => { try { await update({ id: toggle!.id, status: toggle!.status === "FROZEN" ? "ACTIVE" : "FROZEN" }).unwrap(); dispatch(pushToast({ kind: "success", title: toggle!.status === "FROZEN" ? "Account unfrozen" : "Account frozen" })); } catch (e) { dispatch(pushToast({ kind: "error", title: "Failed", message: toApiError(e).message })); } setToggle(null); }} />
      {edit && <EditAccountModal account={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function EditAccountModal({ account: a, onClose }: { account: AccountDTO; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [update, { isLoading }] = useUpdateAccountMutation();
  const [type, setType] = useState<string>(a.type);
  const [nick, setNick] = useState(a.nickname ?? "");
  const [status, setStatus] = useState<string>(a.status);
  const [daily, setDaily] = useState(a.dailyTransferLimit?.toString() ?? "");
  const [single, setSingle] = useState(a.maxTransactionAmount?.toString() ?? "");
  const [min, setMin] = useState(a.minBalance?.toString() ?? "");
  const [err, setErr] = useState<string | null>(null);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return (
    <Modal open onClose={onClose} size="lg" title="Update account" description={a.accountNumber} dismissible={!isLoading}
      footer={<><Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button><Button loading={isLoading} onClick={async () => {
        setErr(null);
        try { await update({ id: a.id, type, nickname: nick || null, status, dailyTransferLimit: num(daily), maxTransactionAmount: num(single), minBalance: num(min) }).unwrap(); dispatch(pushToast({ kind: "success", title: "Account updated" })); onClose(); }
        catch (e) { setErr(toApiError(e).message); }
      }}>Save changes</Button></>}>
      <div className="space-y-5">
        {err && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{err}</div>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>{ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} disabled={a.status === "CLOSED"}>{ACCOUNT_STATUSES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
          <Input label="Nickname" value={nick} maxLength={40} onChange={(e) => setNick(e.target.value)} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Transaction limits for this account</p>
          <p className="mb-3 text-xs text-muted">Leave empty to use the bank-wide default (daily {a.effectiveLimits.daily}, single {a.effectiveLimits.single}).</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Daily transfer limit ($)" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="Default" />
            <Input label="Max single transaction ($)" inputMode="decimal" value={single} onChange={(e) => setSingle(e.target.value)} placeholder="Default" />
            <Input label="Minimum balance ($)" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Default" />
          </div>
        </div>
        <dl className="rounded-xl border border-border px-4"><DataRow label="Current balance"><Money value={a.balance} /></DataRow><DataRow label="Owner">{a.owner?.name}</DataRow></dl>
      </div>
    </Modal>
  );
}
