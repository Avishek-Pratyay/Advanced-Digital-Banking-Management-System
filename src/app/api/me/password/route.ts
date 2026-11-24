import { parseBody, route } from "@/server/http";
import { changePasswordSchema } from "@/lib/validators";
import { changePassword } from "@/server/services/me";

export const dynamic = "force-dynamic";
export const PUT = route("any", async ({ req, user }) => changePassword(user, await parseBody(req, changePasswordSchema)));
