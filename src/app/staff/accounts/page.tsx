"use client";
import { AccountManager } from "@/components/staff/accounts";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Bank accounts" description="View customer account details." />
      <AccountManager role="STAFF" />
    </>
  );
}
