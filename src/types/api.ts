/** Response types are derived (type-only) from the server services, so client and server can never drift apart. */
import type { adminDashboard, customerDashboard, staffDashboard } from "@/server/services/dashboard";
import type { getAccount, getStatement, listAccounts, lookupAccount } from "@/server/services/accounts";
import type { getCustomer, listCustomers, listStaff } from "@/server/services/customers";
import type { listFundRequests } from "@/server/services/fund-requests";
import type { getLoan, listLoans } from "@/server/services/loans";
import type { getMe, listAudit, listNotifications, readSettings } from "@/server/services/me";
import type { getTransaction, listFlags, listTransactions } from "@/server/services/transactions";

type A<T extends (...a: never[]) => Promise<unknown>> = Awaited<ReturnType<T>>;

export type Me = A<typeof getMe>;
export type AdminDashboard = A<typeof adminDashboard>;
export type StaffDashboard = A<typeof staffDashboard>;
export type CustomerDashboard = A<typeof customerDashboard>;
export type CustomerList = A<typeof listCustomers>;
export type CustomerListItem = CustomerList["items"][number];
export type CustomerDetail = A<typeof getCustomer>;
export type StaffMember = A<typeof listStaff>[number];
export type AccountList = A<typeof listAccounts>;
export type AccountDTO = AccountList["items"][number];
export type AccountDetail = A<typeof getAccount>;
export type Statement = A<typeof getStatement>;
export type RecipientLookup = A<typeof lookupAccount>;
export type TransactionList = A<typeof listTransactions>;
export type TxnItem = TransactionList["items"][number];
export type TxnDetail = A<typeof getTransaction>;
export type FlagList = A<typeof listFlags>;
export type FundRequestList = A<typeof listFundRequests>;
export type FundRequestItem = FundRequestList["items"][number];
export type LoanList = A<typeof listLoans>;
export type LoanItem = LoanList["items"][number];
export type LoanDetail = A<typeof getLoan>;
export type NotificationList = A<typeof listNotifications>;
export type SettingsDTO = A<typeof readSettings>;
export type AuditList = A<typeof listAudit>;

export type ApiErrorBody = { error: { code: string; message: string; details?: Record<string, string> } };
