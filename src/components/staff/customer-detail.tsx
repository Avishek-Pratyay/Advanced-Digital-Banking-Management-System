"use client";
import { ArrowLeft, BadgeCheck, Ban, CheckCircle2, Plus, Snowflake } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { label, ACCOUNT_TYPES, type Role } from "@/lib/constants";
import { toApiError } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { useCreateAccountMutation, useCustomerActionMutation, useGetCustomerQuery } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { pushToast } from "@/store/slices/uiSlice";
import { AccountCard } from "../shared/account-card";
import { TransactionHistory } from "../shared/transactions";
import { Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, DataRow, ErrorState, Input, Modal, Money, Select, Skeleton, StatCard, StatusBadge } from "../ui";

const dt = (x: string | Date | null) => (x ? new Date(x).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—");

export function CustomerDetailView({ id, role }: { id: string; role: Role }) {
  const dispatch = useAppDispatch();
  const { data: c, isLoading, isError, refetch } = useGetCustomerQuery(id);
  const [act] = useCustomerActionMutation();
  const [dialog, setDialog] = useState<null | "verify" | "unverify" | { status: "ACTIVE" | "INACTIVE" | "BLOCKED" }>(null);
  const [newAcc, setNewAcc] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = role === "ADMIN" ? "/admin" : "/staff";
  if (isError) return <ErrorState message="Customer not found." onRetry={refetch} />;
  if (isLoading || !c) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const run = async (payload: Parameters<typeof act>[0], okMsg: string, reason?: string) => {
    setBusy(true);
    try { await act(reason ? ({ ...payload, reason } as typeof payload) : payload).unwrap(); dispatch(pushToast({ kind: "success", title: okMsg })); setDialog(null); }
    catch (e) { dispatch(pushToast({ kind: "error", title: "Action failed", message: toApiError(e).message })); }
    finally { setBusy(false); }
  };
  const status = typeof dialog === "object" && dialog ? dialog.status : null;
  return (
    <>
      <Link href={`${base}/customers`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="size-4" /> All customers</Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4"><Avatar name={c.name} size={56} /><div><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1><StatusBadge status={c.status} />{c.verified && <Badge tone="success"><BadgeCheck className="size-3.5" />Verified</Badge>}</div><p className="font-mono text-sm text-muted">{c.customerNumber}</p></div></div>
        <div className="flex flex-wrap gap-2">
          {c.verified ? <Button variant="secondary" onClick={() => setDialog("unverify")}>Revoke verification</Button> : <Button icon={<BadgeCheck className="size-4" />} onClick={() => setDialog("verify")}>Verify information</Button>}
          <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setNewAcc(true)}>Open account</Button>
          {role === "ADMIN" && (c.status === "ACTIVE" ? (
            <><Button variant="secondary" icon={<Snowflake className="size-4" />} onClick={() => setDialog({ status: "INACTIVE" })}>Deactivate</Button><Button variant="danger" icon={<Ban className="size-4" />} onClick={() => setDialog({ status: "BLOCKED" })}>Block</Button></>
          ) : <Button icon={<CheckCircle2 className="size-4" />} onClick={() => setDialog({ status: "ACTIVE" })}>Reactivate</Button>)}
        </div>
      </div>
      {c.statusReason && c.status !== "ACTIVE" && <p className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning"><b>Reason on file:</b> {c.statusReason}</p>}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total balance" value={<Money value={c.stats.totalBalance} />} hint={`${c.accounts.length} account(s)`} />
        <StatCard tone="success" label="Total deposits" value={<Money value={c.stats.totalDeposits} />} />
        <StatCard tone="accent" label="Total withdrawals" value={<Money value={c.stats.totalWithdrawals} />} />
        <StatCard tone="info" label="Transactions" value={c.stats.transactionCount} hint={`${c.loans.length} loan(s)`} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card><CardHeader title="Customer information" />
          <dl><DataRow label="Email">{c.email}</DataRow><DataRow label="Phone">{c.phone ?? "—"}</DataRow><DataRow label="Address">{c.address ?? "—"}</DataRow><DataRow label="Date of birth">{dt(c.dateOfBirth)}</DataRow><DataRow label="National ID" mono>{c.nationalId ?? "—"}</DataRow><DataRow label="Two-factor">{c.twoFactorEnabled ? "Enabled" : "Off"}</DataRow><DataRow label="Registered">{dt(c.createdAt)}</DataRow><DataRow label="Last login">{dt(c.lastLoginAt)}</DataRow></dl></Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {c.accounts.length ? c.accounts.map((a) => <div key={a.id} className="space-y-1"><AccountCard a={a} /><p className="px-1 font-mono text-[11.5px] text-muted">{a.accountNumber}</p></div>) : <Card className="sm:col-span-2"><p className="py-8 text-center text-sm text-muted">No accounts yet. Use “Open account”.</p></Card>}
        </div>
      </div>

      {c.loans.length > 0 && (
        <Card className="mb-5"><CardHeader title="Loans" />
          <ul className="divide-y divide-border">{c.loans.map((l) => <li key={l.id}><Link href={`${base}/loans/${l.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary"><span><span className="font-mono text-[12.5px] font-semibold">{l.loanNumber}</span> · {label(l.type)}</span><span className="flex items-center gap-3"><span className="tabular">{formatMoney(l.approvedAmount ?? l.requestedAmount)}</span><StatusBadge status={l.status} /></span></Link></li>)}</ul></Card>
      )}

      <TransactionHistory viewer={role} userId={id} title="Transaction history" />

      <ConfirmDialog open={dialog === "verify" || dialog === "unverify"} onClose={() => setDialog(null)} loading={busy} title={dialog === "verify" ? "Verify customer information" : "Revoke verification"} confirmLabel={dialog === "verify" ? "Mark as verified" : "Revoke"}
        description={dialog === "verify" ? "Confirm that the customer's identity documents were checked. The customer will be able to apply for loans." : "The customer will no longer be able to apply for loans."} onConfirm={() => run({ id, action: dialog === "verify" ? "verify" : "unverify" }, dialog === "verify" ? "Customer verified" : "Verification revoked")} />
      <ConfirmDialog open={!!status} onClose={() => setDialog(null)} loading={busy} tone={status === "ACTIVE" ? "primary" : "danger"} title={status === "ACTIVE" ? "Reactivate customer" : status === "BLOCKED" ? "Block customer" : "Deactivate customer"} confirmLabel={status === "ACTIVE" ? "Reactivate" : status === "BLOCKED" ? "Block customer" : "Deactivate"}
        description={status === "ACTIVE" ? "The customer will be able to sign in again." : "The customer is signed out of every request immediately and cannot transact."} reasonLabel={status && status !== "ACTIVE" ? "Reason" : undefined} reasonRequired={!!status && status !== "ACTIVE"}
        onConfirm={(reason) => run({ id, action: "set_status", status: status! }, `Customer ${status === "ACTIVE" ? "reactivated" : status === "BLOCKED" ? "blocked" : "deactivated"}`, reason)} />
      {newAcc && <OpenAccountModal userId={id} onClose={() => setNewAcc(false)} />}
    </>
  );
}

export function OpenAccountModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [create, { isLoading }] = useCreateAccountMutation();
  const [type, setType] = useState("SAVINGS");
  const [nick, setNick] = useState("");
  const [dep, setDep] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} size="sm" title="Open a bank account" dismissible={!isLoading}
      footer={<><Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button><Button loading={isLoading} onClick={async () => { setErr(null); try { const a = await create({ userId, type, nickname: nick || undefined, openingDeposit: dep ? Number(dep) : 0 }).unwrap(); dispatch(pushToast({ kind: "success", title: "Account opened", message: a.accountNumber })); onClose(); } catch (e) { setErr(toApiError(e).message); } }}>Open account</Button></>}>
      <div className="space-y-4">
        {err && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{err}</div>}
        <Select label="Account type" value={type} onChange={(e) => setType(e.target.value)}>{ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
        <Input label="Nickname (optional)" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={40} />
        <Input label="Opening deposit ($)" inputMode="decimal" value={dep} onChange={(e) => setDep(e.target.value)} hint="Optional" />
      </div>
    </Modal>
  );
}
