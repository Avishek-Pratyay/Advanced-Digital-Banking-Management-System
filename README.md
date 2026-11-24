# Vaultline — Advanced Digital Banking Management System

A simulated, production-style digital bank built with **Next.js 14 (App Router) · TypeScript · Redux Toolkit + RTK Query · NextAuth · PostgreSQL (Drizzle ORM) · Tailwind CSS · Recharts**.

> **Simulation only.** No real money, cards, bank credentials or payment gateways are used. Deposits and withdrawals are simulated through a staff/admin approval workflow.

---

## 1. Project Overview

Three roles — **Admin**, **Bank Staff**, **Customer** — share one application. The focus is correct banking logic first (atomic transfers, server-side validation, immutable ledger, RBAC enforced in the API) and a polished fintech UI second.

| Area | What you get |
|---|---|
| Money safety | Integer-cent amounts, DB transactions, row locks, idempotency keys, CHECK constraints |
| Security | NextAuth JWT sessions, bcrypt, PIN + lockout, optional TOTP 2FA, API-level RBAC, audit log |
| UX | Sidebar shell, dashboards, filters, dialogs, light/dark theme, desktop/tablet/mobile |

## 2. Application Features

**Customer** — dashboard (total balance, deposits, withdrawals, recent transactions, active loans, account info) with multi-account switcher · account details/limits · CSV & PDF statements · transfers (own accounts or any customer, PIN-protected) · deposit/withdrawal requests · loan calculator, application, schedule, remaining balance, repayment (pay instalments) and history · PDF receipts · notifications · PIN / password / 2FA settings.

**Bank Staff** — register customers · create accounts · verify customer information · view customers/accounts · search transactions by ID, filter by date/type, review pending, **flag suspicious** · review & approve/reject deposit/withdrawal requests · view loan applications, add internal notes, **forward for admin approval**. Staff **cannot** approve loans or change bank-wide settings.

**Admin** — analytics dashboard (customers, accounts, bank balance, deposits, withdrawals, transactions, pending loans) with 5 charts · customer management (search, details, activate/deactivate/block, transaction history) · account management (create, update, freeze/unfreeze, per-account limits) · loan approve/reject/disburse + repayment history · flagged-transaction queue · transaction reversal · staff accounts · bank-wide limits (daily limit, max single transaction, minimum balance, fee, alert threshold) · audit log.

**Bonus items implemented:** PDF receipts with unique reference · notification system (money received, transfer completed, deposit approved, withdrawal rejected, loan approved/rejected + more) · configurable transaction limits · CSV/PDF statement export · TOTP two-factor authentication · rule-based suspicious-transaction detection · complete light/dark mode.

## 3. User Roles & Permissions

| Capability | Customer | Staff | Admin |
|---|:--:|:--:|:--:|
| Own accounts / transactions only | ✅ | – | – |
| Transfer, request deposit/withdrawal, apply for loan | ✅ | – | – |
| Register customers, open accounts, verify info | – | ✅ | ✅ |
| Review deposit/withdrawal requests (never their own) | – | ✅ | ✅ |
| Flag transactions | – | ✅ | ✅ |
| Add loan notes, forward loans | – | ✅ | ✅ |
| Approve / reject / disburse loans | – | ❌ | ✅ |
| Activate / deactivate / block customers | – | ❌ | ✅ |
| Freeze accounts, set limits, bank-wide settings | – | ❌ | ✅ |
| Resolve flags, reverse transactions, manage staff, audit log | – | ❌ | ✅ |

Enforcement is layered: **(1)** edge middleware (JWT) → **(2)** server layout guard re-reads role/status from the DB → **(3)** every API route is wrapped in `route([...roles], handler)` → **(4)** services re-check roles/ownership (defence in depth). Hiding a button is never the only protection.

## 4. Redux Toolkit Architecture (`src/store`)

```
store/
├─ index.ts            configureStore (api reducer + 5 slices + middleware)
├─ api.ts              RTK Query API (all endpoints, tags)
├─ middleware.ts       centralised loading + error handling
├─ hooks.ts            typed useAppDispatch / useAppSelector
└─ slices/
   ├─ authSlice.ts         session user / status (mirrors NextAuth)
   ├─ accountSlice.ts      selected account (account switcher)
   ├─ transactionSlice.ts  filters, pagination, selected transaction
   ├─ loanSlice.ts         loan filters + calculator state
   └─ uiSlice.ts           theme, sidebar, toasts, pendingRequests counter, lastError
```
* **Centralised loading state:** `requestStatusMiddleware` increments/decrements `ui.pendingRequests` for every RTK Query call → global top progress bar.
* **Centralised error handling:** rejected requests populate `ui.lastError` and raise a toast; field-level validation errors are shown inline instead.
* Feature-based slices — no “god slice”.

## 5. RTK Query Implementation

`createApi` with a normalising `baseQuery` (every failure becomes `{status, code, message, details}`; a `401` signs the user out). ~45 endpoints with **tag-based caching & invalidation**, e.g. `transfer` invalidates `Accounts, Transactions, Dashboard, Notifications`; `reviewRequest` invalidates `Requests, Transactions, Accounts, Dashboard, Flags`. Extras: `refetchOnFocus/Reconnect`, polling for notifications (30 s) and admin counters (60 s), lazy queries (recipient lookup, statement). Response types are derived type-only from the server services, so client and server cannot drift.

## 6. Authentication Strategy

NextAuth **Credentials** provider, JWT sessions (8 h). Passwords hashed with bcrypt; identical error for unknown email / wrong password; **5 failed logins → 15-minute lock**. Blocked/inactive users cannot sign in, and because role/status are re-read from the database on every request, blocking a user takes effect immediately. Sensitive operations additionally require a **transaction PIN** (bcrypt, 3 wrong attempts → 15-minute lock) and, if enabled, a **TOTP code** (Google Authenticator compatible).

## 7. Transaction Processing Logic

All money is stored as **integer cents** (`bigint`). A transfer (`src/server/services/transactions.ts → transferFunds`):

1. Validate input (zod) and amount precision; replay check on the **idempotency key** (double-submit returns the original transaction).
2. Verify the source account **belongs to the session user**; verify PIN (+ TOTP).
3. Open **one database transaction**: lock both account rows `SELECT … FOR UPDATE` (ordered ids → no deadlocks).
4. Validate **on the locked rows**: account/owner status, single-transaction limit, daily limit (sum of today’s completed transfers), minimum balance, sufficient funds incl. fee.
5. Guarded debit (`UPDATE … WHERE balance >= amount+fee`), credit, insert the transaction (unique `TXN-YYYYMMDD-XXXXXXXX` id), **two ledger entries** (debit/credit with `balance_after`), notifications for both sides, fraud rules.
6. Any error **rolls everything back** — money can never leave only one account. Business-rule rejections additionally leave a `FAILED` row for the audit trail. A DB `CHECK (balance >= 0)` is the last line of defence.

Deposits/withdrawals: customer creates a request (+ a `PENDING` transaction); only **approval by someone other than the requester** posts to the ledger, inside a transaction that locks the request and the account (so it cannot be approved twice or overdraw). Loans: staff forward → admin approves → disbursement is a recorded `LOAN_DISBURSEMENT` transaction + reducing-balance schedule; repayments are `LOAN_REPAYMENT` transactions that lock the loan row so an instalment can’t be paid twice. Reversals (admin) create a counter-transaction and keep history.

**Suspicious-transaction rules:** large amount (≥ configurable threshold), ≥ 5 outgoing transactions in 10 min, ≥ 50 % of balance to a first-time recipient, amount just under the single limit. Flags go to the admin queue (confirm → optional freeze, or dismiss).

## 8. Database Structure (PostgreSQL, Drizzle)

`users` · `accounts` · `transactions` · `ledger_entries` (append-only) · `fund_requests` · `transaction_flags` · `loans` · `loan_installments` · `loan_notes` · `notifications` · `audit_logs` · `bank_settings`. Enums for roles/statuses/types, indexes on all hot paths, FK integrity, unique constraints (`txn_id`, `idempotency_key`, `account_number`, `email`), CHECK constraints. Schema: `src/server/db/schema.ts`; SQL migration: `drizzle/`.

## 9. Security Implementation

Server-side balance validation · atomic transfers · immutable transaction history & ledger · account-ownership checks (other customers’ records return **404**) · PIN validation + lockout · role-based authorisation in every route · idempotency / duplicate prevention · zod validation on every input · centralised error handling (no stack traces leaked) · bcrypt · login throttling · CSV formula-injection guard · security headers (`X-Frame-Options`, `nosniff`, HSTS, Referrer/Permissions-Policy) · four-eyes rules (nobody reviews their own request/loan) · audit log. The client never sends balances; amounts are re-validated and recomputed on the server.

## 10. Environment Variables

| Variable | Required | Description |
|---|:--:|---|
| `DATABASE_URL` | prod | PostgreSQL URL. **Empty / `pglite` = embedded Postgres (PGlite)** stored in `./.data` (local dev only) |
| `NEXTAUTH_SECRET` | ✅ | Long random string (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | ✅ | Public base URL (`http://localhost:3000`, or your Vercel URL) |
| `RECEIPT_SECRET` | optional | Signs receipt reference codes (defaults to `NEXTAUTH_SECRET`) |

Copy `.env.example` → `.env.local`.

## 11. Local Setup

```bash
npm install
cp .env.example .env.local        # set NEXTAUTH_SECRET (a dev value is fine locally)
npm run db:setup                  # migrate + seed demo data (embedded Postgres, zero config)
npm run dev                       # http://localhost:3000
```
With a real PostgreSQL server set `DATABASE_URL=postgres://user:pass@host:5432/db` first. Other scripts: `npm run db:reset` (drop + recreate + seed), `npm test` (integration tests), `npm run typecheck`, `npm run build`.

**Tests** (`tests/banking.test.ts`, 17 tests on a real Postgres engine): seed ledger integrity · atomic transfer + ledger + notifications · insufficient funds leaves balances untouched · PIN lockout · idempotency · recipient/ownership/precision validation · frozen accounts · daily & single limits · concurrent transfers never overdraw · customers can’t see others’ data · request approval exactly once · withdrawal overdraw guard · staff can’t approve loans · loan disbursement ledger · auto-flagging · admin-only reversal.

## 12. Deployment (Vercel)

1. Create a PostgreSQL database (Neon / Supabase / Vercel Postgres) and copy its connection string.
2. Import the repo in Vercel; set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your production URL).
3. Set the **Build Command** to `npm run vercel-build` (runs migrations, idempotent demo seed, then `next build`).
4. Deploy. ⚠️ The embedded PGlite mode is **not** persistent on serverless platforms — always provide `DATABASE_URL` in production.

## 13. Demo Credentials

| Role | Email | Password | PIN |
|---|---|---|---|
| **Admin** | `admin@vaultline.test` | `Password@123` | – |
| **Bank Staff** | `staff@vaultline.test` | `Password@123` | – |
| **Customer** | `alice@vaultline.test` | `Password@123` | `2580` |

More customers: `bob@`, `carol@`, `david@`, `emma@` (unverified → cannot apply for loans), `frank@` — all `@vaultline.test`, same password & PIN. Alice’s account numbers: `100000000101`, `100000000102`; Bob’s: `100000000201`, `100000000202`.

**Quick walkthrough:** sign in as Alice → *Transfer Money* to `100000000201` (PIN 2580) → open the transaction → download the PDF receipt. Sign in as Staff → *Requests* → approve a deposit. Sign in as Admin → *Flagged Activity*, *Limits & Rules*, *Loans*.

## Additional libraries (beyond the required stack)

`drizzle-orm` + `postgres` (+ `@electric-sql/pglite` for zero-config local DB) · `zod` + `react-hook-form` (validation/forms) · `bcryptjs` · `otplib` + `qrcode` (TOTP 2FA) · `jspdf` + `jspdf-autotable` (receipts/statements) · `lucide-react` (icons) · `geist` (font) · `vitest` (tests).

## Project structure

```
src/app            routes: /login, /customer/*, /staff/*, /admin/*, /api/*
src/components     ui/ (design system), shared/, staff/, charts/, shell
src/server         db/ (schema, seed), services/ (business logic), auth, http (route wrapper)
src/store          Redux Toolkit + RTK Query
src/lib            validators, money, loan maths, pdf, constants
tests/             integration tests
```
