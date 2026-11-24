import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";

export type Toast = { id: string; kind: "success" | "error" | "info"; title: string; message?: string };
type State = {
  theme: "light" | "dark" | "system";
  sidebarOpen: boolean; // mobile drawer
  pendingRequests: number; // centralised loading counter - fed by the RTK Query middleware
  toasts: Toast[];
  lastError: { message: string; code?: string } | null; // centralised error state
};

const slice = createSlice({
  name: "ui",
  initialState: { theme: "system", sidebarOpen: false, pendingRequests: 0, toasts: [], lastError: null } as State,
  reducers: {
    setTheme(state, { payload }: PayloadAction<State["theme"]>) {
      state.theme = payload;
    },
    toggleSidebar(state, { payload }: PayloadAction<boolean | undefined>) {
      state.sidebarOpen = payload ?? !state.sidebarOpen;
    },
    requestStarted(state) {
      state.pendingRequests += 1;
    },
    requestFinished(state) {
      state.pendingRequests = Math.max(0, state.pendingRequests - 1);
    },
    pushToast: {
      reducer(state, { payload }: PayloadAction<Toast>) {
        state.toasts.push(payload);
        if (state.toasts.length > 4) state.toasts.shift();
      },
      prepare: (t: Omit<Toast, "id">) => ({ payload: { ...t, id: nanoid() } }),
    },
    dismissToast(state, { payload }: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== payload);
    },
    setError(state, { payload }: PayloadAction<State["lastError"]>) {
      state.lastError = payload;
    },
  },
});
export const { setTheme, toggleSidebar, requestStarted, requestFinished, pushToast, dismissToast, setError } = slice.actions;
export default slice.reducer;
