/** zod schemas shared by API route handlers (server) and react-hook-form (client). */
import { z } from "zod";
import {
  ACCOUNT_STATUSES, ACCOUNT_TYPES, EMPLOYMENT_STATUSES, LOAN_PRODUCTS, LOAN_TYPES, REQUEST_STATUSES, TXN_STATUSES, TXN_TYPES, USER_STATUSES,
} from "./constants";

const money = (max = 10_000_000) =>
  z.coerce
    .number({ invalid_type_error: "Enter a valid amount" })
    .positive("Amount must be greater than zero")
    .max(max, "Amount is too large")
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "At most 2 decimal places");

const optionalMoney = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().min(0).max(100_000_000).nullable());
const pin = z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits");
const password = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/\d/, "Include a number");
const totp = z.string().regex(/^\d{6}$/, "Enter the 6-digit code").optional().or(z.literal("").transform(() => undefined));
const uuid = z.string().uuid("Invalid id");

export const loginSchema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Password is required") });

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().min(6, "Phone is required").max(20),
  address: z.string().trim().min(5, "Address is required").max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  nationalId: z.string().trim().min(4, "ID number is required").max(30),
  password: password.optional().or(z.literal("").transform(() => undefined)),
  pin: pin.optional().or(z.literal("").transform(() => undefined)),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  openingDeposit: z.preprocess((v) => (v === "" || v === undefined ? 0 : v), z.coerce.number().min(0).max(1_000_000)).optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  address: z.string().trim().min(5).max(200).optional(),
});

export const customerActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_status"), status: z.enum(USER_STATUSES), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("verify") }),
  z.object({ action: z.literal("unverify") }),
]);

export const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password,
});

export const createAccountSchema = z.object({
  userId: uuid,
  type: z.enum(ACCOUNT_TYPES),
  nickname: z.string().trim().max(40).optional().or(z.literal("").transform(() => undefined)),
  openingDeposit: z.preprocess((v) => (v === "" || v === undefined ? 0 : v), z.coerce.number().min(0).max(1_000_000)).optional(),
});

export const updateAccountSchema = z.object({
  type: z.enum(ACCOUNT_TYPES).optional(),
  nickname: z.string().trim().max(40).nullable().optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  dailyTransferLimit: optionalMoney.optional(),
  maxTransactionAmount: optionalMoney.optional(),
  minBalance: optionalMoney.optional(),
});

export const transferSchema = z.object({
  fromAccountId: uuid,
  toAccountNumber: z.string().trim().regex(/^\d{10,16}$/, "Enter a valid account number (digits only)"),
  amount: money(),
  description: z.string().trim().max(140, "Max 140 characters").optional().default(""),
  pin,
  idempotencyKey: z.string().min(8).max(100),
  totp,
});

export const fundRequestSchema = z.object({
  accountId: uuid,
  type: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  amount: money(1_000_000),
  description: z.string().trim().max(200).optional().default(""),
  idempotencyKey: z.string().min(8).max(100).optional(),
  totp,
});

export const reviewRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300).optional(),
});

export const flagTransactionSchema = z.object({ reason: z.string().trim().min(5, "Describe why this looks suspicious").max(300) });
export const resolveFlagSchema = z.object({
  action: z.enum(["dismiss", "confirm"]),
  note: z.string().trim().max(300).optional(),
  freezeAccount: z.boolean().optional(),
});
export const reverseSchema = z.object({ reason: z.string().trim().min(5, "Reason is required").max(300) });

export const loanApplicationSchema = z
  .object({
    accountId: uuid,
    type: z.enum(LOAN_TYPES),
    requestedAmount: money(1_000_000),
    durationMonths: z.coerce.number().int("Whole months only").min(3, "Minimum 3 months").max(360),
    monthlyIncome: money(10_000_000),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES),
    description: z.string().trim().min(10, "Tell us a little about the purpose (min 10 characters)").max(500),
  })
  .superRefine((v, ctx) => {
    const p = LOAN_PRODUCTS[v.type];
    if (v.durationMonths > p.maxMonths) ctx.addIssue({ code: "custom", path: ["durationMonths"], message: `Maximum ${p.maxMonths} months for this loan type` });
    if (v.requestedAmount < p.minAmount || v.requestedAmount > p.maxAmount)
      ctx.addIssue({ code: "custom", path: ["requestedAmount"], message: `Amount must be between ${p.minAmount} and ${p.maxAmount} for this loan type` });
  });

export const loanNoteSchema = z.object({ body: z.string().trim().min(3, "Write a note").max(1000) });
export const loanDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
  approvedAmount: z.coerce.number().positive().max(1_000_000).optional(),
  interestRate: z.coerce.number().min(1).max(40).optional(), // percent p.a.
  disburse: z.boolean().optional().default(true),
});
export const loanRepaySchema = z.object({ accountId: uuid, pin, totp, idempotencyKey: z.string().min(8).max(100).optional() });

export const settingsSchema = z.object({
  dailyTransferLimit: z.coerce.number().positive().max(100_000_000),
  maxTransactionAmount: z.coerce.number().positive().max(100_000_000),
  minAccountBalance: z.coerce.number().min(0).max(1_000_000),
  transferFee: z.coerce.number().min(0).max(1_000),
  largeTransactionThreshold: z.coerce.number().positive().max(100_000_000),
});

export const changePinSchema = z.object({ currentPin: pin, newPin: pin });
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export const twoFactorSchema = z.object({ action: z.enum(["setup", "enable", "disable"]), code: z.string().regex(/^\d{6}$/).optional(), password: z.string().optional() });

export const transactionQuerySchema = z.object({
  q: z.string().trim().optional(),
  type: z.enum(TXN_TYPES).optional(),
  status: z.enum(TXN_STATUSES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  accountId: uuid.optional(),
  userId: uuid.optional(),
  flagged: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const requestQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  type: z.enum(["DEPOSIT", "WITHDRAWAL"]).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type FundRequestInput = z.infer<typeof fundRequestSchema>;
export type LoanApplicationInput = z.infer<typeof loanApplicationSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
