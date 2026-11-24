"use client";
import {
  ArrowLeftRight, Banknote, Bell, CheckCheck, ClipboardCheck, FileClock, Flag, Landmark, LayoutDashboard, LogOut, Menu, Monitor, Moon, Settings, ShieldCheck, Sun, UserCog, Users, Wallet, X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Role } from "@/lib/constants";
import { HOME_BY_ROLE, label } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { useGetMeQuery, useListNotificationsQuery, useMarkNotificationsMutation, useStaffDashboardQuery } from "@/store/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setTheme, toggleSidebar } from "@/store/slices/uiSlice";
import { Brand } from "./brand";
import { Avatar } from "./ui";

type NavItem = { href: string; label: string; icon: ReactNode; badge?: "requests" | "flags" | "loans" | "notifications" };
const i = (C: typeof Wallet) => <C className="size-[18px]" />;

export const NAV: Record<Role, NavItem[]> = {
  CUSTOMER: [
    { href: "/customer", label: "Overview", icon: i(LayoutDashboard) },
    { href: "/customer/accounts", label: "My Accounts", icon: i(Wallet) },
    { href: "/customer/transfer", label: "Transfer Money", icon: i(ArrowLeftRight) },
    { href: "/customer/transactions", label: "Transactions", icon: i(FileClock) },
    { href: "/customer/requests", label: "Deposit & Withdraw", icon: i(Banknote) },
    { href: "/customer/loans", label: "Loans", icon: i(Landmark) },
    { href: "/customer/settings", label: "Security & Settings", icon: i(Settings) },
  ],
  STAFF: [
    { href: "/staff", label: "Overview", icon: i(LayoutDashboard) },
    { href: "/staff/customers", label: "Customers", icon: i(Users) },
    { href: "/staff/accounts", label: "Accounts", icon: i(Wallet) },
    { href: "/staff/transactions", label: "Transactions", icon: i(FileClock) },
    { href: "/staff/requests", label: "Requests", icon: i(ClipboardCheck), badge: "requests" },
    { href: "/staff/loans", label: "Loan Applications", icon: i(Landmark), badge: "loans" },
    { href: "/staff/settings", label: "Security", icon: i(Settings) },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview", icon: i(LayoutDashboard) },
    { href: "/admin/customers", label: "Customers", icon: i(Users) },
    { href: "/admin/accounts", label: "Accounts", icon: i(Wallet) },
    { href: "/admin/transactions", label: "Transactions", icon: i(FileClock) },
    { href: "/admin/requests", label: "Requests", icon: i(ClipboardCheck), badge: "requests" },
    { href: "/admin/loans", label: "Loans", icon: i(Landmark), badge: "loans" },
    { href: "/admin/flags", label: "Flagged Activity", icon: i(Flag), badge: "flags" },
    { href: "/admin/staff", label: "Bank Staff", icon: i(UserCog) },
    { href: "/admin/limits", label: "Limits & Rules", icon: i(ShieldCheck) },
    { href: "/admin/audit", label: "Audit Log", icon: i(FileClock) },
    { href: "/admin/settings", label: "Security", icon: i(Settings) },
  ],
};

function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const path = usePathname();
  const { data: me } = useGetMeQuery();
  const counts = useStaffDashboardQuery(undefined, { skip: role === "CUSTOMER", pollingInterval: 60_000 });
  const badges: Record<string, number> = { requests: counts.data?.stats.pendingRequests ?? 0, loans: counts.data?.stats.loansToReview ?? 0, flags: counts.data?.stats.openFlags ?? 0 };
  const isActive = (href: string) => (href === HOME_BY_ROLE[role] ? path === href : path === href || path.startsWith(href + "/"));
  return (
    <div className="flex h-full flex-col bg-side text-side-ink">
      <div className="flex h-[68px] shrink-0 items-center justify-between px-5">
        <Brand light />
        {onNavigate && (
          <button onClick={onNavigate} aria-label="Close menu" className="rounded-lg p-1.5 text-side-muted hover:bg-side-hover lg:hidden">
            <X className="size-5" />
          </button>
        )}
      </div>
      <p className="px-5 pb-2 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-side-muted">{label(role)} workspace</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {NAV[role].map((n) => {
          const active = isActive(n.href);
          const count = n.badge ? badges[n.badge] : 0;
          return (
            <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition", active ? "bg-side-hover text-white" : "text-side-muted hover:bg-side-hover/60 hover:text-side-ink")}>
              {active && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />}
              <span className={cn(active ? "text-accent" : "text-side-muted group-hover:text-side-ink")}>{n.icon}</span>
              <span className="flex-1 truncate">{n.label}</span>
              {count > 0 && <span className="tabular rounded-full bg-accent px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-[#1a1305]">{count}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar name={me?.name ?? "…"} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{me?.name ?? "Loading…"}</p>
            <p className="truncate text-[11.5px] text-side-muted">{me?.email}</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-side-muted transition hover:bg-side-hover hover:text-white">
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const theme = useAppSelector((s) => s.ui.theme);
  const dispatch = useAppDispatch();
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button onClick={() => dispatch(setTheme(next))} aria-label={`Theme: ${theme}. Switch to ${next}`} title={`Theme: ${theme}`} className="grid size-10 place-items-center rounded-xl border border-border bg-surface text-muted transition hover:text-ink">
      <Icon className="size-[18px]" />
    </button>
  );
}

function NotificationBell({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data } = useListNotificationsQuery({ pageSize: 8 }, { pollingInterval: 30_000 });
  const [mark] = useMarkNotificationsMutation();
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);
  const unread = data?.unread ?? 0;
  const ago = (d: string | Date) => {
    const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative grid size-10 place-items-center rounded-xl border border-border bg-surface text-muted transition hover:text-ink">
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="tabular absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[18px] text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[72px] z-50 animate-fade-in overflow-hidden rounded-2xl border border-border bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button disabled={!unread} onClick={() => mark({ all: true })} className="flex items-center gap-1 text-xs font-medium text-primary disabled:opacity-40">
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto">
            {data?.items.length ? (
              data.items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => { if (!n.read) mark({ ids: [n.id] }); setOpen(false); if (n.link) router.push(n.link.startsWith("/customer") && role !== "CUSTOMER" ? HOME_BY_ROLE[role] : n.link); }}
                    className={cn("flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface-2", !n.read && "bg-primary-soft/40")}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-muted">{n.message}</span>
                      <span className="mt-1 block text-[11px] text-muted/80">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-10 text-center text-sm text-muted">You are all caught up.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const open = useAppSelector((s) => s.ui.sidebarOpen);
  const dispatch = useAppDispatch();
  const path = usePathname();
  useEffect(() => { dispatch(toggleSidebar(false)); }, [path, dispatch]);
  return (
    <div className="min-h-dvh lg:pl-[264px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block">
        <Sidebar role={role} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/55" onClick={() => dispatch(toggleSidebar(false))} />
          <aside className="absolute inset-y-0 left-0 w-[284px] max-w-[86vw] animate-slide-in">
            <Sidebar role={role} onNavigate={() => dispatch(toggleSidebar(false))} />
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button onClick={() => dispatch(toggleSidebar(true))} aria-label="Open menu" className="grid size-10 place-items-center rounded-xl border border-border bg-surface text-ink lg:hidden">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <p className="hidden items-center gap-2 text-sm text-muted lg:flex"><span className="size-1.5 rounded-full bg-success" aria-hidden /> Secure session</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell role={role} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
