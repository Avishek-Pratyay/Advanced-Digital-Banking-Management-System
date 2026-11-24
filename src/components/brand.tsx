import { cn } from "@/lib/cn";

/** Vaultline mark: a vault door dial built from two arcs and a keyway. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <circle cx="16" cy="16" r="8.2" fill="none" stroke="#0a2323" strokeWidth="2.4" />
      <path d="M16 7.8v4.4M16 19.8v4.4M7.8 16h4.4M19.8 16h4.4" stroke="#0a2323" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.3" fill="#0a2323" />
    </svg>
  );
}
export function Brand({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-tight">
        <p className={cn("text-[17px] font-semibold tracking-tight", light ? "text-side-ink" : "text-ink")}>Vaultline</p>
        <p className={cn("text-[10px] font-medium uppercase tracking-[0.18em]", light ? "text-side-muted" : "text-muted")}>Digital Bank</p>
      </div>
    </div>
  );
}
