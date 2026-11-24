import { parseBody, route } from "@/server/http";
import { transferSchema } from "@/lib/validators";
import { transferFunds } from "@/server/services/transactions";

export const dynamic = "force-dynamic";
export const POST = route(["CUSTOMER"], async ({ req, user }) => transferFunds(user, await parseBody(req, transferSchema)));
