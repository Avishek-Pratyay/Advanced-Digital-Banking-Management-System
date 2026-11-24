"use client";
import { PageHeader } from "@/components/ui";
import { TransactionHistory } from "@/components/shared/transactions";

export default function CustomerTransactions() {
  return (
    <>
      <PageHeader title="Transactions" description="Search, filter and open any transaction to see the full ledger trail or download a receipt." />
      <TransactionHistory viewer="CUSTOMER" />
    </>
  );
}
