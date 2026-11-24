"use client";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { RequestsList } from "@/components/shared/requests";
import { Button, Card, CardHeader, Input, Money, PageHeader, Select, Textarea } from "@/components/ui";
import { label } from "@/lib/constants";
import { applyServerErrors, toApiError, zodForm } from "@/lib/forms";
import { fundRequestSchema } from "@/lib/validators";
import { cn } from "@/lib/cn";
import { useCreateRequestMutation, useGetMeQuery, useListAccountsQuery } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { pushToast } from "@/store/slices/uiSlice";

type In = z.input<typeof fundRequestSchema>;
type Out = z.output<typeof fundRequestSchema>;

export default function RequestsPage() {
  const dispatch = useAppDispatch();
  const { data: me } = useGetMeQuery();
  const accounts = useListAccountsQuery({ pageSize: 20 });
  const [create, { isLoading }] = useCreateRequestMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [needTotp, setNeedTotp] = useState(false);
  const active = accounts.data?.items.filter((a) => a.status === "ACTIVE") ?? [];
  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors } } = useForm<In, unknown, Out>({ resolver: zodForm(fundRequestSchema), defaultValues: { type: "DEPOSIT", accountId: "", amount: "" as unknown as number, description: "", totp: "" } });
  const type = watch("type");
  const accountId = watch("accountId") || active[0]?.id;
  const acc = active.find((a) => a.id === accountId);
  const firstId = active[0]?.id;
  useEffect(() => { if (firstId && !watch("accountId")) setValue("accountId", firstId); }, [firstId, setValue, watch]);

  const onSubmit = async (v: Out) => {
    setFormError(null);
    try {
      const r = await create(v).unwrap();
      dispatch(pushToast({ kind: "success", title: "Request submitted", message: `${r.requestNumber} is waiting for bank approval.` }));
      reset({ type: v.type, accountId: v.accountId, amount: "" as unknown as number, description: "", totp: "" });
    } catch (e) {
      const err = toApiError(e);
      if (err.code === "TWO_FACTOR_REQUIRED" || err.code === "TWO_FACTOR_INVALID") { setNeedTotp(true); setError("totp", { message: err.message }); return; }
      setFormError(applyServerErrors(err, setError, ["amount", "description", "accountId"]));
    }
  };

  return (
    <>
      <PageHeader title="Deposit & withdrawal" description="Submit a request. A bank employee reviews it, and your balance only changes once it is approved." />
      <div className="mb-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader title="New request" />
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Request type">
              {([["DEPOSIT", "Deposit", <ArrowDownToLine key="d" className="size-4" />], ["WITHDRAWAL", "Withdrawal", <ArrowUpFromLine key="w" className="size-4" />]] as const).map(([v, t, icon]) => (
                <button type="button" role="radio" aria-checked={type === v} key={v} onClick={() => setValue("type", v)} className={cn("flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition", type === v ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-ink")}>{icon}{t}</button>
              ))}
            </div>
            {formError && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</div>}
            <Select label="Account" error={errors.accountId?.message} {...register("accountId")}>
              {active.map((a) => <option key={a.id} value={a.id}>{a.nickname || label(a.type)} ••{a.accountNumber.slice(-4)}</option>)}
            </Select>
            {acc && <p className="-mt-2 text-xs text-muted">Current balance <Money value={acc.balance} className="font-semibold text-ink" /></p>}
            <div className="relative"><span className="pointer-events-none absolute left-3.5 top-[38px] text-sm font-medium text-muted">$</span><Input label="Amount" inputMode="decimal" placeholder="0.00" className="pl-7" error={errors.amount?.message as string | undefined} {...register("amount")} /></div>
            <Textarea label="Description" placeholder={type === "DEPOSIT" ? "e.g. Cash deposit at branch" : "e.g. Cash for rent"} maxLength={200} error={errors.description?.message} {...register("description")} />
            {(needTotp || (me?.twoFactorEnabled && type === "WITHDRAWAL")) && <Input label="Authenticator code" inputMode="numeric" maxLength={6} placeholder="6-digit code" error={errors.totp?.message} {...register("totp")} />}
            <Button type="submit" className="w-full" size="lg" loading={isLoading} disabled={!active.length}>Submit {type === "DEPOSIT" ? "deposit" : "withdrawal"} request</Button>
            <p className="text-center text-xs text-muted">Date of request is recorded automatically.</p>
          </form>
        </Card>
        <div className="min-w-0"><h2 className="mb-3 text-[15px] font-semibold">Your requests</h2><RequestsList mode="customer" /></div>
      </div>
    </>
  );
}
