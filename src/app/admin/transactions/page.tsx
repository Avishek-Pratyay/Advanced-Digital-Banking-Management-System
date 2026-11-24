"use client";
import { TransactionHistory } from "@/components/shared/transactions";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Transactions" description="Search by transaction ID, filter by date and type, review pending items and flag anything suspicious." />
      <TransactionHistory viewer="ADMIN" showFlagged />
    </>
  );
}
