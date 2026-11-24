import { route } from "@/server/http";
import { getTransaction } from "@/server/services/transactions";

export const dynamic = "force-dynamic";
export const GET = route("any", ({ user, params }) => getTransaction(user, params.id));
