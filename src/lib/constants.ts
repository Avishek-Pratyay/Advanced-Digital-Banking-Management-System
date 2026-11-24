export const ROLES = ["ADMIN", "STAFF", "CUSTOMER"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;
export const ACCOUNT_TYPES = ["SAVINGS", "CURRENT", "BUSINESS"] as const;
export const ACCOUNT_STATUSES = ["ACTIVE", "FROZEN", "CLOSED"] as const;
export const TXN_TYPES = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "LOAN_DISBURSEMENT", "LOAN_REPAYMENT"] as const;
export const TXN_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REVERSED"] as const;
export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const LOAN_TYPES = ["PERSONAL", "HOME", "AUTO", "EDUCATION", "BUSINESS"] as const;
export const LOAN_STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "ACTIVE", "COMPLETED"] as const;
export const EMPLOYMENT_STATUSES = ["EMPLOYED", "SELF_EMPLOYED", "BUSINESS_OWNER", "STUDENT", "RETIRED", "UNEMPLOYED"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type TxnType = (typeof TXN_TYPES)[number];
export type TxnStatus = (typeof TXN_STATUSES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type LoanType = (typeof LOAN_TYPES)[number];
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** Annual interest (basis points) and maximum duration per loan product. */
export const LOAN_PRODUCTS: Record<LoanType, { label: string; interestBps: number; maxMonths: number; minAmount: number; maxAmount: number }> = {
  PERSONAL: { label: "Personal Loan", interestBps: 1200, maxMonths: 60, minAmount: 500, maxAmount: 50_000 },
  HOME: { label: "Home Loan", interestBps: 800, maxMonths: 360, minAmount: 10_000, maxAmount: 1_000_000 },
  AUTO: { label: "Auto Loan", interestBps: 1000, maxMonths: 84, minAmount: 2_000, maxAmount: 150_000 },
  EDUCATION: { label: "Education Loan", interestBps: 600, maxMonths: 120, minAmount: 1_000, maxAmount: 200_000 },
  BUSINESS: { label: "Business Loan", interestBps: 1100, maxMonths: 120, minAmount: 5_000, maxAmount: 500_000 },
};

export const LABELS: Record<string, string> = {
  ADMIN: "Admin", STAFF: "Bank Staff", CUSTOMER: "Customer",
  ACTIVE: "Active", INACTIVE: "Inactive", BLOCKED: "Blocked", FROZEN: "Frozen", CLOSED: "Closed",
  SAVINGS: "Savings", CURRENT: "Current", BUSINESS: "Business",
  DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal", TRANSFER: "Fund Transfer",
  LOAN_DISBURSEMENT: "Loan Disbursement", LOAN_REPAYMENT: "Loan Repayment",
  PENDING: "Pending", COMPLETED: "Completed", FAILED: "Failed", REVERSED: "Reversed",
  APPROVED: "Approved", REJECTED: "Rejected", UNDER_REVIEW: "Under Review",
  PERSONAL: "Personal", HOME: "Home", AUTO: "Auto", EDUCATION: "Education",
  EMPLOYED: "Employed", SELF_EMPLOYED: "Self-employed", BUSINESS_OWNER: "Business owner", STUDENT: "Student", RETIRED: "Retired", UNEMPLOYED: "Unemployed",
  OPEN: "Open", DISMISSED: "Dismissed", CONFIRMED: "Confirmed", PAID: "Paid", STAFF_SRC: "Staff", SYSTEM: "System",
};
export const label = (k: string | null | undefined) => (k ? LABELS[k] ?? k : "—");

export const HOME_BY_ROLE: Record<Role, string> = { ADMIN: "/admin", STAFF: "/staff", CUSTOMER: "/customer" };
