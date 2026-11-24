import { z } from "zod";
import { parseBody, route } from "@/server/http";
import { forwardLoan } from "@/server/services/loans";

export const dynamic = "force-dynamic";
export const POST = route(["ADMIN", "STAFF"], async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ note: z.string().trim().max(1000).optional() }));
  return forwardLoan(user, params.id, body.note);
});
