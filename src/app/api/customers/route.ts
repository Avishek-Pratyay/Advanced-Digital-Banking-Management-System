import { z } from "zod";
import { parseBody, parseQuery, route } from "@/server/http";
import { USER_STATUSES } from "@/lib/constants";
import { createCustomerSchema } from "@/lib/validators";
import { createCustomer, listCustomers } from "@/server/services/customers";

export const dynamic = "force-dynamic";
const query = z.object({ q: z.string().trim().optional(), status: z.enum(USER_STATUSES).optional(), verified: z.enum(["true", "false"]).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10) });

export const GET = route(["ADMIN", "STAFF"], ({ req }) => listCustomers(parseQuery(req, query)));
export const POST = route(["ADMIN", "STAFF"], async ({ req, user }) => createCustomer(user, await parseBody(req, createCustomerSchema)));
