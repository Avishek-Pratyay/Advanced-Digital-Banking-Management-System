"use client";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { AccountCard } from "@/components/shared/account-card";
import { TransactionDetailModal } from "@/components/shared/transactions";
import { TransactionTable } from "@/components/shared/transactions";
import { Button, Card, CardHeader, DataRow, EmptyState, ErrorState, Input, Modal, Money, PageHeader, Skeleton, StatusBadge } from "@/components/ui";
import { label } from "@/lib/constants";
import { downloadStatementPdf } from "@/lib/pdf";
import { toApiError } from "@/lib/forms";
import { useLazyGetStatementQuery, useListAccountsQuery, useListTransactionsQuery } from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { openTransaction } from "@/store/slices/transactionSlice";
import { pushToast } from "@/store/slices/uiSlice";
import type { AccountDTO } from "@/types/api";
import { Wallet } from "lucide-react";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function AccountsPage() {
  const { data, isLoading, isError, refetch } = useListAccountsQuery({ pageSize: 20 });
  const [open, setOpen] = useState<AccountDTO | null>(null);
  const total = data?.items.reduce((s, a) => s + a.balance, 0) ?? 0;
  return (
    <>
      <PageHeader title="My accounts" description="Balances, limits and downloadable statements for each of your accounts." />
      {isError ? <ErrorState onRetry={refetch} /> : isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[190px] rounded-2xl" />)}</div>
      ) : !data?.items.length ? (
        <Card><EmptyState icon={<Wallet />} title="No accounts yet" description="Visit a branch or contact support to open your first account." /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((a) => (
            <div key={a.id} className="space-y-3">
              <AccountCard a={a} total={total} />
              <Button variant="secondary" className="w-full" onClick={() => setOpen(a)}>Details & statements</Button>
            </div>
          ))}
        </div>
      )}
      {open && <AccountModal account={open} onClose={() => setOpen(null)} />}
      <TransactionDetailModal viewer="CUSTOMER" />
    </>
  );
}

function AccountModal({ account: a, onClose }: { account: AccountDTO; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [getStatement] = useLazyGetStatementQuery();
  const recent = useListTransactionsQuery({ accountId: a.id, pageSize: 5 });
  const bad = !from || !to || from > to;

  const pdf = async () => {
    setBusy("pdf");
    try {
      const st = await getStatement({ id: a.id, from, to }).unwrap();
      await downloadStatementPdf(st);
    } catch (e) { dispatch(pushToast({ kind: "error", title: "Statement failed", message: toApiError(e).message })); }
    finally { setBusy(null); }
  };
  const csv = () => {
    setBusy("csv");
    // plain navigation download: the server sets Content-Disposition and enforces ownership
    window.location.href = `/api/accounts/${a.id}/statement?format=csv&from=${from}&to=${to}`;
    setTimeout(() => setBusy(null), 1200);
  };
  return (
    <Modal open onClose={onClose} size="lg" title={a.nickname || `${label(a.type)} account`} description={a.accountNumber}>
      <div className="space-y-6">
        <dl className="rounded-xl border border-border px-4">
          <DataRow label="Account number" mono>{a.accountNumber}</DataRow>
          <DataRow label="Account type">{label(a.type)}</DataRow>
          <DataRow label="Status"><StatusBadge status={a.status} /></DataRow>
          <DataRow label="Current balance"><Money value={a.balance} /></DataRow>
          <DataRow label="Available balance"><Money value={a.availableBalance} /></DataRow>
          <DataRow label="Daily transfer limit"><Money value={a.effectiveLimits.daily} /></DataRow>
          <DataRow label="Max per transaction"><Money value={a.effectiveLimits.single} /></DataRow>
          <DataRow label="Minimum balance"><Money value={a.effectiveLimits.minBalance} /></DataRow>
        </dl>
        <div>
          <CardHeader title="Download statement" description="Generated from the immutable ledger." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} min={from} max={iso(new Date())} onChange={(e) => setTo(e.target.value)} />
          </div>
          {bad && <p className="mt-2 text-xs font-medium text-danger">Choose a valid date range.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={bad} loading={busy === "csv"} icon={<FileSpreadsheet className="size-4" />} onClick={csv}>Download CSV</Button>
            <Button disabled={bad} loading={busy === "pdf"} icon={<FileText className="size-4" />} onClick={pdf}>Download PDF</Button>
          </div>
        </div>
        <div>
          <CardHeader title="Latest activity" />
          <div className="-mx-5 border-t border-border"><TransactionTable compact viewer="CUSTOMER" items={recent.data?.items} loading={recent.isLoading} onOpen={(id) => { dispatch(openTransaction(id)); }} /></div>
        </div>
      </div>
    </Modal>
  );
}
