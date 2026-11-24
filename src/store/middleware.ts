import { isFulfilled, isPending, isRejected, isRejectedWithValue, type Middleware } from "@reduxjs/toolkit";
import type { ApiError } from "./api";
import { pushToast, requestFinished, requestStarted, setError } from "./slices/uiSlice";

/** Mutations whose errors are rendered inline by their form (so no duplicate toast). */
const INLINE_ERROR_CODES = new Set(["VALIDATION_ERROR", "INVALID_PIN", "TWO_FACTOR_REQUIRED", "TWO_FACTOR_INVALID", "INVALID_PASSWORD"]);

/**
 * Centralised loading + error handling for every RTK Query call:
 *  - pending/settled actions drive ui.pendingRequests (global progress bar)
 *  - failed requests populate ui.lastError and raise a toast (queries and mutations)
 */
export const requestStatusMiddleware: Middleware = (store) => (next) => (action) => {
  const a = action as { type?: string; meta?: { arg?: { type?: string; endpointName?: string }; condition?: boolean } };
  const isApi = a.type?.startsWith("api/executeQuery") || a.type?.startsWith("api/executeMutation");
  if (isApi) {
    if (isPending(action)) store.dispatch(requestStarted());
    else if (isFulfilled(action) || isRejected(action)) {
      if (!(isRejected(action) && a.meta?.condition)) store.dispatch(requestFinished());
    }
    if (isRejectedWithValue(action)) {
      const err = (action as unknown as { payload: ApiError }).payload;
      if (err && err.status !== 401) {
        store.dispatch(setError({ message: err.message, code: err.code }));
        const isMutation = a.type?.startsWith("api/executeMutation");
        if (!(isMutation && INLINE_ERROR_CODES.has(err.code))) store.dispatch(pushToast({ kind: "error", title: isMutation ? "Action failed" : "Could not load data", message: err.message }));
      }
    }
  }
  return next(action);
};
