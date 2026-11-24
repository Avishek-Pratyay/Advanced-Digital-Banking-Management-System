"use client";
import { AlertTriangle, Calculator, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { LoanList } from "@/components/shared/loans";
import { Button, Card, CardHeader, DataRow, Input, Modal, Money, PageHeader, Select, Textarea } from "@/components/ui";
import { EMPLOYMENT_STATUSES, LOAN_PRODUCTS, LOAN_TYPES, label, type LoanType } from "@/lib/constants";
import { applyServerErrors, toApiError, zodForm } from "@/lib/forms";
import { buildSchedule, totalPayable } from "@/lib/loan-math";
import { formatMoney } from "@/lib/money";
import { loanApplicationSchema } from "@/lib/validators";
import { useApplyLoanMutation, useGetMeQuery, useListAccountsQuery } from "@/store/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCalculator } from "@/store/slices/loanSlice";
import { pushToast } from "@/store/slices/uiSlice";

type In = z.input<typeof loanApplicationSchema>;
type Out = z.output<typeof loanApplicationSchema>;

export default function LoansPage() {
  const [open, setOpen] = useState(false);
  const { data: me } = useGetMeQuery();
  return (
    <>
      <PageHeader title="Loans" description="Apply for a loan, follow your application and manage repayments." actions={<Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Apply for a loan</Button>} />
      {me && !me.verified && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3.5 text-sm text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p><b>Identity verification pending.</b> A bank employee must verify your customer information before you can submit a loan application.</p></div>
      )}
      <div className="mb-6"><Calculator_ /></div>
      <LoanList role="CUSTOMER" />
      {open && <ApplyModal onClose={() => setOpen(false)} />}
    </>
  );
}

/** Live EMI estimator driven by the Redux `loans.calculator` state (same maths as the server). */
function Calculator_() {
  const c = useAppSelector((s) => s.loans.calculator);
  const dispatch = useAppDispatch();
  const p = LOAN_PRODUCTS[c.type];
  const sched = useMemo(() => buildSchedule(Math.round(c.amount * 100), p.interestBps, c.months, new Date()), [c, p.interestBps]);
  const total = totalPayable(sched) / 100;
  return (
    <Card>
      <CardHeader title="Loan calculator" description="Estimate your monthly instalment before you apply." action={<Calculator className="size-5 text-muted" />} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Loan type" value={c.type} onChange={(e) => { const t = e.target.value as LoanType; dispatch(setCalculator({ type: t, months: Math.min(c.months, LOAN_PRODUCTS[t].maxMonths), amount: Math.min(Math.max(c.amount, LOAN_PRODUCTS[t].minAmount), LOAN_PRODUCTS[t].maxAmount) })); }}>
            {LOAN_TYPES.map((t) => <option key={t} value={t}>{LOAN_PRODUCTS[t].label} · {LOAN_PRODUCTS[t].interestBps / 100}%</option>)}
          </Select>
          <Input label="Amount ($)" type="number" min={p.minAmount} max={p.maxAmount} value={c.amount} onChange={(e) => dispatch(setCalculator({ amount: Number(e.target.value) || 0 }))} />
          <div className="sm:col-span-2">
            <label className="label" htmlFor="months">Duration: <b>{c.months} months</b></label>
            <input id="months" type="range" min={3} max={p.maxMonths} value={c.months} onChange={(e) => dispatch(setCalculator({ months: Number(e.target.value) }))} className="w-full accent-[rgb(var(--primary))]" />
          </div>
        </div>
        <dl className="rounded-xl bg-primary-soft/50 px-4 py-2">
          <DataRow label="Monthly EMI"><Money value={sched[0].amount / 100} className="text-lg" /></DataRow>
          <DataRow label="Total interest"><Money value={total - c.amount} /></DataRow>
          <DataRow label="Total payable"><Money value={total} /></DataRow>
          <DataRow label="Interest rate">{p.interestBps / 100}% p.a.</DataRow>
        </dl>
      </div>
    </Card>
  );
}

function ApplyModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const calc = useAppSelector((s) => s.loans.calculator);
  const accounts = useListAccountsQuery({ pageSize: 20 });
  const { data: me } = useGetMeQuery();
  const [apply, { isLoading }] = useApplyLoanMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const active = accounts.data?.items.filter((a) => a.status === "ACTIVE") ?? [];
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<In, unknown, Out>({
    resolver: zodForm(loanApplicationSchema),
    defaultValues: { accountId: active[0]?.id ?? "", type: calc.type, requestedAmount: calc.amount, durationMonths: calc.months, monthlyIncome: "" as unknown as number, employmentStatus: "EMPLOYED", description: "" },
  });
  const type = watch("type") as LoanType;
  const p = LOAN_PRODUCTS[type];
  const onSubmit = async (v: Out) => {
    setFormError(null);
    try {
      const r = await apply(v).unwrap();
      dispatch(pushToast({ kind: "success", title: "Application submitted", message: `${r.loanNumber} is now pending review.` }));
      onClose();
    } catch (e) { setFormError(applyServerErrors(toApiError(e), setError, ["requestedAmount", "durationMonths", "monthlyIncome", "description", "accountId"])); }
  };
  return (
    <Modal open onClose={onClose} title="Apply for a loan" size="lg" dismissible={!isLoading}
      footer={<><Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button><Button form="loan-form" type="submit" loading={isLoading} disabled={me ? !me.verified : false}>Submit application</Button></>}>
      <form id="loan-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger sm:col-span-2">{formError}</div>}
        <Select label="Loan type" error={errors.type?.message} {...register("type")}>{LOAN_TYPES.map((t) => <option key={t} value={t}>{LOAN_PRODUCTS[t].label}</option>)}</Select>
        <Select label="Disburse to account" error={errors.accountId?.message} {...register("accountId")}>{active.map((a) => <option key={a.id} value={a.id}>{a.nickname || label(a.type)} ••{a.accountNumber.slice(-4)}</option>)}</Select>
        <Input label="Requested amount ($)" inputMode="decimal" hint={`${formatMoney(p.minAmount)} – ${formatMoney(p.maxAmount)}`} error={errors.requestedAmount?.message as string | undefined} {...register("requestedAmount")} />
        <Input label="Duration (months)" inputMode="numeric" hint={`Up to ${p.maxMonths} months`} error={errors.durationMonths?.message as string | undefined} {...register("durationMonths")} />
        <Input label="Monthly income ($)" inputMode="decimal" error={errors.monthlyIncome?.message as string | undefined} {...register("monthlyIncome")} />
        <Select label="Employment status" error={errors.employmentStatus?.message} {...register("employmentStatus")}>{EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Textarea wrapperClassName="sm:col-span-2" label="Application description" placeholder="Tell us what the loan is for…" maxLength={500} error={errors.description?.message} {...register("description")} />
      </form>
    </Modal>
  );
}
