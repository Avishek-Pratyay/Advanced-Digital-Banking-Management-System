export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST", details?: unknown) => new AppError(400, code, message, details);
export const unauthorized = (message = "Please sign in to continue") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You do not have permission to perform this action") => new AppError(403, "FORBIDDEN", message);
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (message: string, code = "CONFLICT") => new AppError(409, code, message);
export const unprocessable = (message: string, code = "BUSINESS_RULE_VIOLATION", details?: unknown) => new AppError(422, code, message, details);
export const tooMany = (message: string) => new AppError(429, "TOO_MANY_ATTEMPTS", message);
