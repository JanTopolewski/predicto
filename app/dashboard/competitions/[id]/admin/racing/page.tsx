"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarIcon, ClockIcon, TrophyIcon, FlagIcon } from "@/components/Icons";

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
                    <div className="flex items-center gap-2">
                        <FlagIcon className="w-7 h-7 text-zinc-900 dark:text-white" />
                        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                            {t("title")}
                        </h1>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                        {t("subtitle")}
                    </p>
                </div>
                <Link
                    href={`/dashboard/competitions/${competitionId}`}
                    className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-sm"
                >
                    {tCommon("back")}
                </Link>
            </div>

            {/* Admin Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manage Weekends */}
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
                >
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                {t("manageWeekends")}
                            </h3>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                            {t("manageWeekendsDesc")}
                        </p>
                    </div>
                    <span className="self-start px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors">
                        {t("open")}
                    </span>
                </Link>

                {/* Manage Sessions */}
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
                >
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                {t("manageSessions")}
                            </h3>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                            {t("manageSessionsDesc")}
                        </p>
                    </div>
                    <span className="self-start px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors">
                        {t("open")}
                    </span>
                </Link>

                {/* Announce Season Winner */}
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/season-winner`}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
                >
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <TrophyIcon className="w-5 h-5 text-amber-500" />
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                {t("announceChampion")}
                            </h3>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                            {t("announceChampionDesc")}
                        </p>
                    </div>
                    <span className="self-start px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors">
                        {t("open")}
                    </span>
                </Link>
            </div>
        </div>
    );
}