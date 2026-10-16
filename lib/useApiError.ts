"use client";

import { useTranslations } from "next-intl";

interface ApiErrorBody {
    error?: string;
    code?: string;
    params?: Record<string, string | number>;
}

/**
 * Returns a function turning an API error response body into a localized message.
 * Order:
 * 1. translation of `code` via `apiErrors.<code>` (interpolating `params` if provided)
 * 2. English `error` returned by the server
 * 3. English generic fallback from `apiErrors.INTERNAL_ERROR`
 */
export function useApiError() {
    const t = useTranslations("apiErrors");
    return (body: ApiErrorBody | null | undefined): string => {
        if (body?.code && t.has(body.code)) {
            return t(body.code, body.params ?? {});
        }
        return body?.error || t("INTERNAL_ERROR");
    };
}
