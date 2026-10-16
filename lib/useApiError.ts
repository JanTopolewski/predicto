"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

interface ApiErrorBody {
    error?: string;
    code?: string;
    params?: Record<string, string | number>;
}

/**
 * Returns a stable memoized function turning an API error response body into a localized message.
 * Order:
 * 1. translation of `code` via `apiErrors.<code>` (interpolating `params` if provided)
 * 2. English `error` returned by the server
 * 3. English generic fallback from `apiErrors.INTERNAL_ERROR`
 */
export function useApiError() {
    const t = useTranslations("apiErrors");
    return useCallback((body?: ApiErrorBody | null): string => {
        if (body?.code && t.has(body.code)) {
            return t(body.code, body.params ?? {});
        }
        return body?.error || t("INTERNAL_ERROR");
    }, [t]);
}
