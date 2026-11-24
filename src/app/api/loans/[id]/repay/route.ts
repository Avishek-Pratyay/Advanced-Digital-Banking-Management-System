import { parseBody, route } from "@/server/http";
import { loanRepaySchema } from "@/lib/validators";
import { repayInstallment } from "@/server/services/loans";

export const dynamic = "force-dynamic";
export const POST = route(["CUSTOMER"], async ({ req, user, params }) => repayInstallment(user, params.id, await parseBody(req, loanRepaySchema)));
