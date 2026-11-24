"use client";
import { LimitsView } from "@/components/staff/admin-pages";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Limits & rules" description="Configure bank-wide transaction limits and alert thresholds." />
      <LimitsView />
    </>
  );
}
