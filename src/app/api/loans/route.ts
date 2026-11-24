import { z } from "zod";
import { parseBody, parseQuery, route } from "@/server/http";
import { LOAN_STATUSES } from "@/lib/constants";
import { loanApplicationSchema } from "@/lib/validators";
import { applyForLoan, listLoans } from "@/server/services/loans";

export const dynamic = "force-dynamic";
const query = z.object({ status: z.enum(LOAN_STATUSES).optional(), q: z.string().trim().optional(), userId: z.string().uuid().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10) });
export const GET = route("any", ({ req, user }) => listLoans(user, parseQuery(req, query)));
export const POST = route(["CUSTOMER"], async ({ req, user }) => applyForLoan(user, await parseBody(req, loanApplicationSchema)));
