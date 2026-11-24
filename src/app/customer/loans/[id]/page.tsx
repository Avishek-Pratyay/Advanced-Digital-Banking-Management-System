"use client";
import { useParams } from "next/navigation";
import { LoanDetailView } from "@/components/shared/loan-detail";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <LoanDetailView id={id} role="CUSTOMER" />;
}
