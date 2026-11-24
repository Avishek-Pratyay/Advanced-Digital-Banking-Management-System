import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiError } from "@/store/api";

export const isApiError = (e: unknown): e is ApiError => typeof e === "object" && e !== null && "message" in e && "status" in e;

/** Unwraps an RTK Query mutation error (payload is our normalised ApiError). */
export function toApiError(e: unknown): ApiError {
  if (isApiError(e)) return e;
  return { status: 0, code: "ERROR", message: "Something went wrong. Please try again." };
}

/** Maps server-side validation details back onto react-hook-form fields. Returns the message to show for the form itself. */
export function applyServerErrors<T extends FieldValues>(err: ApiError, setError: UseFormSetError<T>, known: string[]): string | null {
  let mapped = false;
  if (err.details && typeof err.details === "object") {
    for (const [k, msg] of Object.entries(err.details)) {
      if (known.includes(k)) {
        setError(k as Path<T>, { type: "server", message: String(msg) });
        mapped = true;
      }
    }
  }
  return mapped ? null : err.message;
}

export const newIdempotencyKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import type { ZodTypeAny, z } from "zod";

/** Typed zod resolver that keeps separate input (raw form strings) and output (parsed numbers/defaults) types. */
export const zodForm = <S extends ZodTypeAny>(schema: S) => zodResolver(schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>>;
