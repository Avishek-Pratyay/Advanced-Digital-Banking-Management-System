import { parseBody, route } from "@/server/http";
import { changePinSchema } from "@/lib/validators";
import { changePin } from "@/server/services/me";

export const dynamic = "force-dynamic";
export const PUT = route(["CUSTOMER"], async ({ req, user }) => changePin(user, await parseBody(req, changePinSchema)));
