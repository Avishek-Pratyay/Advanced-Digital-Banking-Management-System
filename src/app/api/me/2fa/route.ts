import { parseBody, route } from "@/server/http";
import { twoFactorSchema } from "@/lib/validators";
import { twoFactor } from "@/server/services/me";

export const dynamic = "force-dynamic";
export const POST = route("any", async ({ req, user }) => twoFactor(user, await parseBody(req, twoFactorSchema)));
