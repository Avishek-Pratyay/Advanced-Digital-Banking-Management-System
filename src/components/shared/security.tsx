"use client";
import { KeyRound, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Badge, Button, Card, CardHeader, DataRow, Input, PageHeader, Skeleton } from "@/components/ui";
import { applyServerErrors, toApiError, zodForm } from "@/lib/forms";
import { label } from "@/lib/constants";
import { changePasswordSchema, changePinSchema } from "@/lib/validators";
import { useChangePasswordMutation, useChangePinMutation, useGetMeQuery, useTwoFactorMutation } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { pushToast } from "@/store/slices/uiSlice";

export function SecurityPage() {
  const { data: me, isLoading } = useGetMeQuery();
  return (
    <>
      <PageHeader title="Security & settings" description="Protect your account with a strong password, a transaction PIN and two-factor authentication." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          {isLoading || !me ? <Skeleton className="h-40" /> : (
            <dl><DataRow label="Name">{me.name}</DataRow><DataRow label="Email">{me.email}</DataRow><DataRow label="Role">{label(me.role)}</DataRow>{me.customerNumber && <DataRow label="Customer no." mono>{me.customerNumber}</DataRow>}
              {me.role === "CUSTOMER" && <DataRow label="Identity">{me.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Pending verification</Badge>}</DataRow>}
              <DataRow label="Two-factor">{me.twoFactorEnabled ? <Badge tone="success">Enabled</Badge> : <Badge>Off</Badge>}</DataRow></dl>
          )}
        </Card>
        <TwoFactorCard enabled={!!me?.twoFactorEnabled} />
        {me?.role === "CUSTOMER" && <PinCard hasPin={!!me.hasPin} />}
        <PasswordCard />
      </div>
    </>
  );
}

type PinIn = z.input<typeof changePinSchema>;
function PinCard({ hasPin }: { hasPin: boolean }) {
  const dispatch = useAppDispatch();
  const [change, { isLoading }] = useChangePinMutation();
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<PinIn, unknown, PinIn>({ resolver: zodForm(changePinSchema) });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title="Transaction PIN" description="Required for every transfer and loan repayment. Three wrong attempts lock it for 15 minutes." action={<KeyRound className="size-5 text-muted" />} />
      <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => { setMsg(null); try { await change(v).unwrap(); dispatch(pushToast({ kind: "success", title: "PIN updated" })); reset(); } catch (e) { setMsg(applyServerErrors(toApiError(e), setError, ["currentPin", "newPin"])); } })}>
        {msg && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{msg}</div>}
        <Input label="Current PIN" type="password" inputMode="numeric" maxLength={6} autoComplete="off" disabled={!hasPin} error={errors.currentPin?.message} {...register("currentPin")} />
        <Input label="New PIN" type="password" inputMode="numeric" maxLength={6} autoComplete="off" hint="4-6 digits. Avoid repeated or sequential numbers." error={errors.newPin?.message} {...register("newPin")} />
        <Button type="submit" loading={isLoading}>Update PIN</Button>
      </form>
    </Card>
  );
}

type PwIn = z.input<typeof changePasswordSchema>;
function PasswordCard() {
  const dispatch = useAppDispatch();
  const [change, { isLoading }] = useChangePasswordMutation();
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<PwIn, unknown, PwIn>({ resolver: zodForm(changePasswordSchema) });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title="Password" description="At least 8 characters with upper-case, lower-case and a number." action={<Lock className="size-5 text-muted" />} />
      <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => { setMsg(null); try { await change(v).unwrap(); dispatch(pushToast({ kind: "success", title: "Password changed" })); reset(); } catch (e) { setMsg(applyServerErrors(toApiError(e), setError, ["currentPassword", "newPassword", "confirmPassword"])); } })}>
        {msg && <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{msg}</div>}
        <Input label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register("currentPassword")} />
        <Input label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register("newPassword")} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <Button type="submit" loading={isLoading}>Change password</Button>
      </form>
    </Card>
  );
}

function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const dispatch = useAppDispatch();
  const [run, { isLoading }] = useTwoFactorMutation();
  const [setup, setSetup] = useState<{ qr?: string; secret?: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const call = async (a: { action: "setup" | "enable" | "disable"; code?: string; password?: string }) => {
    setErr(null);
    try { return await run(a).unwrap(); } catch (e) { setErr(toApiError(e).message); return null; }
  };
  return (
    <Card>
      <CardHeader title="Two-factor authentication" description="An authenticator app code is required to confirm transfers, withdrawals and loan repayments." action={<Smartphone className="size-5 text-muted" />} />
      {err && <div role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{err}</div>}
      {enabled ? (
        <div className="space-y-4"><p className="flex items-center gap-2 text-sm text-success"><ShieldCheck className="size-4" /> Two-factor authentication is on.</p>
          <Input label="Confirm with your password to turn it off" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button variant="danger" loading={isLoading} disabled={!password} onClick={async () => { if (await call({ action: "disable", password })) { setPassword(""); dispatch(pushToast({ kind: "info", title: "Two-factor disabled" })); } }}>Disable</Button></div>
      ) : setup ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">Scan this QR code with Google Authenticator, Authy or 1Password, then enter the 6-digit code.</p>
          {setup.qr && /* eslint-disable-next-line @next/next/no-img-element */ <img src={setup.qr} alt="Two-factor QR code" className="size-44 rounded-xl border border-border bg-white p-2" />}
          <p className="break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">Manual key: {setup.secret}</p>
          <Input label="6-digit code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setSetup(null)}>Cancel</Button><Button loading={isLoading} disabled={code.length !== 6} onClick={async () => { if (await call({ action: "enable", code })) { setSetup(null); setCode(""); dispatch(pushToast({ kind: "success", title: "Two-factor enabled" })); } }}>Enable</Button></div>
        </div>
      ) : <Button loading={isLoading} onClick={async () => { const r = await call({ action: "setup" }); if (r) setSetup({ qr: r.qr, secret: r.secret }); }}>Set up authenticator</Button>}
    </Card>
  );
}
