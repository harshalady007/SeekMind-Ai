import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiError, ErrorCode } from "@/lib/core/types";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  anonymous_limit_reached: 429,
  daily_limit_reached: 429,
  too_many_concurrent: 429,
  provider_error: 502,
  provider_timeout: 504,
  no_results: 200,
  cancelled: 200,
  config_error: 500,
  internal_error: 500,
};

export function apiError(
  code: ErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  const body: ApiError & Record<string, unknown> = { code, message, ...extra };
  return NextResponse.json({ error: body }, { status: STATUS_BY_CODE[code] });
}

export function zodErrorResponse(error: ZodError): NextResponse {
  const details = error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return apiError("bad_request", `Invalid input: ${details}`);
}

/** Best-effort client IP for rate limiting (proxy-aware, spoofable — documented). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
