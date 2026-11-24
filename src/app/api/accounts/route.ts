import { z } from "zod";
import { parseBody, parseQuery, route } from "@/server/http";
import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from "@/lib/constants";
import { createAccountSchema } from "@/lib/validators";
import { createAccount, listAccounts } from "@/server/services/accounts";

export const dynamic = "force-dynamic";
const query = z.object({ q: z.string().trim().optional(), status: z.enum(ACCOUNT_STATUSES).optional(), type: z.enum(ACCOUNT_TYPES).optional(), userId: z.string().uuid().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10) });

export const GET = route("any", ({ req, user }) => listAccounts(user, parseQuery(req, query)));
export const POST = route(["ADMIN", "STAFF"], async ({ req, user }) => createAccount(user, await parseBody(req, createAccountSchema)));
