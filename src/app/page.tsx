import { getServerSession } from "next-auth";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Check, FileText, KeyRound, Landmark, Lock, ScanSearch, ShieldCheck, Snowflake, Smartphone } from "lucide-react";
import { Brand } from "@/components/brand";
import { HOME_BY_ROLE, LOAN_PRODUCTS, type LoanType } from "@/lib/constants";
import { authOptions } from "@/server/auth";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const term = (m: number) => (m % 12 === 0 ? `${m / 12} years` : `${m} months`);

const ACCOUNTS = [
  { name: "Savings", who: "For money you want to keep", points: ["Move money to any account in seconds", "Set your own daily transfer limit", "Download statements as PDF or CSV"] },
  { name: "Current", who: "For everyday spending", points: ["Send to any Vaultline customer by account number", "Receipts with a unique reference for every transfer", "Instant notifications on money in and out"] },
  { name: "Business", who: "For companies and sole traders", points: ["Higher limits you can adjust with the bank", "Separate accounts for each purpose", "Full transaction history, searchable by ID"] },
];

const STEPS = [
  { t: "Check", d: "Your PIN, the recipient, both account statuses and your limits are verified on the server." },
  { t: "Lock", d: "Both accounts are locked for the length of the transfer, so two payments can never spend the same money." },
  { t: "Move", d: "The amount and fee leave one account and arrive in the other as a single operation." },
  { t: "Record", d: "A permanent ledger entry is written for each side, with the balance before and after." },
];

const CONTROLS = [
  { icon: KeyRound, t: "Transaction PIN", d: "Every transfer needs your PIN. Three wrong attempts lock it for 15 minutes." },
  { icon: Smartphone, t: "Two-factor authentication", d: "Add an authenticator app to confirm transfers, withdrawals and loan repayments." },
  { icon: ScanSearch, t: "Unusual activity checks", d: "Large, rapid or out-of-pattern payments are flagged for review by the bank." },
  { icon: Snowflake, t: "Freeze when needed", d: "The bank can freeze an account immediately. Frozen accounts cannot send or receive." },
  { icon: Lock, t: "Your data stays yours", d: "You only ever see your own accounts and transactions. Access is checked on every request." },
  { icon: FileText, t: "A record you can rely on", d: "Transactions are never edited or deleted. A reversal is a new entry, so history stays intact." },
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  const home = session?.user ? HOME_BY_ROLE[session.user.role] : null;
  const loanRows = (Object.keys(LOAN_PRODUCTS) as LoanType[]).map((k) => ({ k, ...LOAN_PRODUCTS[k] }));

  return (
    <div className="bg-bg text-ink">
      {/* ───── hero ───── */}
      <section className="relative overflow-hidden bg-side text-side-ink">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full border border-white/[0.07]" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-[440px] rounded-full border border-white/[0.07]" />
        <header className="relative mx-auto flex h-20 max-w-[1200px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Vaultline home"><Brand light /></Link>
          <nav aria-label="Primary" className="hidden items-center gap-8 text-sm text-side-muted md:flex">
            <a href="#accounts" className="hover:text-side-ink">Accounts</a>
            <a href="#transfers" className="hover:text-side-ink">Transfers</a>
            <a href="#loans" className="hover:text-side-ink">Loans</a>
            <a href="#security" className="hover:text-side-ink">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            {home ? (
              <Link href={home} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#1a1304] transition hover:brightness-110">Go to dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-xl px-4 py-2.5 text-sm font-medium text-side-ink transition hover:bg-white/10 sm:block">Sign in</Link>
                <Link href="/login" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#1a1304] transition hover:brightness-110">Open an account</Link>
              </>
            )}
          </div>
        </header>

        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1fr_520px] lg:pb-28 lg:pt-16">
          <div>
            <h1 className="max-w-[16ch] text-[44px] font-semibold leading-[1.04] tracking-[-0.03em] sm:text-[60px] lg:text-[68px]">Banking that shows its working.</h1>
            <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-side-muted">Every transfer is checked, locked and written to a permanent ledger in one step. You see the balance before, the balance after, and a reference for both sides.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={home ?? "/login"} className="rounded-xl bg-accent px-6 py-3.5 text-[15px] font-semibold text-[#1a1304] transition hover:brightness-110">{home ? "Go to dashboard" : "Open an account"}</Link>
              {!home && <Link href="/login" className="rounded-xl border border-white/20 px-6 py-3.5 text-[15px] font-medium transition hover:bg-white/10">Sign in</Link>}
            </div>
            <p className="mt-8 flex items-center gap-2 text-sm text-side-muted"><ShieldCheck className="size-4 text-accent" /> PIN-protected transfers with optional two-factor authentication</p>
          </div>

          {/* the statement */}
          <figure aria-label="Example account statement" className="relative">
            <div className="rounded-[20px] bg-surface p-2 text-ink shadow-pop ring-1 ring-white/10">
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <div>
                  <p className="text-[13px] text-muted">Everyday account</p>
                  <p className="tabular mt-0.5 text-[28px] font-semibold tracking-tight">$16,766.41</p>
                </div>
                <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">Active</span>
              </div>
              <div className="overflow-hidden rounded-[14px] bg-surface-2">
                <Row icon="in" title="Deposit approved" meta="Nov 18" amount="+3,200.00" bal="16,500.00" />
                <div className="border-y border-primary/30 bg-primary-soft px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <Dot kind="out" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Transfer to D. Okafor</p><p className="text-xs text-muted">Nov 21 · Rent share</p></div>
                    <p className="tabular text-sm font-semibold">−450.50</p>
                  </div>
                  <dl className="tabular mt-3 grid grid-cols-3 gap-2 border-t border-primary/20 pt-3 text-xs">
                    <div><dt className="text-muted">Before</dt><dd className="mt-0.5 font-medium">16,500.00</dd></div>
                    <div><dt className="text-muted">Fee</dt><dd className="mt-0.5 font-medium">0.50</dd></div>
                    <div><dt className="text-muted">After</dt><dd className="mt-0.5 font-medium">16,049.50</dd></div>
                  </dl>
                  <p className="mt-2.5 font-mono text-[11px] text-muted">TXN-20261121-S0000412</p>
                </div>
                <Row icon="out" title="Loan repayment" meta="Nov 22" amount="−533.09" bal="15,516.41" />
                <Row icon="in" title="Transfer from A. Morgan" meta="Nov 23" amount="+1,250.00" bal="16,766.41" />
              </div>
              <p className="px-4 pb-3 pt-3 text-[11px] text-muted">Sample statement. Every entry carries the balance after it posted.</p>
            </div>
          </figure>
        </div>
      </section>

      {/* ───── accounts ───── */}
      <section id="accounts" className="scroll-mt-4 mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[360px_1fr] lg:gap-20">
          <div>
            <h2 className="text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">An account for each way you use money</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">Open as many as you need. Switch between them from one dashboard and see everything in a single balance.</p>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {ACCOUNTS.map((a) => (
              <li key={a.name} className="grid gap-4 py-8 sm:grid-cols-[200px_1fr]">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{a.name}</h3>
                  <p className="mt-1 text-sm text-muted">{a.who}</p>
                </div>
                <ul className="space-y-2.5">
                  {a.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[15px]"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{p}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───── transfers ───── */}
      <section id="transfers" className="scroll-mt-4 border-y border-border bg-surface">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-28">
          <h2 className="max-w-[22ch] text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">What happens when you press send</h2>
          <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-muted">A transfer either completes on both sides or does not happen at all. There is no state where money has left one account and not arrived in the other.</p>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="bg-surface p-6">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-fg">{i + 1}</span>
                <h3 className="mt-5 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── loans ───── */}
      <section id="loans" className="scroll-mt-4 mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[360px_1fr] lg:gap-20">
          <div>
            <h2 className="text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">Loans with the repayment plan up front</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">Apply online, follow your application as it is reviewed, and see every instalment, the interest in it and your remaining balance.</p>
            <Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition hover:brightness-110"><Landmark className="size-4" /> Apply for a loan</Link>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[13px] text-muted">
                  <th className="px-5 py-3.5 font-medium">Loan</th>
                  <th className="px-5 py-3.5 font-medium">Interest</th>
                  <th className="px-5 py-3.5 font-medium">Amount</th>
                  <th className="px-5 py-3.5 font-medium">Up to</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-border">
                {loanRows.map((l) => (
                  <tr key={l.k}>
                    <td className="px-5 py-4 font-medium">{l.label}</td>
                    <td className="px-5 py-4">{(l.interestBps / 100).toFixed(l.interestBps % 100 ? 1 : 0)}% a year</td>
                    <td className="px-5 py-4 text-muted">{usd(l.minAmount)} to {usd(l.maxAmount)}</td>
                    <td className="px-5 py-4 text-muted">{term(l.maxMonths)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-5 py-3 text-xs text-muted">Interest is charged on the remaining balance, so each instalment pays down more principal over time. Loans are subject to approval.</p>
          </div>
        </div>
      </section>

      {/* ───── security ───── */}
      <section id="security" className="scroll-mt-4 bg-side text-side-ink">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-28">
          <h2 className="max-w-[20ch] text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">Protection that does not depend on you remembering</h2>
          <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-accent"><Icon className="size-5" /></span>
                <div>
                  <h3 className="text-[16px] font-semibold">{t}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-side-muted">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── closing ───── */}
      <section className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-24">
        <div className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-border bg-surface p-8 sm:p-12 lg:flex-row lg:items-center">
          <div>
            <h2 className="max-w-[20ch] text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">Open your first account in a few minutes</h2>
            <p className="mt-3 max-w-[48ch] text-[16px] text-muted">Sign in to see your accounts, send money and track every transaction.</p>
          </div>
          <Link href={home ?? "/login"} className="shrink-0 rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-fg transition hover:brightness-110">{home ? "Go to dashboard" : "Get started"}</Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-10 text-sm text-muted sm:px-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[40ch]">
            <Brand />
            <p className="mt-4 leading-relaxed">Vaultline is a demonstration banking product. No real money is held or moved, and no real payment details should be entered.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
            <a href="#accounts" className="hover:text-ink">Accounts</a>
            <a href="#transfers" className="hover:text-ink">Transfers</a>
            <a href="#loans" className="hover:text-ink">Loans</a>
            <a href="#security" className="hover:text-ink">Security</a>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Dot({ kind }: { kind: "in" | "out" }) {
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${kind === "in" ? "bg-success-soft text-success" : "bg-surface text-ink ring-1 ring-border"}`}>
      {kind === "in" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
    </span>
  );
}
function Row({ icon, title, meta, amount, bal }: { icon: "in" | "out"; title: string; meta: string; amount: string; bal: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Dot kind={icon} />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{title}</p><p className="text-xs text-muted">{meta}</p></div>
      <div className="tabular text-right"><p className={`text-sm font-semibold ${icon === "in" ? "text-success" : ""}`}>{amount}</p><p className="text-xs text-muted">{bal}</p></div>
    </div>
  );
}
