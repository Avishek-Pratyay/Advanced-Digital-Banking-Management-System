import { route } from "@/server/http";
import { NextResponse } from "next/server";
import { getStatement } from "@/server/services/accounts";

export const dynamic = "force-dynamic";
const csvCell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET = route("any", async ({ req, user, params }) => {
  const sp = req.nextUrl.searchParams;
  const st = await getStatement(user, params.id, { from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  if (sp.get("format") !== "csv") return st;
  const lines = [
    `Vaultline Bank - Account Statement`,
    `Account,${csvCell(st.account.accountNumber)}`,
    `Holder,${csvCell(st.account.owner)}`,
    `Period,${st.period.from} to ${st.period.to}`,
    `Opening balance,${st.openingBalance.toFixed(2)}`,
    `Closing balance,${st.closingBalance.toFixed(2)}`,
    "",
    "Date,Transaction ID,Type,Description,Debit,Credit,Balance",
    ...st.entries.map((e) => [new Date(e.date).toISOString(), e.txnId, e.type, e.description, e.debit ? e.debit.toFixed(2) : "", e.credit ? e.credit.toFixed(2) : "", e.balance.toFixed(2)].map(csvCell).join(",")),
  ];
  return new NextResponse(lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="statement-${st.account.accountNumber}-${st.period.from}_${st.period.to}.csv"`, "Cache-Control": "no-store" } });
});
