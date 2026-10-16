"use client";

import { useTransition } from "react";
import { LOCALE_COOKIE, Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
    currentLocale: Locale;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
    const [isPending, startTransition] = useTransition();

    const switchLocale = (newLocale: Locale) => {
        if (newLocale === currentLocale) return;

        // Set cookie for 1 year
        const maxAge = 60 * 60 * 24 * 365;
        document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=${maxAge}; SameSite=Lax`;

        startTransition(() => {
            window.location.reload();
        });
    };

    return (
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 text-xs font-semibold">
            <button
                type="button"
                onClick={() => switchLocale("en")}
                disabled={isPending}
                className={`px-2 py-1 rounded transition-colors ${
                    currentLocale === "en"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
                title="Switch to English"
            >
                EN
            </button>
            <button
                type="button"
                onClick={() => switchLocale("pl")}
                disabled={isPending}
                className={`px-2 py-1 rounded transition-colors ${
                    currentLocale === "pl"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
                title="Przełącz na polski"
            >
                PL
            </button>
        </div>
    );
}

