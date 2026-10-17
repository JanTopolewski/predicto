"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { CheckIcon, TargetIcon, AlertTriangleIcon } from "@/components/Icons";

interface Driver {
    id: string;
    name: string;
    number: number;
    team: string;
}

interface RacingSessionParticipant {
    driver: Driver;
}

interface Wildcard {
    driver: Driver;
}

interface RacingSession {
    id: string;
    type: string;
    name: string;
    startTime: string;
    resolved: boolean;
    votingClosedAt?: string | null; 
    participants: RacingSessionParticipant[];
    predictions: any[];
    wildcards: Wildcard[];
}

interface RacingWeekend {
    id: string;
    grandPrix: string;
    country: string;
    raceDate: string;
    sessions: RacingSession[];
}

const PODIUM_SESSIONS = ["SPRINT", "RACE"];

export default function RacingPage() {
    const t = useTranslations("racing");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const apiError = useApiError();
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const competitionId = params.id as string;

    const [weekends, setWeekends] = useState<RacingWeekend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [currentPrediction, setCurrentPrediction] = useState<{
        sessionId: string;
        firstDriver: string;
        secondDriver: string;
        thirdDriver: string;
        wildcardPosition: number | null;
    } | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
        }
    }, [status, router]);

    const fetchWeekends = React.useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/weekends`
            );
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data) || t("loadError"));
                return;
            }
            const data = await response.json();
            setWeekends(data.weekends || []);
        } catch (err) {
            console.error(err);
            setError(t("loadError"));
        } finally {
            setLoading(false);
        }
    }, [competitionId, apiError, t]);

    useEffect(() => {
        void fetchWeekends();
    }, [fetchWeekends]);

    const handleSubmitPrediction = async (
        sessionId: string,
        sessionType: string,
    ) => {
        if (!currentPrediction || currentPrediction.sessionId !== sessionId) {
            setError(t("validationRequired"));
            return;
        }

        const isPodiumSession = PODIUM_SESSIONS.includes(sessionType);

        if (
            isPodiumSession &&
            (!currentPrediction.firstDriver ||
                !currentPrediction.secondDriver ||
                !currentPrediction.thirdDriver)
        ) {
            setError(t("validationPodium"));
            return;
        }

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/sessions/${sessionId}/predictions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        firstDriver: isPodiumSession && currentPrediction.firstDriver
                            ? currentPrediction.firstDriver
                            : null,
                        secondDriver: isPodiumSession && currentPrediction.secondDriver
                            ? currentPrediction.secondDriver
                            : null,
                        thirdDriver: isPodiumSession && currentPrediction.thirdDriver
                            ? currentPrediction.thirdDriver
                            : null,
                        wildcardPosition: currentPrediction.wildcardPosition,
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                return;
            }

            setSuccess(t("predictionSaved"));
            setCurrentPrediction(null);
            await fetchWeekends();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            console.error(err);
            setError(apiError());
        }
    };

    if (status !== "authenticated" || !session?.user?.id) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {t("title")}
                </h1>
                <Link
                    href={`/dashboard/competitions/${competitionId}`}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
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

            {/* Content */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {tCommon("loading")}
                    </p>
                </div>
            ) : weekends.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {t("noWeekends")}
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {weekends.map((weekend) => (
                        <div
                            key={weekend.id}
                            className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800"
                        >
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                                {weekend.grandPrix}
                            </h2>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                                {weekend.country} •{" "}
                                {new Date(weekend.raceDate).toLocaleDateString(locale, { timeZone: "Europe/Warsaw" })}
                            </p>

                            <div className="space-y-6">
                                {weekend.sessions.map((racingSession) => {
                                    const existingVote = racingSession.predictions?.[0];
                                    const isPodiumSession =
                                        PODIUM_SESSIONS.includes(
                                            racingSession.type
                                        );
                                    const isStarted = new Date(racingSession.startTime) < new Date();

                                    return (
                                        <div
                                            key={racingSession.id}
                                            className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-4"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                                        {racingSession.name}
                                                    </h3>
                                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                        {new Date(
                                                            racingSession.startTime
                                                        ).toLocaleString(locale, { timeZone: "Europe/Warsaw" })}
                                                    </p>
                                                </div>
                                                {isStarted && (
                                                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs font-semibold rounded-full">
                                                        {t("sessionStarted")}
                                                    </span>
                                                )}
                                            </div>

                                            {existingVote ? (
                                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <CheckIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-300 flex-shrink-0" />
                                                            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wide">
                                                                {t("yourVote")}
                                                            </p>
                                                        </div>
                                                        {racingSession.resolved && (
                                                            <span className="inline-flex items-center justify-center text-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 whitespace-nowrap leading-normal">
                                                                {t("pointsEarned", { points: existingVote.points || 0 })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-zinc-800 dark:text-zinc-200 space-y-3">
                                                        {isPodiumSession && (
                                                            <div className="grid grid-cols-3 gap-2 items-end pt-1">
                                                                {[
                                                                    { pos: 2, driverId: existingVote.secondDriverId, bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-300 dark:border-slate-600", badgeBg: "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100", podiumStep: "h-6 bg-slate-200 dark:bg-slate-700" },
                                                                    { pos: 1, driverId: existingVote.firstDriverId, bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-300 dark:border-amber-600/70", badgeBg: "bg-amber-400 text-amber-950 font-bold", podiumStep: "h-10 bg-amber-200 dark:bg-amber-900/60" },
                                                                    { pos: 3, driverId: existingVote.thirdDriverId, bg: "bg-amber-900/5 dark:bg-amber-950/20", border: "border-amber-700/30 dark:border-amber-700/50", badgeBg: "bg-amber-700 text-amber-100", podiumStep: "h-4 bg-amber-800/20 dark:bg-amber-900/40" },
                                                                ].map((step) => {
                                                                    const driver = racingSession.participants.find(p => p.driver.id === step.driverId)?.driver;
                                                                    return (
                                                                        <div key={`existing-podium-${step.pos}`} className={`flex flex-col justify-end rounded-lg border ${step.border} ${step.bg} overflow-hidden text-center`}>
                                                                            <div className="p-2 flex flex-col items-center">
                                                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${step.badgeBg}`}>
                                                                                    {step.pos}
                                                                                </div>
                                                                                <span className="text-xs font-semibold text-zinc-900 dark:text-white text-clip overflow-hidden max-w-full">
                                                                                    {driver ? driver.name : "—"}
                                                                                </span>
                                                                                {driver && (
                                                                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 text-clip overflow-hidden max-w-full">
                                                                                        #{driver.number} {driver.team}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className={`${step.podiumStep} flex items-center justify-center text-[11px] font-extrabold text-zinc-700 dark:text-zinc-300`}>
                                                                                P{step.pos}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                        {existingVote.wildcardPosition && (
                                                            <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 font-semibold mt-1">
                                                                <TargetIcon className="w-3.5 h-3.5" />
                                                                <span>{t("wildcardPredicted", { pos: existingVote.wildcardPosition })}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : !isStarted && !racingSession.resolved && !racingSession.votingClosedAt ? (
                                                <div className="space-y-3">
                                                    {isPodiumSession && (
                                                        <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/80">
                                                            <div className="mb-3">
                                                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                                                    {t("selectPodium")}
                                                                </p>
                                                            </div>

                                                            {/* Visual Realistic Podium: P2 (left, medium), P1 (center, highest), P3 (right, lower) */}
                                                            <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end pt-2">
                                                                {[
                                                                    { pos: 2, bg: "bg-slate-100 dark:bg-slate-800/80", border: "border-slate-300 dark:border-slate-600", badgeBg: "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-500", podiumStep: "h-14 sm:h-18 bg-gradient-to-t from-slate-300 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-t-2 border-slate-400 dark:border-slate-500" },
                                                                    { pos: 1, bg: "bg-amber-50/70 dark:bg-amber-950/20", border: "border-amber-300 dark:border-amber-600/60 shadow-sm", badgeBg: "bg-amber-400 text-amber-950 border-amber-300 font-black ring-2 ring-amber-300/40", podiumStep: "h-22 sm:h-26 bg-gradient-to-t from-amber-300 to-amber-200 dark:from-amber-900/60 dark:to-amber-800/60 border-t-2 border-amber-400 dark:border-amber-500" },
                                                                    { pos: 3, bg: "bg-amber-900/5 dark:bg-amber-950/10", border: "border-amber-700/30 dark:border-amber-700/40", badgeBg: "bg-amber-700 text-amber-100 border-amber-800", podiumStep: "h-10 sm:h-12 bg-gradient-to-t from-amber-700/30 to-amber-600/20 dark:from-amber-950/50 dark:to-amber-900/40 border-t-2 border-amber-600/40 dark:border-amber-700/50" },
                                                                ].map((step) => {
                                                                    const pos = step.pos;
                                                                    const field = pos === 1 ? "firstDriver" : pos === 2 ? "secondDriver" : "thirdDriver";
                                                                    const selectedVal = currentPrediction?.sessionId === racingSession.id
                                                                        ? (currentPrediction as any)[field] || ""
                                                                        : "";

                                                                    return (
                                                                        <div
                                                                            key={`podium-slot-${pos}`}
                                                                            className={`flex flex-col justify-end rounded-xl border ${step.border} ${step.bg} overflow-hidden transition-all`}
                                                                        >
                                                                            {/* Driver select & badge */}
                                                                            <div className="p-2 sm:p-2.5 flex flex-col items-center text-center space-y-1.5 flex-1 justify-center">
                                                                                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs border shadow-xs ${step.badgeBg}`}>
                                                                                    {pos}
                                                                                </div>
                                                                                <span className="text-[10px] sm:text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                                                                    {t("positionLabel", { pos })}
                                                                                </span>
                                                                                <select
                                                                                    value={selectedVal}
                                                                                    onChange={(e) => {
                                                                                        setCurrentPrediction((prev) =>
                                                                                            prev && prev.sessionId === racingSession.id
                                                                                                ? {
                                                                                                    ...prev,
                                                                                                    [field]: e.target.value,
                                                                                                }
                                                                                                : {
                                                                                                    sessionId: racingSession.id,
                                                                                                    firstDriver: field === "firstDriver" ? e.target.value : "",
                                                                                                    secondDriver: field === "secondDriver" ? e.target.value : "",
                                                                                                    thirdDriver: field === "thirdDriver" ? e.target.value : "",
                                                                                                    wildcardPosition: null,
                                                                                                }
                                                                                        );
                                                                                    }}
                                                                                    className="w-full text-[11px] sm:text-xs px-1 sm:px-1.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-clip overflow-hidden focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
                                                                                >
                                                                                    <option value="">{t("selectDriver")}</option>
                                                                                    {racingSession.participants.map((p) => (
                                                                                        <option key={p.driver.id} value={p.driver.id}>
                                                                                            #{p.driver.number} {p.driver.name}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>

                                                                            {/* Pedestal Step Base */}
                                                                            <div className={`${step.podiumStep} flex items-center justify-center`}>
                                                                                <span className="text-sm sm:text-lg font-black tracking-tighter opacity-60 text-zinc-800 dark:text-zinc-200">
                                                                                    P{pos}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {racingSession.wildcards && racingSession.wildcards.length > 0 && (
                                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                                            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-3">
                                                                {t("wildcardDriver")}
                                                            </p>
                                                            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg mb-3">
                                                                <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                                                                    #{racingSession.wildcards[0].driver.number} {racingSession.wildcards[0].driver.name}
                                                                </p>
                                                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                                                    {racingSession.wildcards[0].driver.team}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                                                                    {t("wildcardFinishing")}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max={racingSession.participants.length}
                                                                    placeholder={t("wildcardPlaceholder", { max: racingSession.participants.length })}
                                                                    value={
                                                                        currentPrediction?.sessionId === racingSession.id && currentPrediction.wildcardPosition
                                                                            ? currentPrediction.wildcardPosition
                                                                            : ""
                                                                    }
                                                                    onChange={(e) => {
                                                                        const pos = e.target.value ? parseInt(e.target.value) : null;
                                                                        setCurrentPrediction((prev) =>
                                                                            prev && prev.sessionId === racingSession.id
                                                                                ? { ...prev, wildcardPosition: pos }
                                                                                : {
                                                                                    sessionId: racingSession.id,
                                                                                    firstDriver: "",
                                                                                    secondDriver: "",
                                                                                    thirdDriver: "",
                                                                                    wildcardPosition: pos,
                                                                                }
                                                                        );
                                                                    }}
                                                                    className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() =>
                                                            handleSubmitPrediction(
                                                                racingSession.id,
                                                                racingSession.type
                                                            )
                                                        }
                                                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                                                    >
                                                        {t("submitPrediction")}
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {racingSession.resolved
                                                        ? t("sessionResolved")
                                                        : t("sessionInProgress")}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}