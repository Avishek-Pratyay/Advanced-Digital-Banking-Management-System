import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Role } from "@/lib/constants";

/** Authentication state mirrored from the NextAuth session; the server remains the source of truth. */
export type AuthUser = { id: string; name: string; email: string; role: Role };
type AuthState = { user: AuthUser | null; status: "loading" | "authenticated" | "unauthenticated" };

const slice = createSlice({
  name: "auth",
  initialState: { user: null, status: "loading" } as AuthState,
  reducers: {
    sessionLoaded(state, { payload }: PayloadAction<AuthUser | null>) {
      state.user = payload;
      state.status = payload ? "authenticated" : "unauthenticated";
    },
    sessionLoading(state) {
      state.status = "loading";
    },
  },
});

export const { sessionLoaded, sessionLoading } = slice.actions;
export default slice.reducer;
