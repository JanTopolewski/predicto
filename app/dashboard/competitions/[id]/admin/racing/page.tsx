"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function RacingAdminPage() {
    const t = useTranslations("racing.admin");
    const tCommon = useTranslations("common");
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const competitionId = params.id as string;

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, status, router]);

    if (status === "loading" || session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                        🏎️ {t("title")}
                    </h1>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                        {t("subtitle")}
                    </p>
                </div>
                <Link
                    href={`/dashboard/competitions/${competitionId}`}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                    {tCommon("back")}
                </Link>
            </div>

            {/* Admin Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manage Weekends */}
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow"
                >
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                        📅 {t("manageWeekends")}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                        {t("manageWeekendsDesc")}
                    </p>
                    <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded">
                        {t("open")}
                    </span>
                </Link>

                {/* Manage Sessions */}
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow"
                >
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                        ⏱️ {t("manageSessions")}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                        {t("manageSessionsDesc")}
                    </p>
                    <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded">
                        {t("open")}
                    </span>
                </Link>

                {/* Announce Season Winner */}
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/season-winner`}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow"
                >
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                        🏆 {t("announceChampion")}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                        {t("announceChampionDesc")}
                    </p>
                    <span className="inline-block px-4 py-2 bg-green-600 text-white text-sm font-medium rounded">
                        {t("open")}
                    </span>
                </Link>
            </div>
        </div>
    );
}