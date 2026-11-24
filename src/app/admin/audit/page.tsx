"use client";
import { AuditView } from "@/components/staff/admin-pages";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Audit log" description="Every sensitive action, recorded with who did it and when." />
      <AuditView />
    </>
  );
}
