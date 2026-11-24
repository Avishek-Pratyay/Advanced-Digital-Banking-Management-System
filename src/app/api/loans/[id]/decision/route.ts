import { parseBody, route } from "@/server/http";
import { loanDecisionSchema } from "@/lib/validators";
import { decideLoan } from "@/server/services/loans";

export const dynamic = "force-dynamic";
export const POST = route(["ADMIN"], async ({ req, user, params }) => decideLoan(user, params.id, await parseBody(req, loanDecisionSchema)));
