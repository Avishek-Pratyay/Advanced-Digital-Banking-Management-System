"use client";
import { ArrowRight, CheckCircle2, Download, Loader2, ShieldCheck, UserCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, Card, CardHeader, DataRow, Input, Modal, Money, PageHeader, Select, Skeleton, Textarea } from "@/components/ui";
import { label } from "@/lib/constants";
import { applyServerErrors, newIdempotencyKey, toApiError, zodForm } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { downloadReceipt } from "@/lib/pdf";
import { transferSchema } from "@/lib/validators";
import { useGetMeQuery, useGetSettingsQuery, useListAccountsQuery, useLazyLookupAccountQuery, useTransferMutation } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { pushToast } from "@/store/slices/uiSlice";
import type { TxnDetail } from "@/types/api";
import { CopyText } from "@/components/shared/transactions";

type In = z.input<typeof transferSchema>;
type Out = z.output<typeof transferSchema>;

export default function TransferPage() {
  const dispatch = useAppDispatch();
  const { data: me } = useGetMeQuery();
  const { data: settings } = useGetSettingsQuery();
  const accounts = useListAccountsQuery({ pageSize: 20 });
  const [lookup, lookupState] = useLazyLookupAccountQuery();
  const [transfer, { isLoading }] = useTransferMutation();
  const [review, setReview] = useState<Out | null>(null);
  const [needTotp, setNeedTotp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<TxnDetail | null>(null);
  const [key, setKey] = useState(newIdempotencyKey);

  const form = useForm<In, unknown, Out>({ resolver: zodForm(transferSchema), mode: "onTouched", defaultValues: { fromAccountId: "", toAccountNumber: "", amount: "" as unknown as number, description: "", pin: "", idempotencyKey: key, totp: "" } });
  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors } } = form;
  const active = useMemo(() => accounts.data?.items.filter((a) => a.status === "ACTIVE") ?? [], [accounts.data]);
  const from = watch("fromAccountId");
  const to = watch("toAccountNumber");
  const amount = Number(watch("amount")) || 0;
  const source = active.find((a) => a.id === from);
  const own = accounts.data?.items.filter((a) => a.id !== from) ?? [];

  useEffect(() => { if (!from && active.length) setValue("fromAccountId", active[0].id); }, [active, from, setValue]);
  useEffect(() => { setValue("idempotencyKey", key); }, [key, setValue]);
  // recipient lookup (debounced) as soon as the number looks complete
  useEffect(() => {
    if (!/^\d{10,16}$/.test(to ?? "")) return;
    const h = setTimeout(() => lookup(to!, true), 350);
    return () => clearTimeout(h);
  }, [to, lookup]);

  const recipient = /^\d{10,16}$/.test(to ?? "") ? lookupState.data : undefined;
  const recipientErr = /^\d{10,16}$/.test(to ?? "") && lookupState.isError;
  const sameAccount = !!source && source.accountNumber === to;
  const isOwn = recipient?.own;
  const fee = isOwn ? 0 : settings?.transferFee ?? 0;
  const afterBalance = source ? source.balance - amount - fee : null;

  const onReview = (v: Out) => {
    setFormError(null);
    if (sameAccount) return setError("toAccountNumber", { message: "You cannot transfer to the same account" });
    if (recipient && !recipient.canReceive) return setError("toAccountNumber", { message: "This account cannot receive funds right now" });
    setReview(v);
  };
  const submit = async () => {
    if (!review) return;
    try {
      const res = await transfer(review).unwrap();
      setReview(null);
      setDone(res.transaction);
      dispatch(pushToast({ kind: "success", title: res.duplicate ? "Transfer already processed" : "Transfer completed", message: `${res.transaction.txnId}` }));
    } catch (e) {
      const err = toApiError(e);
      setReview(null);
      if (err.code === "INVALID_PIN" || err.code === "TOO_MANY_ATTEMPTS" || err.code === "PIN_NOT_SET") { setError("pin", { message: err.message }); setValue("pin", ""); return; }
      if (err.code === "TWO_FACTOR_REQUIRED" || err.code === "TWO_FACTOR_INVALID") { setNeedTotp(true); setError("totp", { message: err.message }); return; }
      setFormError(applyServerErrors(err, setError, ["amount", "toAccountNumber", "pin", "description", "fromAccountId"]));
      if (err.code === "RECIPIENT_NOT_FOUND") setError("toAccountNumber", { message: err.message });
    }
  };
  const again = () => { setDone(null); setKey(newIdempotencyKey()); setNeedTotp(false); reset({ fromAccountId: from, toAccountNumber: "", amount: "" as unknown as number, description: "", pin: "", idempotencyKey: "", totp: "" }); };

  if (done) {
    return (
      <>
        <PageHeader title="Transfer money" />
        <Card className="mx-auto max-w-xl text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-9" /></div>
          <h2 className="mt-4 text-xl font-semibold">Transfer completed</h2>
          <p className="tabular mt-1 text-4xl font-semibold tracking-tight"><Money value={done.amount} /></p>
          <p className="mt-1 text-sm text-muted">sent to {done.receiver?.ownerName}</p>
          <dl className="mt-6 rounded-xl border border-border px-4 text-left">
            <DataRow label="Transaction ID"><CopyText text={done.txnId} /></DataRow>
            <DataRow label="Reference" mono>VL-{done.reference}</DataRow>
            <DataRow label="Fee">{formatMoney(done.fee)}</DataRow>
            <DataRow label="Total debited">{formatMoney(done.total)}</DataRow>
          </dl>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadReceipt(done)}>Download receipt</Button>
            <Button onClick={again}>New transfer</Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Transfer money" description="Send funds between your accounts or to any Vaultline customer. Every transfer is verified with your transaction PIN." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          {accounts.isLoading ? <Skeleton className="h-96" /> : !active.length ? (
            <p className="py-10 text-center text-sm text-muted">You have no active account to transfer from.</p>
          ) : (
            <form onSubmit={handleSubmit(onReview)} noValidate className="space-y-5">
              {formError && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</div>}
              <Select label="From account" error={errors.fromAccountId?.message} {...register("fromAccountId")}>
                {active.map((a) => <option key={a.id} value={a.id}>{a.nickname || label(a.type)} ••{a.accountNumber.slice(-4)} — {formatMoney(a.availableBalance)} available</option>)}
              </Select>
              <div>
                <Input label="Recipient account number" inputMode="numeric" autoComplete="off" placeholder="12-digit account number" maxLength={16} error={errors.toAccountNumber?.message} {...register("toAccountNumber", { setValueAs: (v: string) => v.replace(/\D/g, "") })} />
                {own.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="text-muted">Between my accounts:</span>
                    {own.map((a) => <button type="button" key={a.id} onClick={() => setValue("toAccountNumber", a.accountNumber, { shouldValidate: true })} className="rounded-full border border-border px-2.5 py-1 font-medium text-muted transition hover:border-primary hover:text-primary">{a.nickname || label(a.type)} ••{a.accountNumber.slice(-4)}</button>)}
                  </div>
                )}
                {/^\d{10,16}$/.test(to ?? "") && !errors.toAccountNumber && (
                  <p className="mt-2 flex items-center gap-2 text-[13px]" aria-live="polite">
                    {lookupState.isFetching ? <><Loader2 className="size-4 animate-spin text-muted" /> Checking account…</> : recipient ? <><UserCheck className="size-4 text-success" /> <b>{recipient.ownerName}</b> <span className="text-muted">· {label(recipient.type)} account{recipient.own ? " (yours)" : ""}</span></> : recipientErr ? <><XCircle className="size-4 text-danger" /><span className="text-danger">No account found with this number</span></> : null}
                    {recipient && !recipient.canReceive && <span className="font-medium text-danger">· cannot receive funds</span>}
                  </p>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-[38px] text-sm font-medium text-muted">$</span>
                  <Input label="Amount" inputMode="decimal" placeholder="0.00" className="pl-7" error={errors.amount?.message as string | undefined} {...register("amount")} />
                </div>
                <Input label="Transaction PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="••••" hint={me && !me.hasPin ? "No PIN set yet - create one in Security settings." : "4-6 digit PIN"} error={errors.pin?.message} {...register("pin")} />
              </div>
              {needTotp && <Input label="Authenticator code" inputMode="numeric" maxLength={6} placeholder="6-digit code" autoComplete="one-time-code" hint="Two-factor authentication is enabled on your account." error={errors.totp?.message} {...register("totp")} />}
              <Textarea label="Description (optional)" placeholder="What is this payment for?" maxLength={140} error={errors.description?.message} {...register("description")} />
              <Button type="submit" size="lg" className="w-full sm:w-auto" icon={<ArrowRight className="size-4" />} disabled={!!recipient && !recipient.canReceive}>Review transfer</Button>
            </form>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Transfer summary" />
            <dl>
              <DataRow label="Available"><Money value={source?.availableBalance} /></DataRow>
              <DataRow label="Amount"><Money value={amount || 0} /></DataRow>
              <DataRow label="Fee">{fee ? <Money value={fee} /> : <span className="text-success">Free</span>}</DataRow>
              <DataRow label="Balance after">{afterBalance === null ? "—" : <Money value={afterBalance} className={afterBalance < 0 ? "text-danger" : ""} />}</DataRow>
            </dl>
            {afterBalance !== null && afterBalance < 0 && amount > 0 && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger">Insufficient balance for this amount.</p>}
          </Card>
          <Card className="bg-primary-soft/50">
            <div className="flex items-start gap-2.5 text-[13px] text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><p>Limits are enforced by the bank, not by this page: {settings ? <>daily <b className="text-ink">{formatMoney(settings.dailyTransferLimit)}</b>, per transfer <b className="text-ink">{formatMoney(settings.maxTransactionAmount)}</b>.</> : "loading…"}</p></div>
          </Card>
        </div>
      </div>

      <Modal open={!!review} onClose={() => !isLoading && setReview(null)} title="Confirm transfer" description="Please check the details. This action cannot be undone by you." size="sm" dismissible={!isLoading}
        footer={<><Button variant="secondary" disabled={isLoading} onClick={() => setReview(null)}>Back</Button><Button loading={isLoading} onClick={submit}>Confirm & send</Button></>}>
        {review && (
          <dl>
            <DataRow label="From">{source ? `${label(source.type)} ••${source.accountNumber.slice(-4)}` : "—"}</DataRow>
            <DataRow label="To">{recipient ? `${recipient.ownerName} ••${review.toAccountNumber.slice(-4)}` : `••${review.toAccountNumber.slice(-4)}`}</DataRow>
            <DataRow label="Amount"><Money value={review.amount} className="text-base" /></DataRow>
            <DataRow label="Fee">{fee ? formatMoney(fee) : "Free"}</DataRow>
            <DataRow label="Total debited"><Money value={review.amount + fee} className="text-base" /></DataRow>
            {review.description && <DataRow label="Note">{review.description}</DataRow>}
          </dl>
        )}
      </Modal>
    </>
  );
}
