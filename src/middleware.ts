import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { HOME_BY_ROLE, type Role } from "@/lib/constants";

/** First line of route protection (cheap JWT check at the edge). Role + status are re-verified on the server in each layout and in every API route. */
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as Role | undefined;
    const path = req.nextUrl.pathname;
    const area = path.split("/")[1] as "admin" | "staff" | "customer";
    const allowed: Record<string, Role> = { admin: "ADMIN", staff: "STAFF", customer: "CUSTOMER" };
    if (role && allowed[area] && allowed[area] !== role) return NextResponse.redirect(new URL(HOME_BY_ROLE[role], req.url));
    return NextResponse.next();
  },
  { callbacks: { authorized: ({ token }) => !!token }, pages: { signIn: "/login" } },
);

export const config = { matcher: ["/admin/:path*", "/staff/:path*", "/customer/:path*"] };
