"use client";
import { CustomerList } from "@/components/staff/customers";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Customers" description="Search, review and manage every registered customer." />
      <CustomerList role="ADMIN" />
    </>
  );
}
