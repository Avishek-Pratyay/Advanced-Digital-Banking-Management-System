"use client";
import { LoanList } from "@/components/shared/loans";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Loan applications" description="Approve or reject applications, disburse approved loans and inspect repayment history." />
      <LoanList role="ADMIN" />
    </>
  );
}
