import { route } from "@/server/http";
import { adminDashboard } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";
export const GET = route(["ADMIN"], () => adminDashboard());
