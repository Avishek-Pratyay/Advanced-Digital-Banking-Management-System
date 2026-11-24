import { eq } from "drizzle-orm";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import { users } from "./db/schema";
import { verifySecret } from "./security";
import { loginSchema } from "@/lib/validators";
import type { Role } from "@/lib/constants";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login", error: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new Error("Enter a valid email and password");
        const email = parsed.data.email.trim().toLowerCase();
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        // identical message for unknown user / wrong password: do not leak which emails exist
        const invalid = new Error("Invalid email or password");
        if (!user) {
          await verifySecret(parsed.data.password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali"); // constant-ish timing
          throw invalid;
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new Error(`Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
        const ok = await verifySecret(parsed.data.password, user.passwordHash);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await db.update(users).set({ failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null }).where(eq(users.id, user.id));
          throw invalid;
        }
        if (user.status === "BLOCKED") throw new Error("This account has been blocked. Please contact the bank.");
        if (user.status === "INACTIVE") throw new Error("This account is deactivated. Please contact the bank.");
        await db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
        return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};
