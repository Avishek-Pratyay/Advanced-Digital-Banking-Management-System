import { route } from "@/server/http";
import { disburseLoan } from "@/server/services/loans";

export const dynamic = "force-dynamic";
export const POST = route(["ADMIN"], ({ user, params }) => disburseLoan(user, params.id));
