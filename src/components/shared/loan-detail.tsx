"use client";
import { ArrowLeft, CheckCircle2, Send, StickyNote, ThumbsDown, ThumbsUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { label, type Role } from "@/lib/constants";
import { toApiError } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { useAddLoanNoteMutation, useDecideLoanMutation, useDisburseLoanMutation, useForwardLoanMutation, useGetLoanQuery, useGetMeQuery, useListAccountsQuery, useRepayLoanMutation } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { pushToast } from "@/store/slices/uiSlice";
import { Badge, Button, Card, CardHeader, ConfirmDialog, DataRow, ErrorState, Input, Modal, Money, Select, Skeleton, StatusBadge, Textarea } from "../ui";
import { cn } from "@/lib/cn";

const dt = (x: string | Date | null) => (x ? new Date(x).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—");

const STEPS = ["PENDING", "UNDER_REVIEW", "APPROVED", "ACTIVE", "COMPLETED"] as const;
function Progress({ status }: { status: string }) {
  if (status === "REJECTED") return <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">This application was rejected.</div>;
  const idx = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto py-1" aria-label="Loan progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-1 last:flex-none">
          <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", i <= idx ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted ring-1 ring-border")}>{i < idx ? "✓" : i + 1}</span>
          <span className={cn("whitespace-nowrap text-xs font-medium", i <= idx ? "text-ink" : "text-muted")}>{label(s)}</span>
          {i < STEPS.length - 1 && <span className={cn("mx-1 h-px min-w-4 flex-1", i < idx ? "bg-primary" : "bg-border")} />}
        </li>
      ))}
    </ol>
  );
}

export function LoanDetailView({ id, role }: { id: string; role: Role }) {
  const dispatch = useAppDispatch();
  const { data: loan, isLoading, isError, refetch } = useGetLoanQuery(id);
  const { data: me } = useGetMeQuery();
  const [dialog, setDialog] = useState<null | "forward" | "approve" | "reject" | "pay">(null);
  const staff = role !== "CUSTOMER";
  const back = role === "CUSTOMER" ? "/customer/loans" : role === "STAFF" ? "/staff/loans" : "/admin/loans";
  const toast = (kind: "success" | "error", title: string, message?: string) => dispatch(pushToast({ kind, title, message }));

  if (isError) return <ErrorState message="This loan could not be found." onRetry={refetch} />;
  if (isLoading || !loan) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-40" /><Skeleton className="h-96" /></div>;

  const principal = loan.approvedAmount ?? loan.requestedAmount;
  const paidPct = loan.totalPayable ? Math.min(100, Math.round((loan.paidAmount / loan.totalPayable) * 100)) : 0;
  const canPay = role === "CUSTOMER" && loan.status === "ACTIVE" && !!loan.nextInstallment;
  const own = me?.id === loan.borrowerInfo?.id;

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="size-4" /> All loans</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{label(loan.type)} loan</h1><StatusBadge status={loan.status} /></div>
          <p className="mt-1 font-mono text-sm text-muted">{loan.loanNumber}{staff && loan.borrower && <> · <span className="font-sans">{loan.borrower.name}</span></>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPay && <Button icon={<Wallet className="size-4" />} onClick={() => setDialog("pay")}>Pay next instalment · {formatMoney(loan.nextInstallment!.amount)}</Button>}
          {staff && loan.status === "PENDING" && <Button icon={<Send className="size-4" />} onClick={() => setDialog("forward")}>Forward for admin approval</Button>}
          {role === "ADMIN" && (loan.status === "PENDING" || loan.status === "UNDER_REVIEW") && (
            <><Button variant="secondary" icon={<ThumbsDown className="size-4" />} disabled={own} onClick={() => setDialog("reject")}>Reject</Button><Button icon={<ThumbsUp className="size-4" />} disabled={own} onClick={() => setDialog("approve")}>Approve</Button></>
          )}
          {role === "ADMIN" && loan.status === "APPROVED" && <DisburseButton id={loan.id} />}
        </div>
      </div>
      {role === "STAFF" && loan.status === "UNDER_REVIEW" && <p className="mb-4 rounded-xl bg-info-soft px-4 py-3 text-sm text-info">Forwarded for administrator approval. Staff cannot approve or reject loans.</p>}

      <Card className="mb-5"><Progress status={loan.status} /></Card>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-xs font-medium text-muted">{loan.approvedAmount ? "Approved amount" : "Requested amount"}</p><p className="tabular mt-1.5 text-2xl font-semibold"><Money value={principal} /></p>{loan.approvedAmount && loan.approvedAmount !== loan.requestedAmount && <p className="mt-1 text-xs text-muted">Requested {formatMoney(loan.requestedAmount)}</p>}</Card>
        <Card><p className="text-xs font-medium text-muted">Monthly instalment (EMI)</p><p className="tabular mt-1.5 text-2xl font-semibold"><Money value={loan.emi} /></p><p className="mt-1 text-xs text-muted">{loan.durationMonths} months at {loan.interestRate}% p.a.</p></Card>
        <Card><p className="text-xs font-medium text-muted">Total payable</p><p className="tabular mt-1.5 text-2xl font-semibold"><Money value={loan.totalPayable} /></p><p className="mt-1 text-xs text-muted">Interest {formatMoney(loan.totalInterest)}</p></Card>
        <Card><p className="text-xs font-medium text-muted">Remaining balance</p><p className="tabular mt-1.5 text-2xl font-semibold"><Money value={loan.remainingBalance ?? loan.totalPayable} /></p>
          {(loan.status === "ACTIVE" || loan.status === "COMPLETED") && <div className="mt-2.5"><div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${paidPct}%` }} /></div><p className="mt-1 text-xs text-muted">{loan.installmentsPaid}/{loan.installmentsTotal} paid · {paidPct}%</p></div>}</Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Application" />
          <dl>
            <DataRow label="Employment">{label(loan.employmentStatus)}</DataRow>
            <DataRow label="Monthly income"><Money value={loan.monthlyIncome} /></DataRow>
            {staff && loan.incomeRatio !== undefined && <DataRow label="EMI / income"><span className={loan.incomeRatio > 40 ? "text-danger" : "text-success"}>{loan.incomeRatio}%</span></DataRow>}
            <DataRow label="Disbursement account" mono>{loan.accountNumber}</DataRow>
            <DataRow label="Applied">{dt(loan.createdAt)}</DataRow>
            {loan.decidedAt && <DataRow label="Decision">{dt(loan.decidedAt)}</DataRow>}
            {loan.disbursedAt && <DataRow label="Disbursed">{dt(loan.disbursedAt)}</DataRow>}
          </dl>
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-[13px] text-muted">{loan.description}</p>
          {loan.decisionNote && <p className="mt-3 rounded-xl border border-border p-3 text-[13px]"><b>Bank note: </b>{loan.decisionNote}</p>}
        </Card>

        <Card padded={false} className="overflow-hidden lg:col-span-2">
          <div className="px-5 pt-5"><CardHeader title={loan.scheduleIsProjection ? "Projected repayment schedule" : "Repayment schedule"} description={loan.scheduleIsProjection ? "Estimated until the loan is approved and disbursed." : undefined} /></div>
          <div className="max-h-[420px] overflow-auto border-t border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-surface-2"><tr><th className="th">#</th><th className="th">Due date</th><th className="th text-right">Principal</th><th className="th text-right">Interest</th><th className="th text-right">Instalment</th><th className="th">Status</th></tr></thead>
              <tbody className="divide-y divide-border">{loan.schedule.map((s) => (
                <tr key={s.number} className={s.overdue ? "bg-danger-soft/40" : ""}><td className="td tabular text-muted">{s.number}</td><td className="td">{dt(s.dueDate)}</td><td className="td tabular text-right">{formatMoney(s.principal)}</td><td className="td tabular text-right text-muted">{formatMoney(s.interest)}</td><td className="td tabular text-right font-semibold">{formatMoney(s.amount)}</td>
                  <td className="td">{s.overdue ? <Badge tone="danger">Overdue</Badge> : loan.scheduleIsProjection ? <span className="text-xs text-muted">—</span> : <StatusBadge status={s.status} />}</td></tr>))}</tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Repayment history" />
          {loan.repayments.length ? (
            <ul className="divide-y divide-border">{loan.repayments.map((r) => (
              <li key={r.installmentNumber} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="flex items-center gap-3"><CheckCircle2 className="size-5 text-success" /><span><span className="block font-medium">Instalment {r.installmentNumber}</span><span className="font-mono text-xs text-muted">{r.transactionRef}</span></span></span><span className="text-right"><Money value={r.amount} className="font-semibold" /><span className="block text-xs text-muted">{dt(r.paidAt)}</span></span></li>
            ))}</ul>
          ) : <p className="py-6 text-center text-sm text-muted">No repayments recorded yet.</p>}
        </Card>
        {staff && <NotesCard loanId={loan.id} notes={loan.notes ?? []} />}
        {staff && loan.borrowerInfo && (
          <Card>
            <CardHeader title="Customer information" action={<Link className="text-[13px] font-medium text-primary hover:underline" href={`${role === "ADMIN" ? "/admin" : "/staff"}/customers/${loan.borrowerInfo.id}`}>Open profile</Link>} />
            <dl><DataRow label="Name">{loan.borrowerInfo.name}</DataRow><DataRow label="Customer no." mono>{loan.borrowerInfo.customerNumber}</DataRow><DataRow label="Email">{loan.borrowerInfo.email}</DataRow><DataRow label="Phone">{loan.borrowerInfo.phone ?? "—"}</DataRow>
              <DataRow label="Identity verified">{loan.borrowerInfo.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}</DataRow><DataRow label="Total balance"><Money value={loan.borrowerInfo.totalBalance} /></DataRow><DataRow label="Accounts">{loan.borrowerInfo.accounts}</DataRow><DataRow label="Member since">{dt(loan.borrowerInfo.memberSince)}</DataRow></dl>
          </Card>
        )}
      </div>

      <ForwardDialog open={dialog === "forward"} onClose={() => setDialog(null)} id={loan.id} toast={toast} />
      <DecisionDialog open={dialog === "approve" || dialog === "reject"} mode={dialog === "reject" ? "reject" : "approve"} onClose={() => setDialog(null)} loan={loan} toast={toast} />
      <PayDialog open={dialog === "pay"} onClose={() => setDialog(null)} loanId={loan.id} amount={loan.nextInstallment?.amount ?? 0} defaultAccountId={loan.accountId} toast={toast} />
    </>
  );
}

type Toast = (kind: "success" | "error", title: string, message?: string) => void;

function DisburseButton({ id }: { id: string }) {
  const [run, { isLoading }] = useDisburseLoanMutation();
  const dispatch = useAppDispatch();
  return <Button loading={isLoading} onClick={async () => { try { await run(id).unwrap(); dispatch(pushToast({ kind: "success", title: "Loan disbursed" })); } catch (e) { dispatch(pushToast({ kind: "error", title: "Disbursement failed", message: toApiError(e).message })); } }}>Disburse funds</Button>;
}

function NotesCard({ loanId, notes }: { loanId: string; notes: { id: string; body: string; author: string; createdAt: string | Date }[] }) {
  const [text, setText] = useState("");
  const [add, { isLoading }] = useAddLoanNoteMutation();
  const dispatch = useAppDispatch();
  return (
    <Card>
      <CardHeader title="Internal notes" description="Visible to staff and administrators only." />
      <div className="flex gap-2"><Textarea aria-label="New note" wrapperClassName="flex-1" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an internal note…" />
        <Button className="self-end" variant="secondary" icon={<StickyNote className="size-4" />} loading={isLoading} disabled={text.trim().length < 3} onClick={async () => { try { await add({ id: loanId, body: text.trim() }).unwrap(); setText(""); } catch (e) { dispatch(pushToast({ kind: "error", title: "Note not saved", message: toApiError(e).message })); } }}>Add</Button></div>
      <ul className="mt-4 space-y-3">{notes.length ? notes.map((n) => <li key={n.id} className="rounded-xl bg-surface-2 p-3 text-[13px]"><p>{n.body}</p><p className="mt-1.5 text-xs text-muted">{n.author} · {dt(n.createdAt)}</p></li>) : <li className="py-3 text-center text-sm text-muted">No notes yet.</li>}</ul>
    </Card>
  );
}

function ForwardDialog({ open, onClose, id, toast }: { open: boolean; onClose: () => void; id: string; toast: Toast }) {
  const [forward, { isLoading }] = useForwardLoanMutation();
  return <ConfirmDialog open={open} onClose={onClose} loading={isLoading} title="Forward for admin approval" description="Confirm you have reviewed the customer's information. An administrator will make the final decision." confirmLabel="Forward application" reasonLabel="Review note (optional)"
    onConfirm={async (note) => { try { await forward({ id, note: note || undefined }).unwrap(); toast("success", "Forwarded to administrators"); onClose(); } catch (e) { toast("error", "Could not forward", toApiError(e).message); onClose(); } }} />;
}

function DecisionDialog({ open, mode, onClose, loan, toast }: { open: boolean; mode: "approve" | "reject"; onClose: () => void; loan: NonNullable<ReturnType<typeof useGetLoanQuery>["data"]>; toast: Toast }) {
  const [decide, { isLoading }] = useDecideLoanMutation();
  const [amount, setAmount] = useState(String(loan.requestedAmount));
  const [rate, setRate] = useState(String(loan.interestRate));
  const [disburse, setDisburse] = useState(true);
  const [note, setNote] = useState("");
  const run = async () => {
    try {
      await decide({ id: loan.id, action: mode, note: note || undefined, ...(mode === "approve" ? { approvedAmount: Number(amount), interestRate: Number(rate), disburse } : {}) }).unwrap();
      toast("success", mode === "approve" ? (disburse ? "Loan approved and disbursed" : "Loan approved") : "Loan rejected");
      onClose();
    } catch (e) { toast("error", "Decision failed", toApiError(e).message); }
  };
  const bad = mode === "approve" ? !(Number(amount) > 0) || Number(amount) > loan.requestedAmount || !(Number(rate) >= 1) : note.trim().length < 3;
  return (
    <Modal open={open} onClose={onClose} size="sm" title={mode === "approve" ? "Approve loan" : "Reject loan"} dismissible={!isLoading}
      footer={<><Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button><Button variant={mode === "reject" ? "danger" : "primary"} loading={isLoading} disabled={bad} onClick={run}>{mode === "approve" ? "Approve" : "Reject application"}</Button></>}>
      <div className="space-y-4">
        {mode === "approve" && (
          <>
            <Input label="Approved amount ($)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} hint={`Up to the requested ${formatMoney(loan.requestedAmount)}`} error={Number(amount) > loan.requestedAmount ? "Cannot exceed requested amount" : undefined} />
            <Input label="Interest rate (% p.a.)" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={disburse} onChange={(e) => setDisburse(e.target.checked)} className="mt-0.5 size-4 accent-[rgb(var(--primary))]" /><span><b>Disburse immediately</b><span className="block text-xs text-muted">Credits the customer&apos;s account through a recorded LOAN_DISBURSEMENT transaction and creates the repayment schedule.</span></span></label>
          </>
        )}
        <Textarea label={mode === "reject" ? "Reason (shown to the customer)" : "Decision note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function PayDialog({ open, onClose, loanId, amount, defaultAccountId, toast }: { open: boolean; onClose: () => void; loanId: string; amount: number; defaultAccountId: string; toast: Toast }) {
  const accounts = useListAccountsQuery({ pageSize: 20 });
  const { data: me } = useGetMeQuery();
  const [pay, { isLoading }] = useRepayLoanMutation();
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [pin, setPin] = useState("");
  const [totp, setTotp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [needTotp, setNeedTotp] = useState(false);
  const active = accounts.data?.items.filter((a) => a.status === "ACTIVE") ?? [];
  const run = async () => {
    setErr(null);
    try { await pay({ id: loanId, accountId, pin, totp: totp || undefined }).unwrap(); toast("success", "Instalment paid"); setPin(""); setTotp(""); onClose(); }
    catch (e) { const x = toApiError(e); if (x.code.startsWith("TWO_FACTOR")) setNeedTotp(true); setErr(x.message); setPin(""); }
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Pay instalment" description={`Amount due: ${formatMoney(amount)}`} dismissible={!isLoading}
      footer={<><Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button><Button loading={isLoading} disabled={pin.length < 4 || (needTotp && totp.length !== 6)} onClick={run}>Pay {formatMoney(amount)}</Button></>}>
      <div className="space-y-4">
        {err && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{err}</div>}
        <Select label="Pay from" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{active.map((a) => <option key={a.id} value={a.id}>{a.nickname || label(a.type)} ••{a.accountNumber.slice(-4)} — {formatMoney(a.availableBalance)}</option>)}</Select>
        <Input label="Transaction PIN" type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        {(needTotp || me?.twoFactorEnabled) && <Input label="Authenticator code" inputMode="numeric" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} />}
      </div>
    </Modal>
  );
}
