"use client";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect } from "react";
import { dismissToast } from "@/store/slices/uiSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/cn";

/** Slim indeterminate bar driven by the centralised Redux request counter. */
export function TopProgress() {
  const pending = useAppSelector((s) => s.ui.pendingRequests);
  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity", pending > 0 ? "opacity-100" : "opacity-0")}>
      <div className="h-full w-1/3 animate-progress bg-primary" />
    </div>
  );
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONES = { success: "text-success", error: "text-danger", info: "text-info" };

export function Toaster() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  return (
    <div role="region" aria-label="Notifications" className="pointer-events-none fixed inset-x-3 bottom-3 z-[90] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}

function ToastItem({ id, kind, title, message }: { id: string; kind: "success" | "error" | "info"; title: string; message?: string }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const h = setTimeout(() => dispatch(dismissToast(id)), kind === "error" ? 7000 : 4500);
    return () => clearTimeout(h);
  }, [id, kind, dispatch]);
  const Icon = ICONS[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className="pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-pop">
      <Icon className={cn("mt-0.5 size-5 shrink-0", TONES[kind])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {message && <p className="mt-0.5 break-words text-[13px] text-muted">{message}</p>}
      </div>
      <button onClick={() => dispatch(dismissToast(id))} aria-label="Dismiss" className="rounded p-0.5 text-muted hover:text-ink">
        <X className="size-4" />
      </button>
    </div>
  );
}
