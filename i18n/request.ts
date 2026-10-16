import fs from "node:fs";
import path from "node:path";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, locales, LOCALE_COOKIE, type Locale } from "./config";

type Messages = Record<string, unknown>;

function deepMerge(target: Messages, source: Messages): Messages {
    for (const [key, value] of Object.entries(source)) {
        const existing = target[key];
        if (value && typeof value === "object" && existing && typeof existing === "object") {
            deepMerge(existing as Messages, value as Messages);
        } else {
            target[key] = value;
        }
    }
    return target;
}

/** Loads and deep-merges every messages/<locale>/*.json file (split per area). */
function loadMessages(locale: Locale): Messages {
    const dir = path.join(process.cwd(), "messages", locale);
    const merged: Messages = {};
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
        deepMerge(merged, JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
    }
    return merged;
}

function detectLocale(cookieLocale: string | undefined, acceptLanguage: string): Locale {
    if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
        return cookieLocale as Locale;
    }
    // Pick the first language in Accept-Language we support; otherwise default (English).
    for (const part of acceptLanguage.split(",")) {
        const lang = part.split(";")[0].trim().toLowerCase().split("-")[0];
        if ((locales as readonly string[]).includes(lang)) return lang as Locale;
    }
    return defaultLocale;
}

export default getRequestConfig(async () => {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const locale = detectLocale(
        cookieStore.get(LOCALE_COOKIE)?.value,
        headerStore.get("accept-language") ?? ""
    );

    // English is the base; missing Polish keys fall back to English.
    const messages =
        locale === defaultLocale
            ? loadMessages(defaultLocale)
            : deepMerge(loadMessages(defaultLocale), loadMessages(locale));

    return { locale, messages };
});
