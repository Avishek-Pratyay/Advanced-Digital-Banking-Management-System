import { route } from "@/server/http";
import { badRequest } from "@/server/errors";
import { lookupAccount } from "@/server/services/accounts";

export const dynamic = "force-dynamic";
export const GET = route(["CUSTOMER"], ({ req, user }) => {
  const number = req.nextUrl.searchParams.get("number") ?? "";
  if (!/^\d{10,16}$/.test(number)) throw badRequest("Enter a valid account number (digits only)");
  return lookupAccount(user, number);
});
