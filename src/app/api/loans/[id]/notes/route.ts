import { parseBody, route } from "@/server/http";
import { loanNoteSchema } from "@/lib/validators";
import { addLoanNote } from "@/server/services/loans";

export const dynamic = "force-dynamic";
export const POST = route(["ADMIN", "STAFF"], async ({ req, user, params }) => addLoanNote(user, params.id, (await parseBody(req, loanNoteSchema)).body));
