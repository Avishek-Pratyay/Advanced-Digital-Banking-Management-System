import { parseBody, route } from "@/server/http";
import { resolveFlagSchema } from "@/lib/validators";
import { resolveFlag } from "@/server/services/transactions";

export const dynamic = "force-dynamic";
export const PATCH = route(["ADMIN"], async ({ req, user, params }) => resolveFlag(user, params.id, await parseBody(req, resolveFlagSchema)));
