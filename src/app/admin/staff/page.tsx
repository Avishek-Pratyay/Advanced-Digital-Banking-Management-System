"use client";
import { StaffAdminView } from "@/components/staff/admin-pages";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Bank staff" description="Manage employee access." />
      <StaffAdminView />
    </>
  );
}
