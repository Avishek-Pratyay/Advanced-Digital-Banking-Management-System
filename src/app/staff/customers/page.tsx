"use client";
import { CustomerList } from "@/components/staff/customers";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Customers" description="Register customers, verify their information and open accounts." />
      <CustomerList role="STAFF" />
    </>
  );
}
