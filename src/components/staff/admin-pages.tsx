"use client";
import { Flag, ShieldAlert, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { applyServerErrors, toApiError, zodForm } from "@/lib/forms";
import { label } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { createStaffSchema, settingsSchema } from "@/lib/validators";
import { useCreateStaffMutation, useGetSettingsQuery, useListAuditQuery, useListFlagsQuery, useListStaffQuery, useResolveFlagMutation, useSetStaffStatusMutation, useUpdateSettingsMutation } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { openTransaction } from "@/store/slices/transactionSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { TransactionDetailModal } from "../shared/transactions";
import { Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, ErrorState, Input, Modal, Money, Pagination, Segmented, Skeleton, StatusBadge, TableShell, TableSkeleton } from "../ui";

const dt = (x: string | Date | null) => (x ? new Date(x).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/* ----------------------------------------------------------- flagged queue */
export function FlagsView() {
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<"" | "OPEN" | "DISMISSED" | "CONFIRMED">("OPEN");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, refetch } = useListFlagsQuery({ status: status || undefined, page, pageSize: 10 });
  const [resolve, state] = useResolveFlagMutation();
  const [target, setTarget] = useState<{ id: string; action: "dismiss" | "confirm" } | null>(null);
  const [freeze, setFreeze] = useState(false);
  return (
    <>
      <Card padded={false}>
        <div className="border-b border-border p-4"><Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "OPEN", label: "Open" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "DISMISSED", label: "Dismissed" }, { value: "", label: "All" }]} /></div>
        {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <TableSkeleton cols={5} /> : !data?.items.length ? <EmptyState icon={<ShieldCheck />} title="No flagged transactions" description="Rule-based detection and staff reports appear here." /> : (
          <>
            <ul className="divide-y divide-border">
              {data.items.map((f) => (
                <li key={f.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={f.source === "SYSTEM" ? "accent" : "info"}>{f.source === "SYSTEM" ? "Auto-detected" : `Staff: ${f.raisedBy ?? ""}`}</Badge><StatusBadge status={f.status} /><span className="text-xs text-muted">{dt(f.createdAt)}</span></div>
                    <p className="flex items-start gap-2 text-sm font-medium"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />{f.reason}</p>
                    <button onClick={() => dispatch(openTransaction(f.transaction.id))} className="text-left text-[13px] text-muted hover:text-primary"><span className="font-mono font-medium text-ink">{f.transaction.txnId}</span> · {label(f.transaction.type)} · <Money value={f.transaction.amount} className="font-semibold text-ink" /> · {f.transaction.senderOwner ?? "—"} → {f.transaction.receiverOwner ?? "—"}</button>
                    {f.resolutionNote && <p className="text-xs text-muted">Resolution: {f.resolutionNote}</p>}
                  </div>
                  {f.status === "OPEN" && <div className="flex shrink-0 gap-2"><Button size="sm" variant="secondary" onClick={() => { setFreeze(false); setTarget({ id: f.id, action: "dismiss" }); }}>Dismiss</Button><Button size="sm" variant="danger" icon={<Flag className="size-4" />} onClick={() => { setFreeze(false); setTarget({ id: f.id, action: "confirm" }); }}>Confirm suspicious</Button></div>}
                </li>
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} loading={isFetching} onPage={setPage} />
          </>
        )}
      </Card>
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} loading={state.isLoading} tone={target?.action === "confirm" ? "danger" : "primary"} title={target?.action === "confirm" ? "Confirm as suspicious" : "Dismiss flag"} confirmLabel={target?.action === "confirm" ? "Confirm" : "Dismiss"} reasonLabel="Resolution note"
        onConfirm={async (note) => { try { await resolve({ id: target!.id, action: target!.action, note: note || undefined, freezeAccount: target!.action === "confirm" && freeze }).unwrap(); dispatch(pushToast({ kind: "success", title: "Flag resolved" })); } catch (e) { dispatch(pushToast({ kind: "error", title: "Failed", message: toApiError(e).message })); } setTarget(null); }}>
        {target?.action === "confirm" && <label className="mt-3 flex items-center gap-2.5 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} className="size-4 accent-[rgb(var(--primary))]" /> Also freeze the sender&apos;s account</label>}
      </ConfirmDialog>
      <TransactionDetailModal viewer="ADMIN" />
    </>
  );
}

/* --------------------------------------------------------------- staff admin */
type StaffIn = z.input<typeof createStaffSchema>;
export function StaffAdminView() {
  const dispatch = useAppDispatch();
  const { data, isLoading, isError, refetch } = useListStaffQuery();
  const [setStatus] = useSetStaffStatusMutation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card padded={false}>
        <div className="flex items-center justify-between border-b border-border p-4"><p className="text-sm text-muted">Bank employees can register customers and review requests, but cannot change bank-wide settings or approve loans.</p><Button icon={<UserCog className="size-4" />} onClick={() => setOpen(true)}>Add staff</Button></div>
        {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <TableSkeleton cols={4} /> : (
          <TableShell><thead><tr className="border-b border-border bg-surface-2/60"><th className="th">Employee</th><th className="th">Role</th><th className="th">Last login</th><th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">{data!.map((u) => (
              <tr key={u.id}><td className="td"><div className="flex items-center gap-3"><Avatar name={u.name} /><span><span className="block text-sm font-semibold">{u.name}</span><span className="text-xs text-muted">{u.email}</span></span></div></td>
                <td className="td"><Badge tone={u.role === "ADMIN" ? "accent" : "info"}>{label(u.role)}</Badge></td><td className="td text-[13px] text-muted">{dt(u.lastLoginAt)}</td><td className="td"><StatusBadge status={u.status} /></td>
                <td className="td text-right">{u.role === "STAFF" && <Button size="sm" variant="secondary" onClick={async () => { try { await setStatus({ id: u.id, status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }).unwrap(); dispatch(pushToast({ kind: "success", title: u.status === "ACTIVE" ? "Staff deactivated" : "Staff reactivated" })); } catch (e) { dispatch(pushToast({ kind: "error", title: "Failed", message: toApiError(e).message })); } }}>{u.status === "ACTIVE" ? "Deactivate" : "Reactivate"}</Button>}</td></tr>))}</tbody></TableShell>
        )}
      </Card>
      {open && <AddStaff onClose={() => setOpen(false)} />}
    </>
  );
}
function AddStaff({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [create, { isLoading }] = useCreateStaffMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<StaffIn, unknown, StaffIn>({ resolver: zodForm(createStaffSchema) });
  return (
    <Modal open onClose={onClose} size="sm" title="Add bank staff" dismissible={!isLoading} footer={<><Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button><Button form="staff-form" type="submit" loading={isLoading}>Create</Button></>}>
      <form id="staff-form" noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => { setFormError(null); try { await create(v).unwrap(); dispatch(pushToast({ kind: "success", title: "Staff account created" })); onClose(); } catch (e) { setFormError(applyServerErrors(toApiError(e), setError, ["name", "email", "password"])); } })}>
        {formError && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</div>}
        <Input label="Full name" error={errors.name?.message} {...register("name")} />
        <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <Input label="Temporary password" type="text" error={errors.password?.message} {...register("password")} />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------- limits & rules (admin) */
type SetIn = z.input<typeof settingsSchema>;
export function LimitsView() {
  const dispatch = useAppDispatch();
  const { data, isLoading } = useGetSettingsQuery();
  const [save, { isLoading: saving }] = useUpdateSettingsMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState: { errors, isDirty } } = useForm<SetIn, unknown, z.output<typeof settingsSchema>>({ resolver: zodForm(settingsSchema) });
  useEffect(() => { if (data) reset({ dailyTransferLimit: data.dailyTransferLimit, maxTransactionAmount: data.maxTransactionAmount, minAccountBalance: data.minAccountBalance, transferFee: data.transferFee, largeTransactionThreshold: data.largeTransactionThreshold }); }, [data, reset]);
  if (isLoading) return <Skeleton className="h-96" />;
  const field = (name: keyof SetIn, lbl: string, hint: string) => <Input label={lbl} hint={hint} inputMode="decimal" error={errors[name]?.message as string | undefined} {...register(name)} />;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader title="Bank-wide transaction rules" description="Applied to every account unless an account has its own override." />
        <form noValidate className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit(async (v) => { setFormError(null); try { await save(v).unwrap(); dispatch(pushToast({ kind: "success", title: "Settings saved" })); } catch (e) { setFormError(applyServerErrors(toApiError(e), setError, ["dailyTransferLimit", "maxTransactionAmount", "minAccountBalance", "transferFee", "largeTransactionThreshold"])); } })}>
          {formError && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger sm:col-span-2">{formError}</div>}
          {field("dailyTransferLimit", "Daily transfer limit ($)", "Total a customer may transfer per day, per account")}
          {field("maxTransactionAmount", "Maximum single transaction ($)", "Cannot exceed the daily limit")}
          {field("minAccountBalance", "Minimum account balance ($)", "Balance that must always remain")}
          {field("transferFee", "Transfer fee ($)", "Flat fee on transfers to other customers")}
          {field("largeTransactionThreshold", "Large-transaction alert ($)", "Transactions at or above this are auto-flagged")}
          <div className="sm:col-span-2"><Button type="submit" loading={saving} disabled={!isDirty}>Save changes</Button></div>
        </form>
      </Card>
      <Card className="h-fit bg-primary-soft/50">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" /> Current effective values</p>
        <ul className="space-y-2 text-sm text-muted">
          <li>Daily limit <b className="text-ink">{formatMoney(data!.dailyTransferLimit)}</b></li><li>Single transaction <b className="text-ink">{formatMoney(data!.maxTransactionAmount)}</b></li><li>Minimum balance <b className="text-ink">{formatMoney(data!.minAccountBalance)}</b></li><li>Transfer fee <b className="text-ink">{formatMoney(data!.transferFee)}</b></li><li>Alert threshold <b className="text-ink">{formatMoney(data!.largeTransactionThreshold)}</b></li>
        </ul>
        <p className="mt-4 text-xs text-muted">Updated {dt(data!.updatedAt)}. Staff cannot modify these settings; the API rejects the request.</p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- audit log */
export function AuditView() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, refetch } = useListAuditQuery({ page, pageSize: 15 });
  return (
    <Card padded={false}>
      {isError ? <ErrorState onRetry={refetch} /> : isLoading ? <TableSkeleton cols={4} /> : (
        <>
          <TableShell><thead><tr className="border-b border-border bg-surface-2/60"><th className="th">When</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Entity</th><th className="th">Details</th></tr></thead>
            <tbody className="divide-y divide-border">{data!.items.map((a) => (
              <tr key={a.id}><td className="td whitespace-nowrap text-[13px] text-muted">{dt(a.createdAt)}</td><td className="td text-[13px] font-medium">{a.actor ?? "System"}</td><td className="td"><Badge>{a.action.replace(/_/g, " ").toLowerCase()}</Badge></td><td className="td font-mono text-xs text-muted">{a.entityType}</td><td className="td max-w-[320px] truncate font-mono text-[11.5px] text-muted">{a.metadata && Object.keys(a.metadata).length ? JSON.stringify(a.metadata) : "—"}</td></tr>))}</tbody></TableShell>
          <Pagination page={data!.page} totalPages={data!.totalPages} total={data!.total} pageSize={data!.pageSize} loading={isFetching} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
