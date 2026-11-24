"use client";
import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/cn";
import { formatCompact, formatMoney } from "@/lib/money";
import { label } from "@/lib/constants";

type Colors = { primary: string; accent: string; success: string; danger: string; info: string; warning: string; muted: string; border: string; ink: string; surface: string };
const rgb = (name: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/\s+/g, " ");
  return v ? `rgb(${v})` : "#888";
};
const read = (): Colors => ({ primary: rgb("--primary"), accent: rgb("--accent"), success: rgb("--success"), danger: rgb("--danger"), info: rgb("--info"), warning: rgb("--warning"), muted: rgb("--muted"), border: rgb("--border"), ink: rgb("--ink"), surface: rgb("--surface") });

/** Chart colours follow the active light/dark theme (SVG attributes can't read Tailwind classes). */
export function useChartColors(): Colors {
  const [c, setC] = useState<Colors>({ primary: "#0e625c", accent: "#b88428", success: "#148058", danger: "#be3232", info: "#2a62a8", warning: "#b07014", muted: "#687471", border: "#e5e1d6", ink: "#152120", surface: "#fff" });
  useEffect(() => {
    setC(read());
    const mo = new MutationObserver(() => setC(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return c;
}

type TipProps = { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; money?: boolean; names?: Record<string, string> };
function Tip({ active, payload, label: l, money = true, names }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-xs shadow-pop">
      {l && <p className="mb-1.5 font-semibold text-ink">{l}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 py-0.5 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span>{names?.[p.dataKey] ?? p.name}</span>
          <b className="tabular ml-auto pl-4 text-ink">{money ? formatMoney(p.value) : p.value}</b>
        </p>
      ))}
    </div>
  );
}

const axis = (c: Colors) => ({ tick: { fill: c.muted, fontSize: 11 }, tickLine: false, axisLine: false } as const);
const H = 260;

export function VolumeAreaChart({ data }: { data: { month: string; volume: number }[] }) {
  const c = useChartColors();
  const hasData = data.some((d) => d.volume > 0);
  return (
    <ChartFrame empty={!hasData}>
      <ResponsiveContainer width="100%" height={H}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.primary} stopOpacity={0.35} />
              <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 4" />
          <XAxis dataKey="month" {...axis(c)} interval="preserveStartEnd" />
          <YAxis {...axis(c)} tickFormatter={(v) => `$${formatCompact(v)}`} width={54} />
          <Tooltip content={<Tip names={{ volume: "Volume" }} />} cursor={{ stroke: c.border }} />
          <Area type="monotone" dataKey="volume" stroke={c.primary} strokeWidth={2.4} fill="url(#vol)" activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function DepositWithdrawalChart({ data }: { data: { month: string; deposits: number; withdrawals: number }[] }) {
  const c = useChartColors();
  return (
    <ChartFrame empty={!data.some((d) => d.deposits || d.withdrawals)}>
      <ResponsiveContainer width="100%" height={H}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={3}>
          <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 4" />
          <XAxis dataKey="month" {...axis(c)} interval="preserveStartEnd" />
          <YAxis {...axis(c)} tickFormatter={(v) => `$${formatCompact(v)}`} width={54} />
          <Tooltip content={<Tip names={{ deposits: "Deposits", withdrawals: "Withdrawals" }} />} cursor={{ fill: c.border, opacity: 0.35 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.muted }} />
          <Bar dataKey="deposits" name="Deposits" fill={c.success} radius={[5, 5, 0, 0]} maxBarSize={18} />
          <Bar dataKey="withdrawals" name="Withdrawals" fill={c.accent} radius={[5, 5, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function DonutChart({ data, valueKey = "value", nameKey = "name", money, centerLabel, stack }: { data: Record<string, string | number>[]; valueKey?: string; nameKey?: string; money?: boolean; centerLabel?: string; stack?: boolean }) {
  const c = useChartColors();
  const palette = [c.primary, c.accent, c.info, c.danger, c.success, c.muted];
  const total = data.reduce((s, d) => s + Number(d[valueKey]), 0);
  return (
    <ChartFrame empty={total === 0}>
      <div className={cn("flex flex-col items-center gap-4", !stack && "sm:flex-row")}>
        <div className="relative h-[220px] w-full max-w-[240px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="64%" outerRadius="94%" paddingAngle={2} stroke="none" cornerRadius={4}>
                {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
              </Pie>
              <Tooltip content={<Tip money={money} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="tabular text-xl font-semibold">{money ? `$${formatCompact(total)}` : total}</p>
              {centerLabel && <p className="text-[11px] text-muted">{centerLabel}</p>}
            </div>
          </div>
        </div>
        <ul className="w-full space-y-2.5 text-sm">
          {data.map((d, i) => (
            <li key={String(d[nameKey])} className="flex items-center gap-2.5">
              <span className="size-2.5 rounded-full" style={{ background: palette[i % palette.length] }} />
              <span className="flex-1 truncate">{label(String(d[nameKey]))}</span>
              <span className="tabular font-semibold">{money ? formatMoney(Number(d[valueKey])) : d[valueKey]}</span>
              <span className="tabular w-10 text-right text-xs text-muted">{total ? Math.round((Number(d[valueKey]) / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}

export function SimpleBarChart({ data, xKey, yKey, color, money = true, names, horizontal }: { data: Record<string, string | number>[]; xKey: string; yKey: string; color?: keyof Colors; money?: boolean; names?: Record<string, string>; horizontal?: boolean }) {
  const c = useChartColors();
  const fill = c[color ?? "primary"];
  return (
    <ChartFrame empty={!data.some((d) => Number(d[yKey]) > 0)}>
      <ResponsiveContainer width="100%" height={H}>
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: horizontal ? 8 : -12, bottom: 0 }}>
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={c.border} strokeDasharray="3 4" />
          {horizontal ? (
            <>
              <XAxis type="number" {...axis(c)} allowDecimals={false} />
              <YAxis type="category" dataKey={xKey} {...axis(c)} width={92} tickFormatter={(v) => label(String(v))} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axis(c)} interval="preserveStartEnd" />
              <YAxis {...axis(c)} width={54} allowDecimals={false} tickFormatter={(v) => (money ? `$${formatCompact(v)}` : String(v))} />
            </>
          )}
          <Tooltip content={<Tip money={money} names={names} />} cursor={{ fill: c.border, opacity: 0.35 }} />
          <Bar dataKey={yKey} fill={fill} radius={horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]} maxBarSize={horizontal ? 22 : 26} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ActivityLineChart({ data }: { data: { month: string; transactions: number; newAccounts: number; newCustomers: number }[] }) {
  const c = useChartColors();
  return (
    <ChartFrame empty={!data.some((d) => d.transactions || d.newAccounts || d.newCustomers)}>
      <ResponsiveContainer width="100%" height={H}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 4" />
          <XAxis dataKey="month" {...axis(c)} interval="preserveStartEnd" />
          <YAxis {...axis(c)} allowDecimals={false} width={40} />
          <Tooltip content={<Tip money={false} names={{ transactions: "Transactions", newAccounts: "New accounts", newCustomers: "New customers" }} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.muted }} />
          <Line type="monotone" dataKey="transactions" name="Transactions" stroke={c.primary} strokeWidth={2.4} dot={false} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="newAccounts" name="New accounts" stroke={c.accent} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="newCustomers" name="New customers" stroke={c.info} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function DepositHistoryChart({ data }: { data: { month: string; deposits: number; received: number }[] }) {
  const c = useChartColors();
  return (
    <ChartFrame empty={!data.some((d) => d.deposits || d.received)}>
      <ResponsiveContainer width="100%" height={H}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="dep" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.success} stopOpacity={0.32} />
              <stop offset="100%" stopColor={c.success} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 4" />
          <XAxis dataKey="month" {...axis(c)} interval="preserveStartEnd" />
          <YAxis {...axis(c)} tickFormatter={(v) => `$${formatCompact(v)}`} width={54} />
          <Tooltip content={<Tip names={{ deposits: "Deposits", received: "Received" }} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.muted }} />
          <Area type="monotone" dataKey="deposits" name="Deposits" stroke={c.success} strokeWidth={2.4} fill="url(#dep)" />
          <Area type="monotone" dataKey="received" name="Received transfers" stroke={c.info} strokeWidth={2} fill="none" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function ChartFrame({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  if (empty) return <div className="grid h-[220px] place-items-center rounded-xl border border-dashed border-border text-sm text-muted">No data for this period yet</div>;
  return <>{children}</>;
}
