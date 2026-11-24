"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, TrendingUp } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Brand } from "@/components/brand";
import { Button, Input } from "@/components/ui";
import { HOME_BY_ROLE } from "@/lib/constants";
import { loginSchema } from "@/lib/validators";

type Values = z.infer<typeof loginSchema>;
const DEMOS = [
  { role: "Customer", email: "alice@vaultline.test", hint: "Accounts, transfers, loans" },
  { role: "Bank Staff", email: "staff@vaultline.test", hint: "Onboarding & reviews" },
  { role: "Admin", email: "admin@vaultline.test", hint: "Full control & analytics" },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(params.get("expired") ? "Your session expired. Please sign in again." : null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = async (v: Values) => {
    setError(null);
    const res = await signIn("credentials", { email: v.email, password: v.password, redirect: false });
    if (res?.error) {
      setError(res.error === "CredentialsSignin" ? "Invalid email or password" : res.error);
      return;
    }
    const session = await getSession();
    const cb = params.get("callbackUrl");
    const home = session?.user ? HOME_BY_ROLE[session.user.role] : "/";
    router.replace(cb && cb.startsWith(home) ? cb : home);
    router.refresh();
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* brand panel */}
      <aside className="relative hidden overflow-hidden bg-side p-12 text-side-ink lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-[380px] rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[480px] rounded-full bg-primary/20 blur-3xl" />
        <Link href="/" aria-label="Vaultline home" className="relative w-fit"><Brand light /></Link>
        <div className="relative max-w-md">
          <h1 className="text-[42px] font-semibold leading-[1.06] tracking-[-0.03em]">Banking that shows its working.</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-side-muted">See the balance before and after every transfer, with a permanent record behind each one.</p>
          <ul className="mt-8 space-y-3.5 text-sm">
            {[[ShieldCheck, "Transfers confirmed with your PIN"], [TrendingUp, "Live spending and deposit insights"], [Lock, "Only you can see your accounts"]].map(([Icon, t], idx) => {
              const I = Icon as typeof Lock;
              return (
                <li key={idx} className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-white/10 text-accent"><I className="size-4" /></span>{t as string}</li>
              );
            })}
          </ul>
        </div>
        <p className="relative text-xs text-side-muted">Demonstration product. No real money is held or moved.</p>
      </aside>

      {/* form */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Brand /></div>
          <h2 className="text-[28px] font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1.5 text-sm text-muted">Access your accounts, transfers and loans.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
            {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</div>}
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-[38px] size-4 text-muted" />
              <Input label="Email" type="email" autoComplete="username" placeholder="you@example.com" className="pl-10" error={errors.email?.message} {...register("email")} />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-[38px] size-4 text-muted" />
              <Input label="Password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Your password" className="px-10" error={errors.password?.message} {...register("password")} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-[35px] rounded p-1 text-muted hover:text-ink">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={!isSubmitting ? undefined : undefined}>
              Sign in <ArrowRight className="size-4" />
            </Button>
          </form>

          <details className="group mt-8 rounded-2xl border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-medium">
              Try a demo account
              <span className="text-xs font-normal text-muted transition group-open:rotate-180">▾</span>
            </summary>
            <div className="border-t border-border p-4">
              <p className="mb-3 text-[13px] text-muted">Pick a role to fill in the sign-in form. All demo accounts use the password <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">Password@123</code>.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {DEMOS.map((d) => (
                  <button key={d.email} type="button" onClick={() => { setValue("email", d.email); setValue("password", "Password@123"); setError(null); }} className="rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition hover:border-primary hover:bg-primary-soft">
                    <span className="block text-[13px] font-semibold">{d.role}</span>
                    <span className="block text-[11px] leading-tight text-muted">{d.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}
