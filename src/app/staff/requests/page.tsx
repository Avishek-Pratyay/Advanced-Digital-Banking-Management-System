"use client";
import { RequestsList } from "@/components/shared/requests";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Deposit & withdrawal requests" description="Approve or reject customer requests. Money moves only when you approve." />
      <RequestsList mode="review" initialStatus="PENDING" />
    </>
  );
}
