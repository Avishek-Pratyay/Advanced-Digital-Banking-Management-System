import { route } from "@/server/http";
import { getMe } from "@/server/services/me";

export const dynamic = "force-dynamic";
export const GET = route("any", ({ user }) => getMe(user));
