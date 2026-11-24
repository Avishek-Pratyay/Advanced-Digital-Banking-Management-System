import { parseBody, route } from "@/server/http";
import { reverseSchema } from "@/lib/validators";
import { reverseTransaction } from "@/server/services/transactions";

export const dynamic = "force-dynamic";
export const POST = route(["ADMIN"], async ({ req, user, params }) => reverseTransaction(user, params.id, (await parseBody(req, reverseSchema)).reason));
