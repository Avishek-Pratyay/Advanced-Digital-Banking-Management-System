import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import type { Role } from "@/lib/constants";
import { authOptions } from "./auth";
import { db } from "./db";
import { users } from "./db/schema";
import { AppError, badRequest, forbidden, unauthorized } from "./errors";

export type SessionUser = { id: string; name: string; email: string; role: Role };
export type RouteCtx = { req: NextRequest; user: SessionUser; params: Record<string, string> };

/**
 * Server-side authentication + authorisation.
 * The JWT only proves who the caller is; role and status are ALWAYS re-read from the database,
 * so blocking/deactivating a user or changing a role takes effect on the very next request.
 */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw unauthorized();
  const [u] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!u) throw unauthorized("Your session is no longer valid");
  if (u.status !== "ACTIVE") throw forbidden("Your account is not active");
  if (roles && !roles.includes(u.role)) throw forbidden();
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

type Handler = (ctx: RouteCtx) => Promise<unknown>;

/** Wrap a route handler with auth, role check and uniform error responses. */
export function route(roles: Role[] | "any", handler: Handler) {
  return async (req: NextRequest, segment: { params?: Record<string, string> } = {}) => {
    try {
      const user = await requireUser(roles === "any" ? undefined : roles);
      const result = await handler({ req, user, params: segment.params ?? {} });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(json);
}

export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.output<S> {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (v !== "") obj[k] = v;
  });
  return schema.parse(obj);
}

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of e.issues) fieldErrors[issue.path.join(".") || "_"] ??= issue.message;
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: Object.values(fieldErrors)[0] ?? "Invalid input", details: fieldErrors } }, { status: 400 });
  }
  if (e instanceof AppError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  }
  const pg = findPgError(e);
  if (pg?.code === "23505") return NextResponse.json({ error: { code: "DUPLICATE", message: "This record already exists" } }, { status: 409 });
  if (pg?.code === "23514") return NextResponse.json({ error: { code: "CONSTRAINT_VIOLATION", message: "The operation would violate a banking rule (for example a negative balance)" } }, { status: 422 });
  console.error("[api] unhandled error", e);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }, { status: 500 });
}

function findPgError(e: unknown): { code?: string } | null {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    const c = (cur as { code?: unknown }).code;
    if (typeof c === "string" && /^[0-9A-Z]{5}$/.test(c)) return { code: c };
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}
