import { parseQuery, route } from "@/server/http";
import { transactionQuerySchema } from "@/lib/validators";
import { listTransactions } from "@/server/services/transactions";

export const dynamic = "force-dynamic";
export const GET = route(["ADMIN", "STAFF"], ({ req, user, params }) => listTransactions(user, { ...parseQuery(req, transactionQuerySchema), userId: params.id }));
