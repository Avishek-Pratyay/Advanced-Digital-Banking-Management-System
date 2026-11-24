import { route } from "@/server/http";
import { customerDashboard } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";
export const GET = route(["CUSTOMER"], ({ req, user }) => customerDashboard(user, req.nextUrl.searchParams.get("accountId") ?? undefined));
