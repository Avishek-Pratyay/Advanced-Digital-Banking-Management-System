import type { Role } from "@/lib/constants";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User { id: string; role: Role }
  interface Session { user: { id: string; role: Role; name?: string | null; email?: string | null } }
}
declare module "next-auth/jwt" {
  interface JWT { uid?: string; role?: Role }
}
