import { parseBody, route } from "@/server/http";
import { reviewRequestSchema } from "@/lib/validators";
import { reviewFundRequest } from "@/server/services/fund-requests";

export const dynamic = "force-dynamic";
export const PATCH = route(["ADMIN", "STAFF"], async ({ req, user, params }) => reviewFundRequest(user, params.id, await parseBody(req, reviewRequestSchema)));
