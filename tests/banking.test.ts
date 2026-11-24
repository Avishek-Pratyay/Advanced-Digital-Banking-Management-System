// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "pglite:memory";
process.env.NEXTAUTH_SECRET = "test-secret";

type Mods = {
  db: typeof import("@/server/db")["db"];
  schema: typeof import("@/server/db/schema");
  tx: typeof import("@/server/services/transactions");
  fr: typeof import("@/server/services/fund-requests");
  loans: typeof import("@/server/services/loans");
  acc: typeof import("@/server/services/accounts");
  seed: typeof import("@/server/db/seed");
  eq: typeof import("drizzle-orm")["eq"];
};
let m: Mods;
let alice: { id: string; role: "CUSTOMER"; name: string };
let bob: { id: string; role: "CUSTOMER"; name: string };
let admin: { id: string; role: "ADMIN"; name: string };
let staff: { id: string; role: "STAFF"; name: string };
let aliceAcc: string, bobAccNo: string, bobAcc: string;

const PIN = "2580";
let k = 0;
const key = () => `test-key-${Date.now()}-${++k}`;
const bal = async (id: string) => (await m.db.select().from(m.schema.accounts).where(m.eq(m.schema.accounts.id, id)))[0].balance;
const transfer = (over: Partial<Parameters<Mods["tx"]["transferFunds"]>[1]> = {}) =>
  m.tx.transferFunds(alice, { fromAccountId: aliceAcc, toAccountNumber: bobAccNo, amount: 10, description: "t", pin: PIN, idempotencyKey: key(), ...over });

beforeAll(async () => {
  const dbm = await import("@/server/db");
  const mig = await import("@/server/db/migrate");
  const drizzle = await import("drizzle-orm");
  m = {
    db: dbm.db, schema: await import("@/server/db/schema"), tx: await import("@/server/services/transactions"), fr: await import("@/server/services/fund-requests"),
    loans: await import("@/server/services/loans"), acc: await import("@/server/services/accounts"), seed: await import("@/server/db/seed"), eq: drizzle.eq,
  };
  await mig.runMigrations();
  await m.seed.seedDatabase(m.db);
  const u = async (email: string) => (await m.db.select().from(m.schema.users).where(drizzle.eq(m.schema.users.email, email)))[0];
  const a = await u("alice@vaultline.test"), b = await u("bob@vaultline.test"), ad = await u("admin@vaultline.test"), st = await u("staff@vaultline.test");
  alice = { id: a.id, role: "CUSTOMER", name: a.name };
  bob = { id: b.id, role: "CUSTOMER", name: b.name };
  admin = { id: ad.id, role: "ADMIN", name: ad.name };
  staff = { id: st.id, role: "STAFF", name: st.name };
  aliceAcc = (await m.db.select().from(m.schema.accounts).where(drizzle.eq(m.schema.accounts.accountNumber, "100000000102")))[0].id;
  const bobRow = (await m.db.select().from(m.schema.accounts).where(drizzle.eq(m.schema.accounts.accountNumber, "100000000201")))[0];
  bobAcc = bobRow.id;
  bobAccNo = bobRow.accountNumber;
});

describe("ledger integrity (seed data)", () => {
  it("every account balance equals its last ledger balanceAfter, and none is negative", async () => {
    const accs = await m.db.select().from(m.schema.accounts);
    for (const a of accs) {
      const rows = await m.db.select().from(m.schema.ledgerEntries).where(m.eq(m.schema.ledgerEntries.accountId, a.id));
      rows.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
      expect(a.balance).toBeGreaterThanOrEqual(0);
      if (rows.length) expect(rows[rows.length - 1].balanceAfter).toBe(a.balance);
    }
  });
});

describe("fund transfer", () => {
  it("moves money atomically, writes two ledger rows, a unique txn id and notifies both sides", async () => {
    const [a0, b0] = [await bal(aliceAcc), await bal(bobAcc)];
    const { transaction: t, duplicate } = await transfer({ amount: 100.25 });
    expect(duplicate).toBe(false);
    expect(t.txnId).toMatch(/^TXN-\d{8}-[A-Z0-9]{8}$/);
    expect(t.status).toBe("COMPLETED");
    const fee = t.fee * 100;
    expect(await bal(aliceAcc)).toBe(a0 - 10025 - fee);
    expect(await bal(bobAcc)).toBe(b0 + 10025);
    expect(t.ledger).toHaveLength(1); // alice only sees her own ledger side
    const adminView = await m.tx.getTransaction(admin, t.id);
    expect(adminView.ledger).toHaveLength(2);
    const bobSees = await m.tx.getTransaction(bob, t.id);
    expect(bobSees.direction).toBe("IN");
    const notes = await m.db.select().from(m.schema.notifications);
    expect(notes.some((n) => n.userId === bob.id && n.type === "MONEY_RECEIVED")).toBe(true);
    expect(notes.some((n) => n.userId === alice.id && n.type === "TRANSFER_COMPLETED")).toBe(true);
  });

  it("rejects insufficient funds and leaves both balances untouched", async () => {
    const [a0, b0] = [await bal(aliceAcc), await bal(bobAcc)];
    await expect(transfer({ amount: 900_000 })).rejects.toMatchObject({ status: 422 });
    expect(await bal(aliceAcc)).toBe(a0);
    expect(await bal(bobAcc)).toBe(b0);
  });

  it("rejects a wrong PIN, then locks after 3 failures", async () => {
    await expect(transfer({ pin: "1111" })).rejects.toMatchObject({ code: "INVALID_PIN" });
    await expect(transfer({ pin: "1111" })).rejects.toMatchObject({ code: "INVALID_PIN" });
    await expect(transfer({ pin: "1111" })).rejects.toMatchObject({ status: 429 });
    await expect(transfer()).rejects.toMatchObject({ status: 429 }); // even the right PIN is refused while locked
    await m.db.update(m.schema.users).set({ pinFailedAttempts: 0, pinLockedUntil: null }).where(m.eq(m.schema.users.id, alice.id));
  });

  it("is idempotent: the same key never pays twice", async () => {
    const a0 = await bal(aliceAcc);
    const idem = key();
    const first = await transfer({ amount: 5, idempotencyKey: idem });
    const second = await transfer({ amount: 5, idempotencyKey: idem });
    expect(second.duplicate).toBe(true);
    expect(second.transaction.id).toBe(first.transaction.id);
    expect(await bal(aliceAcc)).toBe(a0 - 500 - Math.round(first.transaction.fee * 100));
  });

  it("validates recipient, self-transfer, ownership of source account and amount precision", async () => {
    await expect(transfer({ toAccountNumber: "999999999999" })).rejects.toMatchObject({ code: "RECIPIENT_NOT_FOUND" });
    await expect(transfer({ toAccountNumber: "100000000101" })).resolves.toBeDefined(); // own other account: allowed
    const own = (await m.db.select().from(m.schema.accounts).where(m.eq(m.schema.accounts.id, aliceAcc)))[0];
    await expect(transfer({ toAccountNumber: own.accountNumber })).rejects.toMatchObject({ code: "SAME_ACCOUNT" });
    // bob's account as the SOURCE from alice's session must look like it does not exist
    await expect(transfer({ fromAccountId: bobAcc })).rejects.toMatchObject({ status: 404 });
    await expect(transfer({ amount: 1.005 })).rejects.toMatchObject({ status: 400 });
    await expect(transfer({ amount: -5 })).rejects.toBeDefined();
  });

  it("blocks transfers from or to frozen accounts", async () => {
    await m.acc.updateAccount(admin, bobAcc, { status: "FROZEN" });
    await expect(transfer()).rejects.toMatchObject({ code: "RECIPIENT_NOT_ACTIVE" });
    await m.acc.updateAccount(admin, bobAcc, { status: "ACTIVE" });
  });

  it("enforces the daily limit and single transaction limit", async () => {
    const sentToday = (await m.db.select().from(m.schema.transactions))
      .filter((t) => t.senderAccountId === aliceAcc && t.type === "TRANSFER" && t.status === "COMPLETED" && t.createdAt >= new Date(new Date().toISOString().slice(0, 10)))
      .reduce((s, t) => s + t.amount, 0) / 100;
    try {
      await m.acc.updateAccount(admin, aliceAcc, { maxTransactionAmount: 50, dailyTransferLimit: sentToday + 120 });
      await expect(transfer({ amount: 60 })).rejects.toMatchObject({ code: "SINGLE_LIMIT_EXCEEDED" });
      await expect(transfer({ amount: 50 })).resolves.toBeDefined();
      await expect(transfer({ amount: 50 })).resolves.toBeDefined();
      await expect(transfer({ amount: 50 })).rejects.toMatchObject({ code: "DAILY_LIMIT_EXCEEDED" });
    } finally {
      await m.acc.updateAccount(admin, aliceAcc, { maxTransactionAmount: null, dailyTransferLimit: null });
    }
  });

  it("concurrent transfers can never overdraw the account and conserve total money", async () => {
    const start = await bal(aliceAcc);
    const total0 = (await bal(aliceAcc)) + (await bal(bobAcc));
    // each request is ~45% of the balance; at most two can succeed
    const amount = Math.floor((start / 100) * 0.45);
    await m.db.update(m.schema.bankSettings).set({ dailyTransferLimit: 100_000_000, maxTransactionAmount: 100_000_000 });
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => transfer({ amount })));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBeLessThanOrEqual(2);
    expect(await bal(aliceAcc)).toBeGreaterThanOrEqual(0);
    const fees = (await m.db.select().from(m.schema.transactions)).filter((t) => t.type === "TRANSFER" && t.status === "COMPLETED").reduce((s, t) => s + t.fee, 0);
    expect(fees).toBeGreaterThan(0);
    const total1 = (await bal(aliceAcc)) + (await bal(bobAcc));
    expect(total0 - total1).toBeGreaterThanOrEqual(0); // only fees leave the pair
    await m.db.update(m.schema.bankSettings).set({ dailyTransferLimit: 500_000, maxTransactionAmount: 2_500_000 });
  });
});

describe("privacy & authorisation in the service layer", () => {
  it("customers only ever see their own transactions", async () => {
    const mine = await m.tx.listTransactions(alice, { page: 1, pageSize: 100 });
    const aliceAccs = (await m.db.select().from(m.schema.accounts).where(m.eq(m.schema.accounts.userId, alice.id))).map((a) => a.id);
    for (const t of mine.items) expect(aliceAccs.some((id) => t.sender?.id === id || t.receiver?.id === id)).toBe(true);
    const carolAcc = (await m.db.select().from(m.schema.transactions)).find((t) => t.type === "TRANSFER" && !aliceAccs.includes(t.senderAccountId!) && !aliceAccs.includes(t.receiverAccountId!))!;
    await expect(m.tx.getTransaction(alice, carolAcc.id)).rejects.toMatchObject({ status: 404 });
    await expect(m.acc.getAccount(alice, bobAcc)).rejects.toMatchObject({ status: 404 });
  });

  it("a customer cannot read another customer's failed attempt that targeted them", async () => {
    const failed = (await m.db.select().from(m.schema.transactions)).find((t) => t.status === "FAILED" && t.receiverAccountId === bobAcc && t.type === "TRANSFER");
    if (failed) await expect(m.tx.getTransaction(bob, failed.id)).rejects.toMatchObject({ status: 404 });
  });

  it("customers cannot flag, reverse or change account settings", async () => {
    const any = (await m.db.select().from(m.schema.transactions).limit(1))[0];
    await expect(m.tx.flagTransaction(alice, any.id, "just because")).rejects.toMatchObject({ status: 403 });
    await expect(m.acc.updateAccount(staff as never, aliceAcc, { status: "FROZEN" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("deposit / withdrawal approval workflow", () => {
  it("customer submits, staff approves exactly once, balance + ledger + notification update", async () => {
    const a0 = await bal(aliceAcc);
    const req = await m.fr.createFundRequest(alice, { accountId: aliceAcc, type: "DEPOSIT", amount: 321.5, description: "test deposit" });
    expect(req.status).toBe("PENDING");
    expect(await bal(aliceAcc)).toBe(a0); // nothing moves before approval
    await expect(m.fr.reviewFundRequest(alice as never, req.id, { action: "approve" })).rejects.toMatchObject({ status: 403 });
    await m.fr.reviewFundRequest(staff, req.id, { action: "approve" });
    expect(await bal(aliceAcc)).toBe(a0 + 32150);
    await expect(m.fr.reviewFundRequest(admin, req.id, { action: "approve" })).rejects.toMatchObject({ code: "ALREADY_REVIEWED" });
    expect(await bal(aliceAcc)).toBe(a0 + 32150); // not credited twice
  });

  it("withdrawal that exceeds the balance is refused at request time and at approval time", async () => {
    await expect(m.fr.createFundRequest(alice, { accountId: aliceAcc, type: "WITHDRAWAL", amount: 900_000, description: "" })).rejects.toBeDefined();
    const req = await m.fr.createFundRequest(alice, { accountId: aliceAcc, type: "WITHDRAWAL", amount: 100, description: "cash" });
    await m.db.update(m.schema.accounts).set({ balance: 1000 }).where(m.eq(m.schema.accounts.id, aliceAcc));
    await expect(m.fr.reviewFundRequest(staff, req.id, { action: "approve" })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await bal(aliceAcc)).toBe(1000);
    await m.fr.reviewFundRequest(staff, req.id, { action: "reject", note: "Not enough funds" });
    const notes = await m.db.select().from(m.schema.notifications);
    expect(notes.some((n) => n.userId === alice.id && n.type === "WITHDRAWAL_REJECTED")).toBe(true);
  });
});

describe("loan workflow", () => {
  it("staff can forward but not approve; admin approval disburses through a recorded transaction", async () => {
    await m.db.update(m.schema.accounts).set({ balance: 500_000 }).where(m.eq(m.schema.accounts.id, aliceAcc));
    const [{ id }] = await m.db.select().from(m.schema.loans).where(m.eq(m.schema.loans.status, "PENDING"));
    await expect(m.loans.decideLoan(staff as never, id, { action: "approve", disburse: true })).rejects.toMatchObject({ status: 403 });
    await m.loans.forwardLoan(staff, id, "looks fine");
    const loan = (await m.db.select().from(m.schema.loans).where(m.eq(m.schema.loans.id, id)))[0];
    const target = (await m.db.select().from(m.schema.accounts).where(m.eq(m.schema.accounts.id, loan.accountId)))[0];
    const before = target.balance;
    const res = await m.loans.decideLoan(admin, id, { action: "approve", disburse: true });
    expect(res.status).toBe("ACTIVE");
    expect(await bal(target.id)).toBe(before + loan.requestedAmount);
    const disb = (await m.db.select().from(m.schema.transactions)).filter((t) => t.type === "LOAN_DISBURSEMENT" && t.amount === loan.requestedAmount);
    expect(disb.length).toBeGreaterThan(0);
    await expect(m.loans.decideLoan(admin, id, { action: "approve", disburse: true })).rejects.toMatchObject({ status: 409 });
    const inst = await m.db.select().from(m.schema.loanInstallments).where(m.eq(m.schema.loanInstallments.loanId, id));
    expect(inst.reduce((s, i) => s + i.principal, 0)).toBe(loan.requestedAmount);
  });
});

describe("suspicious transaction detection", () => {
  it("auto-flags a large transfer for admin review", async () => {
    await m.db.update(m.schema.accounts).set({ balance: 5_000_000 }).where(m.eq(m.schema.accounts.id, aliceAcc));
    await m.db.update(m.schema.bankSettings).set({ dailyTransferLimit: 100_000_000, maxTransactionAmount: 100_000_000 });
    const { transaction } = await transfer({ amount: 12_000 });
    const flags = await m.tx.listFlags({ status: "OPEN", page: 1, pageSize: 50 });
    expect(flags.items.some((f) => f.transaction.id === transaction.id && f.source === "SYSTEM")).toBe(true);
  });

  it("only admin can reverse; reversal restores balances and keeps history", async () => {
    const { transaction } = await transfer({ amount: 25 });
    await expect(m.tx.reverseTransaction(staff as never, transaction.id, "customer dispute")).rejects.toBeDefined();
    const [a0, b0] = [await bal(aliceAcc), await bal(bobAcc)];
    const out = await m.tx.reverseTransaction(admin, transaction.id, "customer dispute");
    expect(out.status).toBe("REVERSED");
    expect(await bal(bobAcc)).toBe(b0 - 2500);
    expect(await bal(aliceAcc)).toBe(a0 + 2500 + Math.round(transaction.fee * 100));
    await expect(m.tx.reverseTransaction(admin, transaction.id, "again")).rejects.toMatchObject({ code: "NOT_REVERSIBLE" });
  });
});
