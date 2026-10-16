"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { TrophyIcon, CheckIcon, AlertTriangleIcon } from "@/components/Icons";

interface Driver {
    id: string;
    name: string;
    number: number;
    team: string;
}

export default function RacingSeasonWinnerPage() {
    const t = useTranslations("racing.admin.seasonWinner");
    const tCommon = useTranslations("common");
    const apiError = useApiError();
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const competitionId = params.id as string;

    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isAnnouncing, setIsAnnouncing] = useState(false);

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, status, router]);

    useEffect(() => {
        const fetchDrivers = async () => {
            try {
                setLoading(true);
                const response = await fetch("/api/drivers");
                if (response.ok) {
                    const data = await response.json();
                    setDrivers(data.drivers || []);
                } else {
                    const data = await response.json().catch(() => null);
                    setError(apiError(data) || t("loadDriversError"));
                }
            } catch (err) {
                console.error(err);
                setError(t("loadDriversError"));
            } finally {
                setLoading(false);
            }
        };

        void fetchDrivers();
    }, [apiError, t]);

    const handleAnnounceWinner = async () => {
        if (!selectedDriverId) {
            setError(t("selectDriverError"));
            return;
        }

        setIsAnnouncing(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/season-winner/announce`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ driverId: selectedDriverId }),
                }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                setIsAnnouncing(false);
                return;
            }

            const data = await response.json();
            setSuccess(
                t("announcedSuccess", {
                    driverName: data.driverName,
                    playersRewarded: data.playersRewarded,
                    pointsAwarded: data.pointsAwarded,
                })
            );
            setSelectedDriverId("");
            setTimeout(() => {
                router.push(`/dashboard/competitions/${competitionId}`);
            }, 2000);
        } catch (err) {
            console.error(err);
            setError(apiError());
        } finally {
            setIsAnnouncing(false);
        }
    };

    if (status === "loading" || session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <TrophyIcon className="w-7 h-7 text-amber-500" />
                        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                            {t("title")}
                        </h1>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                        {t("subtitle")}
                    </p>
                </div>
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing`}
                    className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-sm"
                >
                    {tCommon("back")}
                </Link>
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                    <AlertTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {success && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                    <CheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {success}
                    </p>
                </div>
            )}

            {/* Announce Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                {loading ? (
                    <div className="p-8 text-center">
                        <p className="text-zinc-600 dark:text-zinc-400">
                            {tCommon("loading")}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6 max-w-xl">
                        <div>
                            <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">
                                {t("selectDriverLabel")}
                            </label>
                            <select
                                value={selectedDriverId}
                                onChange={(e) => setSelectedDriverId(e.target.value)}
                                disabled={isAnnouncing}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">{t("selectPlaceholder")}</option>
                                {drivers.map((driver) => (
                                    <option key={driver.id} value={driver.id}>
                                        #{driver.number} {driver.name} ({driver.team})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handleAnnounceWinner}
                            disabled={isAnnouncing || !selectedDriverId}
                            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isAnnouncing ? t("submitting") : t("submitButton")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}