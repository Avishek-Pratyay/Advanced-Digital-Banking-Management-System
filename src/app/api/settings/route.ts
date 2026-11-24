import { parseBody, route } from "@/server/http";
import { settingsSchema } from "@/lib/validators";
import { readSettings, updateSettings } from "@/server/services/me";

export const dynamic = "force-dynamic";
export const GET = route("any", () => readSettings());
export const PUT = route(["ADMIN"], async ({ req, user }) => updateSettings(user, await parseBody(req, settingsSchema)));
