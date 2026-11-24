"use client";
import { Snowflake, Wallet } from "lucide-react";
import { label } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { AccountDTO } from "@/types/api";
import { Money, StatusBadge } from "../ui";

const SKIN: Record<string, string> = {
  SAVINGS: "from-[#0f5f59] to-[#0a3a3a]",
  CURRENT: "from-[#1e4f7a] to-[#12304d]",
  BUSINESS: "from-[#7a5a1e] to-[#4a3510]",
};

/** Visual account card with balance and a "share of total" meter. */
export function AccountCard({ a, total, selected, onClick, className }: { a: AccountDTO; total?: number; selected?: boolean; onClick?: () => void; className?: string }) {
  const share = total && total > 0 ? Math.min(100, Math.round((a.balance / total) * 100)) : null;
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={cn("relative w-full overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left text-white shadow-card transition", SKIN[a.type] ?? SKIN.SAVINGS, onClick && "hover:-translate-y-0.5 hover:shadow-pop", selected && "ring-2 ring-accent ring-offset-2 ring-offset-bg", a.status !== "ACTIVE" && "opacity-90 saturate-50", className)}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full border border-white/15" />
      <div aria-hidden className="pointer-events-none absolute -right-2 -top-2 size-24 rounded-full border border-white/10" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-medium text-white/80"><Wallet className="size-4" />{a.nickname || `${label(a.type)} account`}</div>
        {a.status !== "ACTIVE" ? <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">{a.status === "FROZEN" && <Snowflake className="size-3" />}{label(a.status)}</span> : <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">{label(a.type)}</span>}
      </div>
      <p className="tabular relative mt-5 text-[28px] font-semibold tracking-tight"><Money value={a.balance} /></p>
      <p className="relative mt-0.5 text-xs text-white/65">Available <span className="tabular font-semibold text-white/90"><Money value={a.availableBalance} /></span></p>
      <div className="relative mt-5 flex items-end justify-between">
        <p className="font-mono text-[13px] tracking-wider text-white/85">•••• •••• {a.accountNumber.slice(-4)}</p>
        {share !== null && <p className="text-[11px] text-white/65">{share}% of total</p>}
      </div>
      {share !== null && <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} /></div>}
    </Comp>
  );
}

export function AccountStatus({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}
