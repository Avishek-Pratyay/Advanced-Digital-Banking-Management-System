import { parseBody, parseQuery, route } from "@/server/http";
import { fundRequestSchema, requestQuerySchema } from "@/lib/validators";
import { createFundRequest, listFundRequests } from "@/server/services/fund-requests";

export const dynamic = "force-dynamic";
export const GET = route("any", ({ req, user }) => listFundRequests(user, parseQuery(req, requestQuerySchema)));
export const POST = route(["CUSTOMER"], async ({ req, user }) => createFundRequest(user, await parseBody(req, fundRequestSchema)));
