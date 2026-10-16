import { NextResponse } from "next/server";

/**
 * Standard API error response. The backend speaks English only:
 *  - `error`  - human readable English message (for logs / API clients / fallback)
 *  - `code`   - stable UPPER_SNAKE identifier; the frontend translates it via `apiErrors.<code>`
 *  - `params` - optional values interpolated into the translated message (e.g. { max: 20 })
 */
export function apiError(
    status: number,
    code: string,
    error: string,
    params?: Record<string, string | number>
) {
    const payload = {
        error,
        code,
        ...(params ? { params } : {}),
    };
    return NextResponse.json(payload, { status });
}

export const unauthorized = () => apiError(401, "UNAUTHORIZED", "Unauthorized");
export const forbidden = () => apiError(403, "FORBIDDEN", "Forbidden");
export const internalError = () => apiError(500, "INTERNAL_ERROR", "Internal server error");
