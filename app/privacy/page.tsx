import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("legal.privacy");
  return {
    title: `${t("title")} - Predicto`,
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");
  const tCommon = await getTranslations("common");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 sm:p-10 shadow-sm">
        <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6 mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← {tCommon("back")}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            {t("lastUpdated")}
          </p>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-8 leading-relaxed">
          {t("intro")}
        </p>

        <div className="space-y-8">
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              {t("sections.admin.title")}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t("sections.admin.content")}
            </p>
          </section>

          <section>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              {t("sections.dataScope.title")}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t("sections.dataScope.content")}
            </p>
          </section>

          <section>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              {t("sections.cookies.title")}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t("sections.cookies.content")}
            </p>
          </section>

          <section>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              {t("sections.rights.title")}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t("sections.rights.content")}
            </p>
          </section>

          <section>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              {t("sections.security.title")}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t("sections.security.content")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
