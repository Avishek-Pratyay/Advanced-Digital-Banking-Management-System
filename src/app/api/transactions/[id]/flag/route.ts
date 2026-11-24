import { parseBody, route } from "@/server/http";
import { flagTransactionSchema } from "@/lib/validators";
import { flagTransaction } from "@/server/services/transactions";

export const dynamic = "force-dynamic";
export const POST = route(["ADMIN", "STAFF"], async ({ req, user, params }) => flagTransaction(user, params.id, (await parseBody(req, flagTransactionSchema)).reason));
