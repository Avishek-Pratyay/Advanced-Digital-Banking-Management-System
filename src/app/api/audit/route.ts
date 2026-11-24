import { z } from "zod";
import { parseQuery, route } from "@/server/http";
import { listAudit } from "@/server/services/me";

export const dynamic = "force-dynamic";
const query = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(15) });
export const GET = route(["ADMIN"], ({ req }) => listAudit(parseQuery(req, query)));
