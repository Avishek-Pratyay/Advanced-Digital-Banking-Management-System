import { z } from "zod";
import { parseQuery, route } from "@/server/http";
import { listFlags } from "@/server/services/transactions";

export const dynamic = "force-dynamic";
const query = z.object({ status: z.enum(["OPEN", "DISMISSED", "CONFIRMED"]).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10) });
export const GET = route(["ADMIN"], ({ req }) => listFlags(parseQuery(req, query)));
