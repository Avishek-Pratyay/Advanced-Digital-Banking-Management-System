import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Which account the customer is currently looking at ("all" = combined view). Persisted per browser tab. */
type State = { selectedAccountId: string };
const slice = createSlice({
  name: "account",
  initialState: { selectedAccountId: "all" } as State,
  reducers: {
    selectAccount(state, { payload }: PayloadAction<string>) {
      state.selectedAccountId = payload;
    },
  },
});
export const { selectAccount } = slice.actions;
export default slice.reducer;
