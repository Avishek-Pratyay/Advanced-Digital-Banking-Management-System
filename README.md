<div align="center">

<img src="docs/screenshots/landing.png" alt="Vaultline landing page" width="100%" />

# 🏦 Vaultline — Advanced Digital Banking Management System

**A secure, full-stack digital bank with three roles, atomic transfers, loans, live analytics and a permanent ledger.**

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Open_the_app-b88428?style=for-the-badge)](https://advanceddigitalbankingmanagementsys.vercel.app/)

![Next.js](https://img.shields.io/badge/Next.js_14-App_Router-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-RTK_Query-764ABC?style=flat-square&logo=redux&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![NextAuth](https://img.shields.io/badge/NextAuth-JWT_Sessions-0e625c?style=flat-square)
![Recharts](https://img.shields.io/badge/Recharts-Live_Charts-22b573?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-17_passing-2ea043?style=flat-square&logo=vitest&logoColor=white)

[🌐 Live Demo](https://advanceddigitalbankingmanagementsys.vercel.app/) ·
[🔑 Demo Credentials](#-demo-credentials) ·
[✨ Features](#-application-features) ·
[🏗️ Architecture](#%EF%B8%8F-redux-toolkit-architecture) ·
[⚙️ Setup](#%EF%B8%8F-local-setup-instructions) ·
[☁️ Deploy](#%EF%B8%8F-deployment-instructions)

</div>

> [!IMPORTANT]
> **Demonstration product.** Vaultline simulates a bank. No real money, cards, bank credentials or payment gateways are used. Deposits and withdrawals are simulated through a staff/admin approval workflow.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Screenshots](#-screenshots)
3. [Application Features](#-application-features)
4. [User Roles & Permissions](#-user-roles--permissions)
5. [Tech Stack](#-tech-stack)
6. [Redux Toolkit Architecture](#%EF%B8%8F-redux-toolkit-architecture)
7. [RTK Query Implementation](#-rtk-query-implementation)
8. [Authentication Strategy](#-authentication-strategy)
9. [Transaction Processing Logic](#-transaction-processing-logic)
10. [Database Structure](#%EF%B8%8F-database-structure)
11. [Security Implementation](#-security-implementation)
12. [Environment Variables](#-environment-variables)
13. [Local Setup Instructions](#%EF%B8%8F-local-setup-instructions)
14. [Deployment Instructions](#%EF%B8%8F-deployment-instructions)
15. [Demo Credentials](#-demo-credentials)
16. [Testing](#-testing)
17. [Additional Libraries](#-additional-libraries)
18. [Project Structure](#-project-structure)

---

## 🎯 Project Overview

Vaultline is a complete banking workflow, not just a dashboard. Customers manage accounts, move money, request deposits and withdrawals, and apply for loans. Bank staff onboard and verify customers and review activity. Admins run the bank: analytics, limits, loan decisions, account controls and fraud review.

The focus is **correct banking logic first** (atomic transfers, server-side validation, an append-only ledger, role checks on every API route) and a **polished fintech experience second** (responsive layouts, dark mode, real charts, confirmation dialogs, receipts).

| | |
|---|---|
| 🌐 **Live app** | https://advanceddigitalbankingmanagementsys.vercel.app/ |
| 👥 **Roles** | Admin · Bank Staff · Customer |
| 💵 **Money model** | Integer cents (`BIGINT`), converted to decimals only at the API boundary |
| 🔒 **Authorization** | Enforced on the server for every route, never only in the UI |
| 📱 **Responsive** | Desktop, tablet and mobile, with light and dark themes |

---

## 🖼️ Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/customer-dashboard.png" alt="Customer dashboard" /><br /><sub><b>👤 Customer dashboard</b>: balances, deposits, withdrawals, recent transactions, active loans and account switcher</sub></td>
    <td width="50%"><img src="docs/screenshots/admin-dashboard.png" alt="Admin dashboard" /><br /><sub><b>🛡️ Admin overview</b>: bank-wide stats and live charts from ledger data</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/transfer.png" alt="Fund transfer" /><br /><sub><b>💸 Fund transfer</b>: recipient lookup, PIN, fee and balance preview</sub></td>
    <td width="50%"><img src="docs/screenshots/loans.png" alt="Loans" /><br /><sub><b>🏠 Loans</b>: calculator, applications, status and repayment tracking</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/dark-mode.png" alt="Dark mode" /><br /><sub><b>🌙 Dark mode</b>: a complete theme across every dashboard page and chart</sub></td>
  </tr>
</table>

---

## ✨ Application Features

### 👤 Customer
- 📊 **Personal dashboard**: total balance, total deposits, total withdrawals, recent transactions, active loans and account information, with a switcher for customers who hold several accounts
- 🏦 **Account management**: account number, type (Savings, Current, Business), available balance, status and limits
- 📄 **Statements**: download transaction statements as **CSV** or **PDF** for any date range
- 💸 **Fund transfers**: between your own accounts or to any customer in the bank, with recipient account number, amount, description and transaction PIN
- ➕ **Deposit and withdrawal requests**: account, amount, request date and description, with statuses *Pending, Approved, Rejected*
- 💳 **Loans**: calculator, application (type, amount, duration, monthly income, employment status, description), status tracking, repayment schedule, remaining balance and repayment history
- 🧾 **PDF receipts** with a unique, signed reference code
- 🔔 **Notifications**: money received, transfer completed, deposit approved, withdrawal rejected, loan approved or rejected
- 🔐 **Security settings**: transaction PIN, password and two-factor authentication

### 🧑‍💼 Bank Staff
- 📝 Register new customers and create their bank accounts
- ✅ Verify customer information
- 🔍 View customers and account details
- 📋 View transactions, **search by transaction ID**, **filter by date and type**
- ⏳ Review pending deposit and withdrawal requests
- 🚩 **Flag suspicious transactions** for admin review
- 💼 View loan applications, review customer information, add **internal notes** and **forward applications** for admin approval

### 🛡️ Admin
- 📈 **Analytics dashboard**: total customers, bank accounts, bank balance, deposits, withdrawals, transactions and pending loan applications, with five charts
- 👥 **Customer management**: view and search customers, view details, activate or deactivate, **block suspicious accounts**, view transaction history
- 🏦 **Account management**: create accounts, view all accounts, update account information, **freeze or unfreeze**, set per-account transaction limits
- 💰 **Loan management**: view applications, **approve or reject**, disburse through a recorded transaction, view repayment history
- 🚩 Review flagged transactions, resolve flags and **reverse transfers**
- ⚙️ Configure bank-wide **limits and rules**, manage staff accounts, read the **audit log**

### 🎁 Bonus Features (all implemented)

| | Feature | Details |
|---|---|---|
| 🧾 | **PDF transaction receipt** | Downloadable, with a tamper-evident reference code |
| 🔔 | **Notification system** | In-app bell with unread count, refreshed every 30 seconds |
| 🎚️ | **Configurable limits** | Admin sets the daily transfer limit, maximum single transaction and minimum balance, plus per-account overrides |
| 📤 | **Statement export** | CSV (formula-injection safe) and PDF |
| 🔑 | **Two-factor authentication** | TOTP authenticator app (QR setup) for transfers, withdrawals and loan repayments |
| 🕵️ | **Suspicious transaction detection** | Rule-based flags sent to the admin review queue |
| 🌙 | **Dark mode** | Light, dark and system themes across all pages |

### 📊 Data Visualization (Recharts, real data only)

| Dashboard | Charts |
|---|---|
| 🛡️ **Admin** | Monthly transaction volume · Deposits vs withdrawals · Account distribution · Loan approval statistics · Monthly banking activity |
| 👤 **Customer** | Monthly spending · Monthly deposit history · Transaction distribution |

---

## 🔐 User Roles & Permissions

| Capability | 👤 Customer | 🧑‍💼 Staff | 🛡️ Admin |
|---|:--:|:--:|:--:|
| See only their own accounts and transactions | ✅ | – | – |
| Transfer money, request deposit/withdrawal, apply for loans | ✅ | – | – |
| Register customers, open accounts, verify customer information | – | ✅ | ✅ |
| Review deposit and withdrawal requests (never their own) | – | ✅ | ✅ |
| Search and filter all transactions, flag suspicious ones | – | ✅ | ✅ |
| Add loan notes and forward loans for approval | – | ✅ | ✅ |
| Approve, reject or disburse loans | – | ❌ | ✅ |
| Activate, deactivate or block customers | – | ❌ | ✅ |
| Freeze accounts and set per-account limits | – | ❌ | ✅ |
| Change bank-wide limits and settings | – | ❌ | ✅ |
| Resolve flags, reverse transactions, manage staff, read audit log | – | ❌ | ✅ |

**Authorization is layered**, so hiding a button is never the only protection:

1. 🚧 **Edge middleware** checks the JWT and redirects wrong-role visitors.
2. 🧱 **Server layout guard** re-reads the user's role and status from the database for every page.
3. 🔌 **Every API route** is wrapped in `route([...allowedRoles], handler)`.
4. 🧠 **Services re-check** role and ownership before changing data.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 14.2** (App Router) |
| Language | **TypeScript** (strict) |
| Styling | **Tailwind CSS 3** with a CSS-variable design system, light and dark themes |
| State management | **Redux Toolkit** (5 feature slices) |
| API data | **RTK Query** (44 endpoints, tag-based caching) |
| Charts | **Recharts 2** |
| Authentication | **NextAuth v4** (Credentials provider, JWT sessions) |
| Database | **PostgreSQL** with **Drizzle ORM** (embedded PGlite for zero-config local development) |
| Forms and validation | React Hook Form + Zod |

---

## 🏗️ Redux Toolkit Architecture

Redux Toolkit manages global state. Logic is split into **feature-based modules**, with no single catch-all slice.

```text
src/store/
├─ index.ts              configureStore: api reducer + 5 slices + middleware
├─ api.ts                RTK Query API (all endpoints, tags)
├─ middleware.ts         centralised loading and error handling
├─ hooks.ts              typed useAppDispatch / useAppSelector
└─ slices/
   ├─ authSlice.ts          🔐 session user and status (mirrors NextAuth)
   ├─ accountSlice.ts       🏦 selected account (account switcher)
   ├─ transactionSlice.ts   💸 search, date, type, status filters, pagination, selection
   ├─ loanSlice.ts          💳 loan filters and calculator inputs
   └─ uiSlice.ts            🎛️ theme, sidebar, toasts, pending-request counter, last error
```

```mermaid
flowchart LR
  UI[React components] -->|dispatch / hooks| Store[(Redux store)]
  Store --- Auth[auth]
  Store --- Account[account]
  Store --- Txn[transactions]
  Store --- Loans[loans]
  Store --- UIs[ui]
  Store --- API[RTK Query api]
  API -->|fetch| Routes[Next.js API routes]
  Routes --> Services[Server services]
  Services --> DB[(PostgreSQL)]
  MW[requestStatusMiddleware] -. counts pending calls, shows errors .-> UIs
  API -. actions .-> MW
```

| Requirement | Implementation |
|---|---|
| ⚙️ Store configuration | `store/index.ts` with `configureStore`, typed hooks, `setupListeners` |
| 🧩 Multiple slices | Auth, account, transactions, loans and UI in separate files |
| 🔄 Async thunks or RTK Query | RTK Query for all server data |
| ⏳ Centralised loading | `requestStatusMiddleware` tracks every request in `ui.pendingRequests` and drives one global progress bar |
| 🚨 Error handling | The same middleware stores failures in `ui.lastError` and raises toasts. Form-level errors (wrong PIN, validation) are shown inline instead |
| 🔐 Authentication state | `authSlice`, filled from the NextAuth session |
| 🏦 Account state | `accountSlice` (selected account); account data lives in the RTK Query cache |
| 💸 Transaction state | `transactionSlice` (filters, page, selected transaction) |
| 💳 Loan state | `loanSlice` (filters and calculator) |

---

## 🔄 RTK Query Implementation

All server communication goes through one `createApi` instance in `src/store/api.ts`:

- 🧱 **44 endpoints** (20 queries and 24 mutations) with typed request and response shapes. Response types are derived type-only from the server services, so client and server cannot drift apart.
- 🧯 **Normalised errors**: a custom base query turns every failure into `{ status, code, message, details }`. A `401` signs the user out.
- 🏷️ **Tag-based caching and invalidation** with 12 tags: `Me, Dashboard, Accounts, Transactions, Requests, Loans, Customers, Notifications, Settings, Flags, Staff, Audit`. For example, a transfer invalidates `Accounts`, `Transactions`, `Dashboard` and `Notifications`, so every screen refreshes without manual refetching.
- 🔁 **Synchronisation**: `refetchOnFocus` and `refetchOnReconnect` are on. Notifications poll every 30 seconds and admin and staff counters every 60 seconds.
- ⚡ **Lazy queries** for recipient lookup while typing an account number and for statement generation.

---

## 🔑 Authentication Strategy

- 🪪 **NextAuth v4** with the **Credentials** provider and **JWT sessions** (8 hours).
- 🔒 Passwords are hashed with **bcrypt**. Unknown email and wrong password return the same error, so accounts cannot be enumerated.
- 🚫 **Login throttling**: 5 failed attempts lock sign-in for 15 minutes.
- 👮 **Live status checks**: role and status are re-read from the database on every API request and page, so blocking or deactivating a user takes effect immediately, not when their token expires.
- 🔢 **Transaction PIN**: a separate bcrypt-hashed PIN is required for transfers and loan repayments. 3 wrong attempts lock it for 15 minutes.
- 📱 **Two-factor authentication (optional)**: TOTP, compatible with Google Authenticator and similar apps. Once enabled, a code is also required for transfers, withdrawal requests and loan repayments.
- 🧭 **Route protection**: edge middleware, server layout guards and API route wrappers, as described in [User Roles & Permissions](#-user-roles--permissions).

---

## 💸 Transaction Processing Logic

All money is stored as **integer cents**. A transfer (`src/server/services/transactions.ts`) runs like this:

```mermaid
sequenceDiagram
  autonumber
  participant C as Customer
  participant A as API route
  participant S as Transfer service
  participant D as PostgreSQL
  C->>A: POST /api/transactions/transfer (amount, recipient, PIN, idempotency key)
  A->>A: Verify session and role, validate input (Zod)
  A->>S: transferFunds()
  S->>S: Replay check on idempotency key
  S->>S: Verify source account belongs to the user, PIN, optional TOTP
  S->>D: BEGIN
  S->>D: Lock both account rows (ordered, SELECT ... FOR UPDATE)
  S->>S: Re-check status, limits, minimum balance, funds on locked rows
  S->>D: Guarded debit, credit, transaction row, 2 ledger entries, notifications
  S->>S: Run suspicious-activity rules
  S->>D: COMMIT (any error means ROLLBACK)
  A-->>C: Transaction ID and receipt data
```

1. ✅ **Validate** the input and amount precision. A duplicate **idempotency key** returns the original transaction instead of paying twice.
2. 🪪 **Verify** that the source account belongs to the logged-in user, then the PIN (and TOTP if enabled).
3. 🔒 **Lock** both account rows with `SELECT … FOR UPDATE`, in a fixed order so concurrent transfers cannot deadlock.
4. 🧮 **Validate on the locked rows**: account and owner status, single-transaction limit, daily limit, minimum balance and sufficient funds including the fee.
5. 💰 **Move the money** in one database transaction: guarded debit (`WHERE balance >= amount + fee`), credit, a transaction row with a unique ID (`TXN-YYYYMMDD-XXXXXXXX`), and **two ledger entries** with the balance after each.
6. ♻️ **Roll back everything on any error**, so money can never leave only one account. A database `CHECK (balance >= 0)` is the last line of defence.

**Other money flows**
- ➕➖ **Deposits and withdrawals**: a customer submits a request, and only approval by someone *other than the requester* posts to the ledger. The request and account are locked, so a request cannot be approved twice or overdraw an account.
- 💳 **Loans**: staff forward → admin approves → disbursement is recorded as a `LOAN_DISBURSEMENT` transaction and a reducing-balance repayment schedule is created. Each instalment is a `LOAN_REPAYMENT` transaction, and the loan row is locked so an instalment cannot be paid twice.
- ↩️ **Reversals**: admin-only. A reversal creates a counter-transaction and marks the original `REVERSED`, so history is preserved.
- 🏷️ **Transaction types**: Deposit, Withdrawal, Fund Transfer, Loan Disbursement, Loan Repayment.
- 🚦 **Statuses**: Pending, Completed, Failed, Reversed.

**🕵️ Suspicious-transaction rules** (results go to the admin review queue):

| Rule | Trigger |
|---|---|
| 💥 Large amount | At or above the admin-configured alert threshold |
| ⚡ Velocity | 5 or more outgoing transactions within 10 minutes |
| 🆕 First-time recipient | 50% or more of the balance sent to a new recipient |
| 🎯 Just below the limit | Amount between 90% and 100% of the single-transaction limit |

---

## 🗄️ Database Structure

PostgreSQL, managed with Drizzle ORM. Schema: `src/server/db/schema.ts`. SQL migration: `drizzle/`.

```mermaid
erDiagram
  users ||--o{ accounts : owns
  users ||--o{ loans : applies
  users ||--o{ notifications : receives
  users ||--o{ audit_logs : performs
  accounts ||--o{ transactions : "sends / receives"
  accounts ||--o{ ledger_entries : records
  transactions ||--o{ ledger_entries : "posts"
  transactions ||--o{ transaction_flags : "may be flagged"
  accounts ||--o{ fund_requests : "target of"
  loans ||--o{ loan_installments : schedules
  loans ||--o{ loan_notes : "internal notes"
```

| Table | Purpose |
|---|---|
| `users` | Customers, staff and admins with role, status, verification, PIN hash and 2FA secret |
| `accounts` | Bank accounts (Savings, Current, Business) with balance in cents, status and optional limits |
| `transactions` | Every money movement: ID, sender, receiver, type, amount, fee, status, description, timestamps |
| `ledger_entries` | **Append-only** double-entry records with `balance_after` for each side |
| `fund_requests` | Deposit and withdrawal requests and their review outcome |
| `transaction_flags` | Suspicious-transaction flags and their resolution |
| `loans` | Loan applications and their lifecycle |
| `loan_installments` | Repayment schedule, one row per instalment |
| `loan_notes` | Staff-only internal notes on loan applications |
| `notifications` | In-app notifications per user |
| `audit_logs` | Who did what, and when, for sensitive operations |
| `bank_settings` | Bank-wide limits, fee and alert threshold |

**Integrity rules in the database:** foreign keys on every relation, unique constraints (`txn_id`, `idempotency_key`, `account_number`, `email`), `CHECK (balance >= 0)`, `CHECK (amount > 0)`, non-negative fees, and indexes on every hot query path.

---

## 🛡️ Security Implementation

| Control | How it works |
|---|---|
| 🧮 **Server-side balance validation** | Balances are checked on locked database rows, never trusted from the client |
| ⚛️ **Atomic fund transfers** | One database transaction with ordered row locks, rolled back on any error |
| 📜 **Transaction history preservation** | No endpoint edits or deletes transactions or ledger entries. A reversal is a new entry |
| 🪪 **Account ownership verification** | The source account must belong to the logged-in user. Other people's records return `404`, so their existence is not revealed |
| 🔢 **Transaction PIN** | bcrypt-hashed. 3 wrong attempts lock it for 15 minutes using an atomic counter |
| 🧱 **Role-based authorization** | Middleware, layout guards, route wrappers and service-level checks |
| 🔁 **Duplicate transaction prevention** | A unique idempotency key per transfer, and row locks on requests and loans |
| ✔️ **Input validation** | Zod schemas on every request body and query, shared by client and server |
| 🧯 **Error handling** | One central handler returns consistent error codes without leaking stack traces |
| 🔐 **Password and login protection** | bcrypt hashing and a 5-attempt, 15-minute login lockout |
| 👥 **Four-eyes rules** | Nobody can review their own deposit or withdrawal request, or decide their own loan |
| 📤 **CSV export safety** | Formula-injection characters are neutralised in exported statements |
| 🧰 **HTTP security headers** | `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy` |
| 📒 **Audit log** | Sensitive actions are recorded with the actor and time |

**A customer can never:** transfer more than their available balance, modify a balance directly (no endpoint accepts one), read another customer's transactions, approve their own deposit or withdrawal, or change amounts through frontend requests (the server recalculates amounts and fees).

---

## 🔧 Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

| Variable | Required | Description |
|---|:--:|---|
| `DATABASE_URL` | Production | PostgreSQL connection string. **Leave empty (or set `pglite`) for the embedded local database** stored in `./.data` |
| `NEXTAUTH_SECRET` | ✅ | Long random string used to sign sessions. Generate one with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Public URL of the app: `http://localhost:3000` locally, your Vercel URL in production |
| `RECEIPT_SECRET` | Optional | Key used to sign receipt reference codes. Defaults to `NEXTAUTH_SECRET` |

```env
DATABASE_URL=
NEXTAUTH_SECRET=change-me-to-a-long-random-string
NEXTAUTH_URL=http://localhost:3000
```

> [!WARNING]
> Never commit `.env.local` or paste real database URLs into the repository. `.env` files are already in `.gitignore`.

---

## ⚙️ Local Setup Instructions

**Requirements:** Node.js 18.17 or newer and npm.

```bash
# 1. Clone the repository
git clone https://github.com/Avishek-Pratyay/Advanced-Digital-Banking-Management-System.git
cd Advanced-Digital-Banking-Management-System

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env.local        # then set NEXTAUTH_SECRET (any long string works locally)

# 4. Create the tables and load demo data (embedded PostgreSQL, no installation needed)
npm run db:setup

# 5. Start the development server
npm run dev                       # http://localhost:3000
```

To use your own PostgreSQL server, set `DATABASE_URL=postgres://user:password@host:5432/dbname` in `.env.local` before step 4.

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run db:setup` | Run migrations and seed demo data |
| `npm run db:reset` | Drop everything, recreate and reseed (**destroys data**) |
| `npm test` | Run the integration tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

---

## ☁️ Deployment Instructions

The live app runs on **Vercel** with a **Neon** PostgreSQL database: https://advanceddigitalbankingmanagementsys.vercel.app/

1. 🗄️ **Create a PostgreSQL database.** Neon, Supabase or Vercel Postgres all work. Copy the connection string, which should end with `?sslmode=require`.
2. 🐙 **Push the project to GitHub.**
3. ▲ **Import the repository in Vercel** (Add New → Project).
4. 🔑 **Add environment variables** in Vercel:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your PostgreSQL connection string |
   | `NEXTAUTH_SECRET` | a long random string |
   | `NEXTAUTH_URL` | your exact Vercel URL, for example `https://your-project.vercel.app` |

5. 🛠️ **Set the Build Command** (Build & Output Settings → Override) to:
   ```bash
   npm run vercel-build
   ```
   This runs the database migration, loads the demo data (safe to repeat) and then builds the app.
6. 🚀 **Deploy.** If `NEXTAUTH_URL` did not match the final URL, correct it and redeploy.

> [!NOTE]
> The embedded local database (PGlite) is for development only and is not persistent on serverless platforms. Always provide `DATABASE_URL` in production.

---

## 🔑 Demo Credentials

🌐 **Live app:** https://advanceddigitalbankingmanagementsys.vercel.app/

| Role | Email | Password | PIN |
|---|---|---|:--:|
| 🛡️ **Admin** | `admin@vaultline.test` | `Password@123` | – |
| 🧑‍💼 **Bank Staff** | `staff@vaultline.test` | `Password@123` | – |
| 👤 **Customer** | `alice@vaultline.test` | `Password@123` | `2580` |

**More accounts** (all use `Password@123`, customer PIN `2580`):
- Customers: `bob@vaultline.test`, `carol@vaultline.test`, `david@vaultline.test`, `emma@vaultline.test` (not yet verified, so she cannot apply for loans), `frank@vaultline.test`
- Staff: `maya.staff@vaultline.test`

**Useful account numbers:** Alice `100000000101` and `100000000102` · Bob `100000000201` and `100000000202`

### 🧭 Quick walkthrough
1. 👤 Sign in as **Alice**, open **Transfer Money**, send to `100000000201` with PIN `2580`, then open the transaction and download the **PDF receipt**.
2. 👤 As Alice, open **Loans**, try the calculator and look at the active loan's repayment schedule.
3. 🧑‍💼 Sign in as **Staff** and open **Requests** to approve a deposit, then look at **Customers** and **Loans**.
4. 🛡️ Sign in as **Admin** and explore the dashboard charts, **Flagged Activity**, **Limits & Rules**, **Loans** and **Audit Log**.

---

## 🧪 Testing

```bash
npm test
```

17 integration tests run against a real in-memory PostgreSQL engine and cover:

- ✅ Seed ledger integrity: every balance equals its last ledger entry and none is negative
- ✅ Atomic transfer with two ledger rows, a unique transaction ID and notifications for both sides
- ✅ Insufficient funds leave both balances untouched
- ✅ PIN lockout after repeated failures
- ✅ Idempotency: the same request never pays twice
- ✅ Recipient, self-transfer, ownership and amount-precision validation
- ✅ Frozen accounts, daily limits and single-transaction limits
- ✅ Concurrent transfers can never overdraw an account and total money is conserved
- ✅ Customers only see their own transactions
- ✅ Customers cannot flag, reverse or change account settings
- ✅ Deposit and withdrawal approval happens exactly once, and withdrawals cannot overdraw
- ✅ Staff can forward loans but not approve them, and admin approval disburses through a recorded transaction
- ✅ Large transfers are flagged automatically
- ✅ Only admins can reverse transactions, and history is kept

---

## 📦 Additional Libraries

Beyond the required stack (Next.js, TypeScript, Tailwind CSS, Redux Toolkit, RTK Query, Recharts, NextAuth), these libraries are used:

| Library | Why it is used |
|---|---|
| `drizzle-orm`, `drizzle-kit`, `postgres` | Type-safe PostgreSQL queries and migrations |
| `@electric-sql/pglite` | Embedded PostgreSQL for zero-config local development and tests |
| `zod`, `react-hook-form`, `@hookform/resolvers` | Shared validation and form handling |
| `bcryptjs` | Password and PIN hashing |
| `otplib`, `qrcode` | TOTP two-factor authentication and QR codes |
| `jspdf`, `jspdf-autotable` | PDF receipts and statements |
| `lucide-react` | Icons |
| `geist` | Typeface |
| `clsx` | Conditional class names |
| `vitest`, `tsx`, `eslint` | Testing, script runner and linting |

---

## 🗂️ Project Structure

```text
src/
├─ app/
│  ├─ page.tsx            public landing page
│  ├─ login/              sign-in
│  ├─ customer/           customer pages
│  ├─ staff/              staff pages
│  ├─ admin/              admin pages
│  └─ api/                37 API route files
├─ components/            ui/ (design system), shared/, staff/, charts/, shell
├─ server/
│  ├─ db/                 schema, migrations runner, seed
│  ├─ services/           business logic (transfers, loans, requests, dashboards)
│  ├─ auth.ts             NextAuth configuration
│  └─ http.ts             route wrapper, role checks, error handling
├─ store/                 Redux Toolkit slices, RTK Query API, middleware
├─ lib/                   validators, money helpers, loan maths, PDF, constants
└─ types/
drizzle/                  SQL migration
tests/                    integration tests
docs/screenshots/         README images
```

---

<div align="center">

**Built with Next.js, Redux Toolkit and PostgreSQL** 🏦

[🌐 Open the live demo](https://advanceddigitalbankingmanagementsys.vercel.app/)

</div>
