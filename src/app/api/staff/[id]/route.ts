import { z } from "zod";
import { parseBody, route } from "@/server/http";
import { USER_STATUSES } from "@/lib/constants";
import { setStaffStatus } from "@/server/services/customers";

export const dynamic = "force-dynamic";
export const PATCH = route(["ADMIN"], async ({ req, user, params }) => setStaffStatus(user, params.id, (await parseBody(req, z.object({ status: z.enum(USER_STATUSES) }))).status));
