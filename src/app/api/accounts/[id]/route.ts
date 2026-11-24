import { parseBody, route } from "@/server/http";
import { updateAccountSchema } from "@/lib/validators";
import { getAccount, updateAccount } from "@/server/services/accounts";

export const dynamic = "force-dynamic";
export const GET = route("any", ({ user, params }) => getAccount(user, params.id));
export const PATCH = route(["ADMIN"], async ({ req, user, params }) => updateAccount(user, params.id, await parseBody(req, updateAccountSchema)));
