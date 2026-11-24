import { z } from "zod";
import { parseBody, parseQuery, route } from "@/server/http";
import { listNotifications, markNotifications } from "@/server/services/me";

export const dynamic = "force-dynamic";
const query = z.object({ unread: z.enum(["true", "false"]).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(15) });
const markSchema = z.object({ ids: z.array(z.string().uuid()).max(100).optional(), all: z.boolean().optional() });

export const GET = route("any", ({ req, user }) => {
  const q = parseQuery(req, query);
  return listNotifications(user, { unread: q.unread === "true", page: q.page, pageSize: q.pageSize });
});
export const PATCH = route("any", async ({ req, user }) => markNotifications(user, await parseBody(req, markSchema)));
