import { route } from "@/server/http";
import { getLoan } from "@/server/services/loans";

export const dynamic = "force-dynamic";
export const GET = route("any", ({ user, params }) => getLoan(user, params.id));
