import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { LoanStatus, LoanType } from "@/lib/constants";

type State = { statusFilter: LoanStatus | ""; search: string; page: number; calculator: { type: LoanType; amount: number; months: number } };
const slice = createSlice({
  name: "loans",
  initialState: { statusFilter: "", search: "", page: 1, calculator: { type: "PERSONAL", amount: 5000, months: 24 } } as State,
  reducers: {
    setLoanFilter(state, { payload }: PayloadAction<Partial<Pick<State, "statusFilter" | "search" | "page">>>) {
      Object.assign(state, payload);
      if (payload.page === undefined) state.page = 1;
    },
    setCalculator(state, { payload }: PayloadAction<Partial<State["calculator"]>>) {
      state.calculator = { ...state.calculator, ...payload };
    },
  },
});
export const { setLoanFilter, setCalculator } = slice.actions;
export default slice.reducer;
