/**
 * Vaultline database schema (PostgreSQL, Drizzle ORM).
 *
 * MONEY RULE: every monetary column is a BIGINT holding integer CENTS (minor units).
 * Integer math avoids floating point drift; conversion to/from decimal amounts only
 * happens at the API boundary (see src/lib/money.ts).
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */
export const roleEnum = pgEnum("role", ["ADMIN", "STAFF", "CUSTOMER"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INACTIVE", "BLOCKED"]);
export const accountTypeEnum = pgEnum("account_type", ["SAVINGS", "CURRENT", "BUSINESS"]);
export const accountStatusEnum = pgEnum("account_status", ["ACTIVE", "FROZEN", "CLOSED"]);
export const txnTypeEnum = pgEnum("txn_type", ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "LOAN_DISBURSEMENT", "LOAN_REPAYMENT"]);
export const txnStatusEnum = pgEnum("txn_status", ["PENDING", "COMPLETED", "FAILED", "REVERSED"]);
export const ledgerDirectionEnum = pgEnum("ledger_direction", ["DEBIT", "CREDIT"]);
export const requestStatusEnum = pgEnum("request_status", ["PENDING", "APPROVED", "REJECTED"]);
export const flagSourceEnum = pgEnum("flag_source", ["STAFF", "SYSTEM"]);
export const flagStatusEnum = pgEnum("flag_status", ["OPEN", "DISMISSED", "CONFIRMED"]);
export const loanTypeEnum = pgEnum("loan_type", ["PERSONAL", "HOME", "AUTO", "EDUCATION", "BUSINESS"]);
export const employmentEnum = pgEnum("employment_status", ["EMPLOYED", "SELF_EMPLOYED", "BUSINESS_OWNER", "STUDENT", "RETIRED", "UNEMPLOYED"]);
export const loanStatusEnum = pgEnum("loan_status", ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "ACTIVE", "COMPLETED"]);
export const installmentStatusEnum = pgEnum("installment_status", ["PENDING", "PAID"]);

/* ------------------------------------------------------------------ users */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerNumber: text("customer_number").unique(), // CUS-000001 (customers only)
    name: text("name").notNull(),
    email: text("email").notNull().unique(), // always stored lower-case
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("CUSTOMER"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    statusReason: text("status_reason"),
    phone: text("phone"),
    address: text("address"),
    dateOfBirth: date("date_of_birth"),
    nationalId: text("national_id"), // simulated ID number only - never a real one
    verified: boolean("verified").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedById: uuid("verified_by_id"),
    // transaction PIN (bcrypt) + brute force protection
    pinHash: text("pin_hash"),
    pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),
    pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
    // login brute force protection
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    // two-factor authentication (TOTP)
    twoFactorSecret: text("two_factor_secret"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    createdById: uuid("created_by_id"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_role_idx").on(t.role), index("users_status_idx").on(t.status)],
);

/* --------------------------------------------------------------- accounts */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountNumber: text("account_number").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id),
    type: accountTypeEnum("type").notNull().default("SAVINGS"),
    nickname: text("nickname"),
    currency: text("currency").notNull().default("USD"),
    balance: bigint("balance", { mode: "number" }).notNull().default(0),
    status: accountStatusEnum("status").notNull().default("ACTIVE"),
    // per-account overrides (NULL = use bank-wide defaults from bank_settings)
    dailyTransferLimit: bigint("daily_transfer_limit", { mode: "number" }),
    maxTransactionAmount: bigint("max_transaction_amount", { mode: "number" }),
    minBalance: bigint("min_balance", { mode: "number" }),
    createdById: uuid("created_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    index("accounts_status_idx").on(t.status),
    // last line of defence: the database itself refuses a negative balance
    check("accounts_balance_non_negative", sql`${t.balance} >= 0`),
  ],
);

/* ----------------------------------------------------------- transactions */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    txnId: text("txn_id").notNull().unique(), // public reference e.g. TXN-20261121-7K2M9QXA
    type: txnTypeEnum("type").notNull(),
    status: txnStatusEnum("status").notNull().default("PENDING"),
    senderAccountId: uuid("sender_account_id").references(() => accounts.id),
    receiverAccountId: uuid("receiver_account_id").references(() => accounts.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
    fee: bigint("fee", { mode: "number" }).notNull().default(0),
    description: text("description"),
    failureReason: text("failure_reason"),
    // client supplied key -> guarantees a double-submitted request creates ONE transaction
    idempotencyKey: text("idempotency_key").unique(),
    initiatedById: uuid("initiated_by_id").references(() => users.id),
    reversalOfId: uuid("reversal_of_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("txn_sender_idx").on(t.senderAccountId, t.createdAt),
    index("txn_receiver_idx").on(t.receiverAccountId, t.createdAt),
    index("txn_created_idx").on(t.createdAt),
    index("txn_type_status_idx").on(t.type, t.status),
    check("txn_amount_positive", sql`${t.amount} > 0`),
    check("txn_fee_non_negative", sql`${t.fee} >= 0`),
  ],
);

/** Double-entry style ledger: one DEBIT/CREDIT row per affected account. Never updated or deleted. */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    direction: ledgerDirectionEnum("direction").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(), // includes fee for the debit side
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ledger_account_idx").on(t.accountId, t.createdAt), index("ledger_txn_idx").on(t.transactionId)],
);

/* ---------------------------------------------- deposit / withdrawal requests */
export const fundRequests = pgTable(
  "fund_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestNumber: text("request_number").notNull().unique(),
    type: txnTypeEnum("type").notNull(), // DEPOSIT | WITHDRAWAL
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
    description: text("description"),
    status: requestStatusEnum("status").notNull().default("PENDING"),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    reviewedById: uuid("reviewed_by_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fund_req_user_idx").on(t.userId), index("fund_req_status_idx").on(t.status, t.createdAt)],
);

/* ------------------------------------------------- suspicious transactions */
export const transactionFlags = pgTable(
  "transaction_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id),
    source: flagSourceEnum("source").notNull(),
    reason: text("reason").notNull(),
    status: flagStatusEnum("status").notNull().default("OPEN"),
    raisedById: uuid("raised_by_id").references(() => users.id),
    resolvedById: uuid("resolved_by_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("flag_status_idx").on(t.status, t.createdAt),
    uniqueIndex("flag_unique_reason").on(t.transactionId, t.source, t.reason),
  ],
);

/* ------------------------------------------------------------------ loans */
export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanNumber: text("loan_number").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id),
    accountId: uuid("account_id").notNull().references(() => accounts.id), // disbursed to / repaid from
    type: loanTypeEnum("type").notNull(),
    requestedAmount: bigint("requested_amount", { mode: "number" }).notNull(),
    approvedAmount: bigint("approved_amount", { mode: "number" }),
    durationMonths: integer("duration_months").notNull(),
    interestBps: integer("interest_bps").notNull(), // annual rate in basis points (1200 = 12.00%)
    monthlyIncome: bigint("monthly_income", { mode: "number" }).notNull(),
    employmentStatus: employmentEnum("employment_status").notNull(),
    description: text("description"),
    status: loanStatusEnum("status").notNull().default("PENDING"),
    emi: bigint("emi", { mode: "number" }),
    totalPayable: bigint("total_payable", { mode: "number" }),
    decisionNote: text("decision_note"),
    forwardedById: uuid("forwarded_by_id").references(() => users.id),
    forwardedAt: timestamp("forwarded_at", { withTimezone: true }),
    decidedById: uuid("decided_by_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
    disbursementTxnId: uuid("disbursement_txn_id").references(() => transactions.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loans_user_idx").on(t.userId), index("loans_status_idx").on(t.status)],
);

export const loanInstallments = pgTable(
  "loan_installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanId: uuid("loan_id").notNull().references(() => loans.id),
    number: integer("number").notNull(),
    dueDate: date("due_date").notNull(),
    principal: bigint("principal", { mode: "number" }).notNull(),
    interest: bigint("interest", { mode: "number" }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    status: installmentStatusEnum("status").notNull().default("PENDING"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    transactionId: uuid("transaction_id").references(() => transactions.id),
  },
  (t) => [uniqueIndex("installment_unique").on(t.loanId, t.number)],
);

/** Internal staff/admin notes - never returned to customers. */
export const loanNotes = pgTable(
  "loan_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanId: uuid("loan_id").notNull().references(() => loans.id),
    authorId: uuid("author_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loan_notes_loan_idx").on(t.loanId)],
);

/* ----------------------------------------------------- notifications / audit */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    type: text("type").notNull(), // MONEY_RECEIVED | TRANSFER_COMPLETED | DEPOSIT_APPROVED | ...
    title: text("title").notNull(),
    message: text("message").notNull(),
    link: text("link"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.read, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

/** Single-row table (id = 'global') holding bank-wide configurable limits. All money in cents. */
export const bankSettings = pgTable("bank_settings", {
  id: text("id").primaryKey().default("global"),
  dailyTransferLimit: bigint("daily_transfer_limit", { mode: "number" }).notNull().default(500_000), // $5,000.00
  maxTransactionAmount: bigint("max_transaction_amount", { mode: "number" }).notNull().default(2_500_000), // $25,000.00
  minAccountBalance: bigint("min_account_balance", { mode: "number" }).notNull().default(0),
  transferFee: bigint("transfer_fee", { mode: "number" }).notNull().default(50), // flat $0.50 on transfers to other customers
  largeTransactionThreshold: bigint("large_transaction_threshold", { mode: "number" }).notNull().default(1_000_000), // $10,000.00 -> auto flag
  updatedById: uuid("updated_by_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------- relations */
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  loans: many(loans),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  owner: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  sender: one(accounts, { fields: [transactions.senderAccountId], references: [accounts.id], relationName: "sender" }),
  receiver: one(accounts, { fields: [transactions.receiverAccountId], references: [accounts.id], relationName: "receiver" }),
  ledger: many(ledgerEntries),
  flags: many(transactionFlags),
}));

export const ledgerRelations = relations(ledgerEntries, ({ one }) => ({
  transaction: one(transactions, { fields: [ledgerEntries.transactionId], references: [transactions.id] }),
  account: one(accounts, { fields: [ledgerEntries.accountId], references: [accounts.id] }),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  borrower: one(users, { fields: [loans.userId], references: [users.id] }),
  account: one(accounts, { fields: [loans.accountId], references: [accounts.id] }),
  installments: many(loanInstallments),
  notes: many(loanNotes),
}));

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type LoanInstallment = typeof loanInstallments.$inferSelect;
export type BankSettings = typeof bankSettings.$inferSelect;
