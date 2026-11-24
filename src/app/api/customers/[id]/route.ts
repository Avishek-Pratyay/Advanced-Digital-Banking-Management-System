import { parseBody, route } from "@/server/http";
import { updateCustomerSchema } from "@/lib/validators";
import { getCustomer, updateCustomerInfo } from "@/server/services/customers";

export const dynamic = "force-dynamic";
export const GET = route(["ADMIN", "STAFF"], ({ params }) => getCustomer(params.id));
export const PATCH = route(["ADMIN", "STAFF"], async ({ req, user, params }) => updateCustomerInfo(user, params.id, await parseBody(req, updateCustomerSchema)));
