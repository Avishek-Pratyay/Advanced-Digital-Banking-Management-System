"use client";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { label as labelOf } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

export { cn };

/* ------------------------------------------------------------------ Button */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode };
const BTN = {
  primary: "bg-primary text-primary-fg hover:bg-primary/90 shadow-sm",
  secondary: "border border-border bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink/80 hover:bg-primary-soft hover:text-primary",
  danger: "bg-danger text-white hover:bg-danger/90 shadow-sm",
  accent: "bg-accent text-white hover:bg-accent/90 shadow-sm",
};
const BTN_SIZE = { sm: "h-8 gap-1.5 px-3 text-[13px]", md: "h-10 gap-2 px-4 text-sm", lg: "h-12 gap-2 px-6 text-[15px]" };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...p }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cn("inline-flex shrink-0 items-center justify-center rounded-xl font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55", BTN[variant], BTN_SIZE[size], className)} {...p}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ Fields */
export function Field({ label, error, hint, children, className, htmlFor }: { label?: string; error?: string; hint?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
type FieldProps = { label?: string; error?: string; hint?: string; wrapperClassName?: string };
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input({ label, error, hint, wrapperClassName, className, id, ...p }, ref) {
  const gen = useId();
  const fid = id ?? gen;
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClassName} htmlFor={fid}>
      <input ref={ref} id={fid} aria-invalid={!!error} className={cn("input", error && "input-error", className)} {...p} />
    </Field>
  );
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(function Textarea({ label, error, hint, wrapperClassName, className, id, ...p }, ref) {
  const gen = useId();
  const fid = id ?? gen;
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClassName} htmlFor={fid}>
      <textarea ref={ref} id={fid} rows={3} aria-invalid={!!error} className={cn("input resize-y", error && "input-error", className)} {...p} />
    </Field>
  );
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(function Select({ label, error, hint, wrapperClassName, className, id, children, ...p }, ref) {
  const gen = useId();
  const fid = id ?? gen;
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClassName} htmlFor={fid}>
      <select ref={ref} id={fid} aria-invalid={!!error} className={cn("input appearance-none bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10", error && "input-error", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23808f8c'%3E%3Cpath d='M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z'/%3E%3C/svg%3E\")" }} {...p}>
        {children}
      </select>
    </Field>
  );
});

/* -------------------------------------------------------------------- Card */
export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cn("card", padded && "p-5", className)}>{children}</div>;
}
export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = "primary", loading }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: "primary" | "accent" | "success" | "warning" | "danger" | "info"; loading?: boolean }) {
  const tones = { primary: "bg-primary-soft text-primary", accent: "bg-accent-soft text-accent", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger", info: "bg-info-soft text-info" };
  return (
    <div className="card flex items-start justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        {loading ? <Skeleton className="mt-2 h-7 w-28" /> : <p className="tabular mt-1.5 truncate text-[22px] font-semibold tracking-tight sm:text-2xl">{value}</p>}
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {icon && <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&>svg]:size-5", tones[tone])}>{icon}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Badges */
const TONE: Record<string, string> = {
  ACTIVE: "success", COMPLETED: "success", APPROVED: "success", PAID: "success", CONFIRMED: "danger", DISMISSED: "neutral",
  PENDING: "warning", UNDER_REVIEW: "info", OPEN: "warning", INACTIVE: "neutral", CLOSED: "neutral",
  FROZEN: "info", REVERSED: "accent", BLOCKED: "danger", REJECTED: "danger", FAILED: "danger", SYSTEM: "accent", STAFF: "info",
};
const BADGE = {
  success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger", info: "bg-info-soft text-info", accent: "bg-accent-soft text-accent", neutral: "bg-surface-2 text-muted ring-1 ring-inset ring-border",
};
export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof BADGE; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", BADGE[tone], className)}>{children}</span>;
}
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const tone = (TONE[status] ?? "neutral") as keyof typeof BADGE;
  return (
    <Badge tone={tone}>
      <span className="size-1.5 rounded-full bg-current" />
      {labelOf(status)}
    </Badge>
  );
}

/* ------------------------------------------------------------- misc blocks */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-muted", className)} aria-label="Loading" />;
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-lg bg-border/60 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-surface/60 before:to-transparent", className)} />;
}
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary [&>svg]:size-6">{icon}</div>}
      <p className="text-[15px] font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return <EmptyState title="Something went wrong" description={message ?? "We could not load this data."} action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>} />;
}

export const Money = ({ value, currency = "USD", className, sign }: { value: number | null | undefined; currency?: string; className?: string; sign?: "IN" | "OUT" | null }) => (
  <span className={cn("tabular", sign === "IN" && "text-success", sign === "OUT" && "text-ink", className)}>
    {sign === "IN" ? "+" : sign === "OUT" ? "−" : ""}
    {formatMoney(value, currency)}
  </span>
);

export function DataRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border/70">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={cn("min-w-0 break-words text-right font-medium", mono && "font-mono text-[13px]")}>{children}</dd>
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.36 }} className="grid shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary">
      {initials || "?"}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-xl border border-border bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition", o.value === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Pagination */
export function Pagination({ page, totalPages, total, pageSize, onPage, loading }: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void; loading?: boolean }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-[13px] text-muted">
      <p className="tabular">
        Showing <b className="font-semibold text-ink">{from}–{to}</b> of <b className="font-semibold text-ink">{total}</b>
      </p>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} aria-label="Previous page" icon={<ChevronLeft className="size-4" />} />
        <span className="tabular min-w-20 text-center">Page {page} / {totalPages}</span>
        <Button size="sm" variant="secondary" disabled={page >= totalPages || loading} onClick={() => onPage(page + 1)} aria-label="Next page" icon={<ChevronRight className="size-4" />} />
      </div>
    </div>
  );
}

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto", className)}><table className="w-full min-w-[640px] border-collapse">{children}</table></div>;
}
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Modal etc. */
export function Modal({ open, onClose, title, description, children, footer, size = "md", dismissible = true }: { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl"; dismissible?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
        const list = Array.from(f).filter((x) => !x.hasAttribute("disabled"));
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-close])")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose, dismissible]);
  if (!open || !mounted) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => dismissible && onClose()} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cn("relative flex max-h-[92dvh] w-full animate-fade-in flex-col rounded-t-2xl border border-border bg-surface shadow-pop sm:rounded-2xl", widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {dismissible && (
            <button data-close onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink">
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation dialog (required for every irreversible banking action). Optional reason textarea. */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = "Confirm", tone = "primary", loading, reasonLabel, reasonRequired, children,
}: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void | Promise<void>; title: string; description?: ReactNode; confirmLabel?: string;
  tone?: "primary" | "danger"; loading?: boolean; reasonLabel?: string; reasonRequired?: boolean; children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  const invalid = !!reasonLabel && reasonRequired && reason.trim().length < 3;
  return (
    <Modal
      open={open} onClose={onClose} title={title} size="sm" dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} disabled={invalid} onClick={() => onConfirm(reason.trim())}>{confirmLabel}</Button>
        </>
      }
    >
      {description && <div className="text-sm text-muted">{description}</div>}
      {children}
      {reasonLabel && <Textarea className="mt-3" wrapperClassName="mt-3" label={reasonLabel} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a short note…" />}
    </Modal>
  );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return <span title={text}>{children}</span>;
}
