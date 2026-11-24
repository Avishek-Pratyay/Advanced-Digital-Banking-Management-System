"use client";
import { AccountManager } from "@/components/staff/accounts";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Bank accounts" description="Update account details, freeze or unfreeze accounts and set transaction limits." />
      <AccountManager role="ADMIN" />
    </>
  );
}
