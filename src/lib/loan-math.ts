/** Pure amortisation maths (integer cents) shared by the server and the loan calculator UI. */
export type ScheduleRow = { number: number; dueDate: string; principal: number; interest: number; amount: number };

export function calcEmi(principalCents: number, interestBps: number, months: number): number {
  const r = interestBps / 10000 / 12;
  if (r === 0) return Math.round(principalCents / months);
  const f = Math.pow(1 + r, months);
  return Math.round((principalCents * r * f) / (f - 1));
}

function addMonths(base: Date, n: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(base.getUTCDate(), lastDay));
  return d.toISOString().slice(0, 10);
}

/** Reducing-balance schedule. The final instalment absorbs rounding so principal sums exactly to the loan. */
export function buildSchedule(principalCents: number, interestBps: number, months: number, start: Date): ScheduleRow[] {
  const r = interestBps / 10000 / 12;
  const emi = calcEmi(principalCents, interestBps, months);
  const rows: ScheduleRow[] = [];
  let balance = principalCents;
  for (let i = 1; i <= months; i++) {
    const interest = Math.round(balance * r);
    let principal = i === months ? balance : Math.min(balance, emi - interest);
    if (principal < 0) principal = 0;
    rows.push({ number: i, dueDate: addMonths(start, i), principal, interest, amount: principal + interest });
    balance -= principal;
  }
  return rows;
}

export const totalPayable = (rows: ScheduleRow[]) => rows.reduce((s, r) => s + r.amount, 0);
