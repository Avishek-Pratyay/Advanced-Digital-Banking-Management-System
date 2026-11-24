"use client";
import { FlagsView } from "@/components/staff/admin-pages";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Flagged activity" description="Review transactions flagged by staff or by the rule-based detector." />
      <FlagsView />
    </>
  );
}
