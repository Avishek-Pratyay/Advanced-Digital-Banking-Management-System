import { parseBody, route } from "@/server/http";
import { createStaffSchema } from "@/lib/validators";
import { createStaff, listStaff } from "@/server/services/customers";

export const dynamic = "force-dynamic";
export const GET = route(["ADMIN"], () => listStaff());
export const POST = route(["ADMIN"], async ({ req, user }) => createStaff(user, await parseBody(req, createStaffSchema)));
