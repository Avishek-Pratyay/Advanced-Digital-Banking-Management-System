import { AppShell } from "@/components/shell";
import { guardRole } from "@/server/guard";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guardRole(["ADMIN"]);
  return <AppShell role="ADMIN">{children}</AppShell>;
}
