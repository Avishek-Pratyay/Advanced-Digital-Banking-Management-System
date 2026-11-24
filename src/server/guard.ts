import { redirect } from "next/navigation";
import { HOME_BY_ROLE, type Role } from "@/lib/constants";
import { AppError } from "./errors";
import { requireUser, type SessionUser } from "./http";

/** Server-component guard used by the role layouts: re-validates the session AND role against the database. */
export async function guardRole(roles: Role[]): Promise<SessionUser> {
  try {
    return await requireUser(roles);
  } catch (e) {
    if (e instanceof AppError && e.status === 403) {
      // signed in but wrong role -> send to their own area (or login if the account was disabled)
      try {
        const u = await requireUser();
        redirect(HOME_BY_ROLE[u.role]);
      } catch (inner) {
        if (isRedirect(inner)) throw inner;
      }
    }
    if (isRedirect(e)) throw e;
    redirect("/login");
  }
}
const isRedirect = (e: unknown) => typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
