"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { Locale } from "@/i18n/config";
import { AlertTriangleIcon, TargetIcon } from "@/components/Icons";

interface Driver {
    id: string;
    name: string;
    number: number;
    team: string;
}

interface Wildcard {
    driver: Driver;
}

interface SessionInfo {
    id: string;
    weekendId?: string;
    name: string;
    type: string;
    startTime: string;
    resolved: boolean;
    grandPrix: string;
    wildcard: Wildcard | null;
}

interface PredictionData {
    id: string;
    firstDriver: Driver | null;
    secondDriver: Driver | null;
    thirdDriver: Driver | null;
    wildcardDriver: Driver | null;
    wildcardPosition: number | null;
    points: number;
    createdAt: string;
}

interface MemberPredictionItem {
    user: {
        id: string;
        username: string;
    };
    prediction: PredictionData | null;
}

export default function RacingSessionPredictionsPage() {
    const { data: session, status } = useSession();
    const params = useParams();
    const competitionId = params.id as string;
    const sessionId = params.sessionId as string;

    const [racingSession, setRacingSession] = useState<SessionInfo | null>(null);
    const [predictions, setPredictions] = useState<MemberPredictionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const t = useTranslations("racing");
    const tCommon = useTranslations("common");
    const apiError = useApiError();
    const locale = useLocale() as Locale;

    useEffect(() => {
        const fetchPredictions = async () => {
            try {
                setLoading(true);
                setError("");
                const res = await fetch(
                    `/api/competitions/${competitionId}/racing/sessions/${sessionId}/predictions?scope=all`
                );
                const data = await res.json();

                if (!res.ok) {
                    setError(apiError(data));
                    return;
                }

                setRacingSession(data.session);
                setPredictions(data.predictions || []);
            } catch (err) {
                console.error(err);
                setError(apiError());
            } finally {
                setLoading(false);
            }
        };

        if (status === "authenticated") {
            void fetchPredictions();
        }
    }, [competitionId, sessionId, status, apiError]);

    if (status !== "authenticated" || !session?.user?.id) {
        return null;
    }

    const isPodiumSession =
        racingSession && (racingSession.type === "SPRINT" || racingSession.type === "RACE");

    const isAdmin = session?.user?.role === "ADMIN";
    const backHref =
        isAdmin && racingSession?.weekendId
            ? `/dashboard/competitions/${competitionId}/admin/racing/sessions/${racingSession.weekendId}`
            : `/dashboard/competitions/${competitionId}/racing`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                        {t("allPredictionsTitle")}
                    </h1>
                    {racingSession && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {racingSession.grandPrix} • {racingSession.name} ({racingSession.type}) •{" "}
                            {new Date(racingSession.startTime).toLocaleString(locale)}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={backHref}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                        {tCommon("back")}
                    </Link>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                    <AlertTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {tCommon("loading")}
                    </p>
                </div>
            ) : racingSession ? (
                <div className="space-y-6">
                    {/* Wildcard Info Banner */}
                    {racingSession.wildcard && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TargetIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                    {t("wildcardDriver")}
                                </span>
                            </div>
                            <span className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                #{racingSession.wildcard.driver.number} {racingSession.wildcard.driver.name} ({racingSession.wildcard.driver.team})
                            </span>
                        </div>
                    )}

                    {/* Predictions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {predictions.map((item) => {
                            const isCurrentUser = item.user.id === session.user.id;
                            const pred = item.prediction;

                            return (
                                <div
                                    key={item.user.id}
                                    className={`rounded-lg p-4 border flex flex-col justify-between transition-all ${
                                        isCurrentUser
                                            ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800"
                                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-zinc-900 dark:text-white">
                                                    {item.user.username}
                                                </span>
                                                {isCurrentUser && (
                                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                                                        TY
                                                    </span>
                                                )}
                                            </div>
                                            {racingSession.resolved && pred && (
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                                                    {t("pointsEarned", { points: pred.points })}
                                                </span>
                                            )}
                                        </div>

                                        {pred ? (
                                            <div className="space-y-3">
                                                {/* Podium Slots */}
                                                {isPodiumSession && (
                                                    <div className="grid grid-cols-3 gap-1.5 text-center">
                                                        {[
                                                            { pos: 1, label: "P1", driver: pred.firstDriver, bg: "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700" },
                                                            { pos: 2, label: "P2", driver: pred.secondDriver, bg: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700" },
                                                            { pos: 3, label: "P3", driver: pred.thirdDriver, bg: "bg-amber-900/10 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-700/30 dark:border-amber-800/40" },
                                                        ].map((slot) => (
                                                            <div
                                                                key={`pred-podium-${slot.pos}`}
                                                                className={`p-1.5 rounded border ${slot.bg} flex flex-col items-center`}
                                                            >
                                                                <span className="text-[10px] font-extrabold">{slot.label}</span>
                                                                <span className="text-xs font-semibold truncate max-w-full">
                                                                    {slot.driver ? slot.driver.name : "—"}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Wildcard Position */}
                                                {pred.wildcardPosition && (
                                                    <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-center text-xs">
                                                        <span className="text-zinc-600 dark:text-zinc-400">
                                                            {t("wildcardPredicted", { pos: pred.wildcardPosition })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="py-4 text-center bg-zinc-100/60 dark:bg-zinc-800/30 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700">
                                                <span className="text-xs text-zinc-500 italic">
                                                    {t("noPredictionFromUser")}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

