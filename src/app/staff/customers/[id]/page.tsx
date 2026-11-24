"use client";
import { useParams } from "next/navigation";
import { CustomerDetailView } from "@/components/staff/customer-detail";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <CustomerDetailView id={id} role="STAFF" />;
}
