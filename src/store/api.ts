import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { signOut } from "next-auth/react";
import type {
  AccountDetail, AccountList, AdminDashboard, ApiErrorBody, AuditList, CustomerDashboard, CustomerDetail, CustomerList, FlagList, FundRequestList, LoanDetail, LoanList, Me,
  NotificationList, RecipientLookup, SettingsDTO, StaffDashboard, StaffMember, Statement, TransactionList, TxnDetail,
} from "@/types/api";
import type { TxnFilters } from "./slices/transactionSlice";

export type ApiError = { status: number; code: string; message: string; details?: Record<string, string> };

const raw = fetchBaseQuery({ baseUrl: "/api", credentials: "same-origin" });

/** Normalises every failure into { status, code, message, details } and signs the user out when the session dies. */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (args, api, extra) => {
  const result = await raw(args, api, extra);
  if (!result.error) return { data: result.data };
  const e = result.error as FetchBaseQueryError;
  const status = typeof e.status === "number" ? e.status : 0;
  const body = (e as { data?: Partial<ApiErrorBody> }).data;
  if (status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) void signOut({ callbackUrl: "/login?expired=1" });
  return {
    error: {
      status,
      code: body?.error?.code ?? (status === 0 ? "NETWORK_ERROR" : "ERROR"),
      message: body?.error?.message ?? (status === 0 ? "Cannot reach the server. Check your connection." : "Something went wrong. Please try again."),
      details: body?.error?.details as Record<string, string> | undefined,
    },
  };
};

const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
const body = (method: string, b: unknown) => ({ method, body: b as Record<string, unknown> });

type Page = { page?: number; pageSize?: number };

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  keepUnusedDataFor: 60,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ["Me", "Dashboard", "Accounts", "Transactions", "Requests", "Loans", "Customers", "Notifications", "Settings", "Flags", "Staff", "Audit"],
  endpoints: (b) => ({
    /* ---- profile / security ---- */
    getMe: b.query<Me, void>({ query: () => "/me", providesTags: ["Me"] }),
    changePin: b.mutation<{ ok: true }, { currentPin: string; newPin: string }>({ query: (x) => ({ url: "/me/pin", ...body("PUT", x) }), invalidatesTags: ["Me"] }),
    changePassword: b.mutation<{ ok: true }, { currentPassword: string; newPassword: string; confirmPassword: string }>({ query: (x) => ({ url: "/me/password", ...body("PUT", x) }) }),
    twoFactor: b.mutation<{ secret?: string; uri?: string; qr?: string; enabled?: boolean }, { action: "setup" | "enable" | "disable"; code?: string; password?: string }>({
      query: (x) => ({ url: "/me/2fa", ...body("POST", x) }),
      invalidatesTags: (_r, _e, a) => (a.action === "setup" ? [] : ["Me"]),
    }),

    /* ---- dashboards ---- */
    adminDashboard: b.query<AdminDashboard, void>({ query: () => "/dashboard/admin", providesTags: ["Dashboard"] }),
    staffDashboard: b.query<StaffDashboard, void>({ query: () => "/dashboard/staff", providesTags: ["Dashboard"] }),
    customerDashboard: b.query<CustomerDashboard, string | undefined>({ query: (id) => `/dashboard/customer${qs({ accountId: id })}`, providesTags: ["Dashboard"] }),

    /* ---- customers ---- */
    listCustomers: b.query<CustomerList, { q?: string; status?: string; verified?: string } & Page>({ query: (a) => `/customers${qs(a)}`, providesTags: ["Customers"] }),
    getCustomer: b.query<CustomerDetail, string>({ query: (id) => `/customers/${id}`, providesTags: (_r, _e, id) => [{ type: "Customers", id }] }),
    createCustomer: b.mutation<{ customer: { id: string }; account: { accountNumber: string } | null; temporaryCredentials: { email: string; password?: string; pin?: string } }, Record<string, unknown>>({
      query: (x) => ({ url: "/customers", ...body("POST", x) }),
      invalidatesTags: ["Customers", "Accounts", "Dashboard"],
    }),
    updateCustomer: b.mutation<CustomerDetail, { id: string; name?: string; phone?: string; address?: string }>({
      query: ({ id, ...x }) => ({ url: `/customers/${id}`, ...body("PATCH", x) }),
      invalidatesTags: ["Customers"],
    }),
    customerAction: b.mutation<CustomerDetail, { id: string } & ({ action: "set_status"; status: string; reason?: string } | { action: "verify" | "unverify" })>({
      query: ({ id, ...x }) => ({ url: `/customers/${id}/actions`, ...body("POST", x) }),
      invalidatesTags: ["Customers", "Dashboard"],
    }),

    /* ---- staff admin ---- */
    listStaff: b.query<StaffMember[], void>({ query: () => "/staff", providesTags: ["Staff"] }),
    createStaff: b.mutation<unknown, { name: string; email: string; password: string }>({ query: (x) => ({ url: "/staff", ...body("POST", x) }), invalidatesTags: ["Staff"] }),
    setStaffStatus: b.mutation<unknown, { id: string; status: string }>({ query: ({ id, status }) => ({ url: `/staff/${id}`, ...body("PATCH", { status }) }), invalidatesTags: ["Staff"] }),

    /* ---- accounts ---- */
    listAccounts: b.query<AccountList, { q?: string; status?: string; type?: string; userId?: string } & Page>({ query: (a) => `/accounts${qs(a)}`, providesTags: ["Accounts"] }),
    getAccount: b.query<AccountDetail, string>({ query: (id) => `/accounts/${id}`, providesTags: (_r, _e, id) => [{ type: "Accounts", id }] }),
    createAccount: b.mutation<AccountDetail, { userId: string; type: string; nickname?: string; openingDeposit?: number }>({
      query: (x) => ({ url: "/accounts", ...body("POST", x) }),
      invalidatesTags: ["Accounts", "Customers", "Dashboard", "Transactions"],
    }),
    updateAccount: b.mutation<AccountDetail, { id: string } & Record<string, unknown>>({
      query: ({ id, ...x }) => ({ url: `/accounts/${id}`, ...body("PATCH", x) }),
      invalidatesTags: ["Accounts", "Customers", "Dashboard"],
    }),
    lookupAccount: b.query<RecipientLookup, string>({ query: (n) => `/accounts/lookup?number=${encodeURIComponent(n)}` }),
    getStatement: b.query<Statement, { id: string; from?: string; to?: string }>({ query: ({ id, ...r }) => `/accounts/${id}/statement${qs(r)}`, providesTags: ["Transactions"] }),

    /* ---- transactions ---- */
    listTransactions: b.query<TransactionList, Partial<TxnFilters> & { userId?: string }>({ query: (a) => `/transactions${qs(a)}`, providesTags: ["Transactions"] }),
    getTransaction: b.query<TxnDetail, string>({ query: (id) => `/transactions/${id}`, providesTags: (_r, _e, id) => [{ type: "Transactions", id }, "Transactions"] }),
    transfer: b.mutation<{ transaction: TxnDetail; duplicate: boolean }, Record<string, unknown>>({
      query: (x) => ({ url: "/transactions/transfer", ...body("POST", x) }),
      invalidatesTags: ["Accounts", "Transactions", "Dashboard", "Notifications"],
    }),
    flagTransaction: b.mutation<{ ok: true }, { id: string; reason: string }>({ query: ({ id, reason }) => ({ url: `/transactions/${id}/flag`, ...body("POST", { reason }) }), invalidatesTags: ["Transactions", "Flags", "Dashboard"] }),
    reverseTransaction: b.mutation<TxnDetail, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/transactions/${id}/reverse`, ...body("POST", { reason }) }),
      invalidatesTags: ["Transactions", "Accounts", "Dashboard", "Notifications", "Customers"],
    }),

    /* ---- deposit / withdrawal requests ---- */
    listRequests: b.query<FundRequestList, { status?: string; type?: string; q?: string } & Page>({ query: (a) => `/fund-requests${qs(a)}`, providesTags: ["Requests"] }),
    createRequest: b.mutation<{ id: string; requestNumber: string }, Record<string, unknown>>({ query: (x) => ({ url: "/fund-requests", ...body("POST", x) }), invalidatesTags: ["Requests", "Transactions", "Dashboard"] }),
    reviewRequest: b.mutation<{ ok: true }, { id: string; action: "approve" | "reject"; note?: string }>({
      query: ({ id, ...x }) => ({ url: `/fund-requests/${id}`, ...body("PATCH", x) }),
      invalidatesTags: ["Requests", "Transactions", "Accounts", "Dashboard", "Flags", "Customers"],
    }),

    /* ---- flags ---- */
    listFlags: b.query<FlagList, { status?: string } & Page>({ query: (a) => `/flags${qs(a)}`, providesTags: ["Flags"] }),
    resolveFlag: b.mutation<{ ok: true }, { id: string; action: "dismiss" | "confirm"; note?: string; freezeAccount?: boolean }>({
      query: ({ id, ...x }) => ({ url: `/flags/${id}`, ...body("PATCH", x) }),
      invalidatesTags: ["Flags", "Transactions", "Accounts", "Dashboard"],
    }),

    /* ---- loans ---- */
    listLoans: b.query<LoanList, { status?: string; q?: string; userId?: string } & Page>({ query: (a) => `/loans${qs(a)}`, providesTags: ["Loans"] }),
    getLoan: b.query<LoanDetail, string>({ query: (id) => `/loans/${id}`, providesTags: (_r, _e, id) => [{ type: "Loans", id }] }),
    applyLoan: b.mutation<{ id: string; loanNumber: string }, Record<string, unknown>>({ query: (x) => ({ url: "/loans", ...body("POST", x) }), invalidatesTags: ["Loans", "Dashboard"] }),
    addLoanNote: b.mutation<{ ok: true }, { id: string; body: string }>({ query: ({ id, body: t }) => ({ url: `/loans/${id}/notes`, ...body("POST", { body: t }) }), invalidatesTags: (_r, _e, a) => [{ type: "Loans", id: a.id }] }),
    forwardLoan: b.mutation<LoanDetail, { id: string; note?: string }>({ query: ({ id, note }) => ({ url: `/loans/${id}/forward`, ...body("POST", { note }) }), invalidatesTags: ["Loans", "Dashboard"] }),
    decideLoan: b.mutation<LoanDetail, { id: string; action: "approve" | "reject"; note?: string; approvedAmount?: number; interestRate?: number; disburse?: boolean }>({
      query: ({ id, ...x }) => ({ url: `/loans/${id}/decision`, ...body("POST", x) }),
      invalidatesTags: ["Loans", "Dashboard", "Accounts", "Transactions"],
    }),
    disburseLoan: b.mutation<LoanDetail, string>({ query: (id) => ({ url: `/loans/${id}/disburse`, method: "POST" }), invalidatesTags: ["Loans", "Dashboard", "Accounts", "Transactions"] }),
    repayLoan: b.mutation<LoanDetail, { id: string; accountId: string; pin: string; totp?: string }>({
      query: ({ id, ...x }) => ({ url: `/loans/${id}/repay`, ...body("POST", x) }),
      invalidatesTags: ["Loans", "Dashboard", "Accounts", "Transactions", "Notifications"],
    }),

    /* ---- notifications / settings / audit ---- */
    listNotifications: b.query<NotificationList, { unread?: boolean } & Page>({ query: (a) => `/notifications${qs(a)}`, providesTags: ["Notifications"] }),
    markNotifications: b.mutation<{ ok: true }, { ids?: string[]; all?: boolean }>({ query: (x) => ({ url: "/notifications", ...body("PATCH", x) }), invalidatesTags: ["Notifications"] }),
    getSettings: b.query<SettingsDTO, void>({ query: () => "/settings", providesTags: ["Settings"] }),
    updateSettings: b.mutation<SettingsDTO, Record<string, unknown>>({ query: (x) => ({ url: "/settings", ...body("PUT", x) }), invalidatesTags: ["Settings", "Accounts"] }),
    listAudit: b.query<AuditList, Page>({ query: (a) => `/audit${qs(a)}`, providesTags: ["Audit"] }),
  }),
});

export const {
  useGetMeQuery, useChangePinMutation, useChangePasswordMutation, useTwoFactorMutation,
  useAdminDashboardQuery, useStaffDashboardQuery, useCustomerDashboardQuery,
  useListCustomersQuery, useGetCustomerQuery, useCreateCustomerMutation, useUpdateCustomerMutation, useCustomerActionMutation,
  useListStaffQuery, useCreateStaffMutation, useSetStaffStatusMutation,
  useListAccountsQuery, useGetAccountQuery, useCreateAccountMutation, useUpdateAccountMutation, useLazyLookupAccountQuery, useLookupAccountQuery, useGetStatementQuery, useLazyGetStatementQuery,
  useListTransactionsQuery, useGetTransactionQuery, useTransferMutation, useFlagTransactionMutation, useReverseTransactionMutation,
  useListRequestsQuery, useCreateRequestMutation, useReviewRequestMutation,
  useListFlagsQuery, useResolveFlagMutation,
  useListLoansQuery, useGetLoanQuery, useApplyLoanMutation, useAddLoanNoteMutation, useForwardLoanMutation, useDecideLoanMutation, useDisburseLoanMutation, useRepayLoanMutation,
  useListNotificationsQuery, useMarkNotificationsMutation, useGetSettingsQuery, useUpdateSettingsMutation, useListAuditQuery,
} = api;
