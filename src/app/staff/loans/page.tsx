"use client";
import { LoanList } from "@/components/shared/loans";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Loan applications" description="Review customer information, add internal notes and forward applications for administrator approval." />
      <LoanList role="STAFF" />
    </>
  );
}
