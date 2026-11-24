import { parseBody, route } from "@/server/http";
import { customerActionSchema } from "@/lib/validators";
import { setCustomerStatus, setCustomerVerified } from "@/server/services/customers";

export const dynamic = "force-dynamic";
// verify/unverify: staff + admin.  set_status (activate / deactivate / block): admin only (enforced in the service as well).
export const POST = route(["ADMIN", "STAFF"], async ({ req, user, params }) => {
  const body = await parseBody(req, customerActionSchema);
  if (body.action === "set_status") return setCustomerStatus(user, params.id, body.status, body.reason);
  return setCustomerVerified(user, params.id, body.action === "verify");
});
