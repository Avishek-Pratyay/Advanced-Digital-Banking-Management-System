import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TxnType, TxnStatus } from "@/lib/constants";

export type TxnFilters = { q: string; type: TxnType | ""; status: TxnStatus | ""; from: string; to: string; accountId: string; flagged: "" | "true"; page: number; pageSize: number };
export const defaultTxnFilters: TxnFilters = { q: "", type: "", status: "", from: "", to: "", accountId: "", flagged: "", page: 1, pageSize: 10 };

/** Filter + pagination state for transaction tables (shared by customer, staff and admin views). */
const slice = createSlice({
  name: "transactions",
  initialState: { filters: defaultTxnFilters, selectedId: null as string | null },
  reducers: {
    setTxnFilters(state, { payload }: PayloadAction<Partial<TxnFilters>>) {
      state.filters = { ...state.filters, ...payload, page: payload.page ?? 1 }; // any filter change returns to page 1
    },
    resetTxnFilters(state) {
      state.filters = defaultTxnFilters;
    },
    openTransaction(state, { payload }: PayloadAction<string | null>) {
      state.selectedId = payload;
    },
  },
});
export const { setTxnFilters, resetTxnFilters, openTransaction } = slice.actions;
export default slice.reducer;
