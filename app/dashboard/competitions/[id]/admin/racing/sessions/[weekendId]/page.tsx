"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { CheckIcon, LockIcon, ClockIcon, TargetIcon, AlertTriangleIcon } from "@/components/Icons";

interface Driver {
    id: string;
    name: string;
    number: number;
    team: string;
}

interface RacingSession {
    id: string;
    type: string;
    name: string;
    startTime: string;
    resolved: boolean;
    votingClosedAt: string | null;
    participants: { driver: Driver }[];
    results?: { driverId: string; position: number; driver: Driver }[];
    wildcards?: { driver: Driver; driverId: string }[];
}

const SESSION_TYPES = [
    "PRACTICE1",
    "PRACTICE2",
    "PRACTICE3",
    "QUALIFYING",
    "SPRINT_QUALIFYING",
    "SPRINT",
    "RACE",
];

export default function RacingSessionsPage() {
    const t = useTranslations("racing.admin.sessions");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const apiError = useApiError();
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const competitionId = params.id as string;
    const weekendId = params.weekendId as string;

    const [sessions, setSessions] = useState<RacingSession[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [resolvingSessionId, setResolvingSessionId] = useState<string | null>(null);
    const [firstDriverId, setFirstDriverId] = useState("");
    const [secondDriverId, setSecondDriverId] = useState("");
    const [thirdDriverId, setThirdDriverId] = useState("");
    const [wildcardPosition, setWildcardPosition] = useState<string>("");
    const [isSubmittingResults, setIsSubmittingResults] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        type: "PRACTICE1",
        startTime: "",
        selectedDrivers: [] as string[],
        wildcardDriverId: "",
    });

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, status, router]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch drivers
            const driversResponse = await fetch("/api/drivers");
            if (driversResponse.ok) {
                const driversData = await driversResponse.json();
                setDrivers(driversData.drivers || []);
            }

            // Fetch sessions for this specific weekend
            const weekendResponse = await fetch(
                `/api/competitions/${competitionId}/racing/weekends/${weekendId}`
            );
            if (weekendResponse.ok) {
                const weekendData = await weekendResponse.json();
                setSessions(weekendData.weekend?.sessions || []);
            } else {
                const data = await weekendResponse.json().catch(() => null);
                setError(apiError(data) || t("loadError"));
            }
        } catch (err) {
            console.error(err);
            setError(t("loadError"));
        } finally {
            setLoading(false);
        }
    }, [competitionId, weekendId, apiError, t]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const handleToggleDriver = (driverId: string) => {
        setFormData((prev) => ({
            ...prev,
            selectedDrivers: prev.selectedDrivers.includes(driverId)
                ? prev.selectedDrivers.filter((id) => id !== driverId)
                : [...prev.selectedDrivers, driverId],
        }));
    };

    const handleCreateSession = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        const isPodiumType = formData.type === "SPRINT" || formData.type === "RACE";

        if (
            !formData.name ||
            !formData.startTime ||
            formData.selectedDrivers.length === 0
        ) {
            setError(t("fieldsRequiredError"));
            return;
        }

        if (!isPodiumType && !formData.wildcardDriverId) {
            setError(t("wildcardRequiredValidation"));
            return;
        }

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/sessions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        weekendId,
                        type: formData.type,
                        name: formData.name,
                        startTime: formData.startTime,
                        participatingDriverIds: formData.selectedDrivers,
                        wildcardDriverId: formData.wildcardDriverId || null,
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                return;
            }

            const data = await response.json();
            setSessions([...sessions, data.session]);
            setFormData({
                name: "",
                type: "PRACTICE1",
                startTime: "",
                selectedDrivers: [],
                wildcardDriverId: "",
            });
            setSuccess(t("sessionCreated"));
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            console.error(err);
            setError(apiError());
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm(t("deleteConfirm"))) return;

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/sessions/${sessionId}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                return;
            }

            setSessions(sessions.filter((s) => s.id !== sessionId));
            setSuccess(t("sessionDeleted"));
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            console.error(err);
            setError(apiError());
        }
    };

    const handleSaveAndCalculate = async (racingSession: RacingSession) => {
        setIsSubmittingResults(true);
        setError("");
        setSuccess("");
        const isPodiumSession = racingSession.type === "SPRINT" || racingSession.type === "RACE";
        const wildcard = racingSession.wildcards?.[0];
        const resultsPayload: { driverId: string; position: number }[] = [];

        // If session is not podium and has no wildcard (e.g. regular practice without predictions), just mark finished
        if (!isPodiumSession && !wildcard) {
            try {
                const patchRes = await fetch(
                    `/api/competitions/${competitionId}/racing/sessions/${racingSession.id}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ votingClosedAt: new Date().toISOString() }),
                    }
                );
                if (!patchRes.ok) {
                    const data = await patchRes.json().catch(() => null);
                    throw new Error(apiError(data));
                }

                setSuccess(t("sessionMarkedClosed"));
                setResolvingSessionId(null);
                const weekendResponse = await fetch(
                    `/api/competitions/${competitionId}/racing/weekends/${weekendId}`
                );
                if (weekendResponse.ok) {
                    const weekendData = await weekendResponse.json();
                    setSessions(weekendData.weekend?.sessions || []);
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : apiError();
                setError(msg);
            } finally {
                setIsSubmittingResults(false);
            }
            return;
        }

        if (isPodiumSession) {
            if (!firstDriverId || !secondDriverId || !thirdDriverId) {
                setError(t("podiumRequiredError"));
                setIsSubmittingResults(false);
                return;
            }
            if (firstDriverId === secondDriverId || firstDriverId === thirdDriverId || secondDriverId === thirdDriverId) {
                setError(t("podiumDistinctError"));
                setIsSubmittingResults(false);
                return;
            }
            resultsPayload.push({ driverId: firstDriverId, position: 1 });
            resultsPayload.push({ driverId: secondDriverId, position: 2 });
            resultsPayload.push({ driverId: thirdDriverId, position: 3 });
        }

        const maxPos = racingSession.participants.length;
        if (wildcard && wildcardPosition) {
            const pos = parseInt(wildcardPosition);
            if (isNaN(pos) || pos < 1 || pos > maxPos) {
                setError(t("wildcardRangeError", { max: maxPos }));
                setIsSubmittingResults(false);
                return;
            }
            const existingIdx = resultsPayload.findIndex((r) => r.driverId === wildcard.driverId);
            if (existingIdx >= 0) {
                resultsPayload[existingIdx].position = pos;
            } else {
                resultsPayload.push({ driverId: wildcard.driverId, position: pos });
            }
        }

        try {
            const saveRes = await fetch(
                `/api/competitions/${competitionId}/racing/sessions/${racingSession.id}/results`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ results: resultsPayload }),
                }
            );

            if (!saveRes.ok) {
                const data = await saveRes.json().catch(() => null);
                throw new Error(apiError(data));
            }

            const calcRes = await fetch(
                `/api/competitions/${competitionId}/racing/sessions/${racingSession.id}/calculate-points`,
                { method: "POST" }
            );

            if (!calcRes.ok) {
                const data = await calcRes.json().catch(() => null);
                throw new Error(apiError(data));
            }

            setSuccess(t("resultsCalculated"));
            setResolvingSessionId(null);

            const weekendResponse = await fetch(
                `/api/competitions/${competitionId}/racing/weekends/${weekendId}`
            );
            if (weekendResponse.ok) {
                const weekendData = await weekendResponse.json();
                setSessions(weekendData.weekend?.sessions || []);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : apiError();
            setError(msg);
        } finally {
            setIsSubmittingResults(false);
        }
    };

    if (status === "loading" || session?.user?.role !== "ADMIN") {
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
                    href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
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

            {/* Create Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">
                    {t("createTitle")}
                </h2>
                <form onSubmit={handleCreateSession} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder={t("sessionName")}
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    name: e.target.value,
                                })
                            }
                            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={formData.type}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    type: e.target.value,
                                })
                            }
                            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {SESSION_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                        <input
                            type="datetime-local"
                            value={formData.startTime}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    startTime: e.target.value,
                                })
                            }
                            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Wildcard Driver Selection */}
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                            {t("selectWildcard")}{" "}
                            {formData.type === "SPRINT" || formData.type === "RACE"
                                ? t("wildcardOptional")
                                : t("wildcardRequired")}
                        </h3>
                        <select
                            value={formData.wildcardDriverId}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    wildcardDriverId: e.target.value,
                                })
                            }
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {(formData.type === "SPRINT" || formData.type === "RACE") ? (
                                <option value="">{t("noWildcard")}</option>
                            ) : (
                                <option value="" disabled>{t("selectWildcardPrompt")}</option>
                            )}
                            <option value="RANDOM" className="font-bold text-amber-600">{t("randomDriver")}</option>
                            <option disabled>────────────</option>
                            {drivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                    #{driver.number} {driver.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
                            {formData.wildcardDriverId === "RANDOM" 
                                ? t("randomHelp")
                                : t("predictHelp")}
                        </p>
                    </div>

                    {/* Driver Selection */}
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                            {t("participatingDrivers")}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            {drivers.map((driver) => (
                                <label
                                    key={driver.id}
                                    className="flex items-center gap-2 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.selectedDrivers.includes(
                                            driver.id
                                        )}
                                        onChange={() =>
                                            handleToggleDriver(driver.id)
                                        }
                                        className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-zinc-900 dark:text-white">
                                        #{driver.number} {driver.name}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                            {t("selectedCount", { count: formData.selectedDrivers.length })}
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                    >
                        {t("createButton")}
                    </button>
                </form>
            </div>

            {/* Sessions List */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {tCommon("loading")}
                    </p>
                </div>
            ) : sessions.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {t("noSessions")}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sessions.map((racingSession) => {
                        const isPodiumSession = racingSession.type === "SPRINT" || racingSession.type === "RACE";
                        const wildcard = racingSession.wildcards?.[0];
                        const isEditingThis = resolvingSessionId === racingSession.id;
                        const resultsMap = new Map(
                            racingSession.results?.map((r) => [r.position, r.driver]) || []
                        );
                        return (
                            <div
                                key={racingSession.id}
                                className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800"
                            >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                                {racingSession.name}
                                            </h3>
                                            {racingSession.resolved ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                    <CheckIcon className="w-3.5 h-3.5" />
                                                    <span>{t("resolved")}</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                    <ClockIcon className="w-3.5 h-3.5" />
                                                    <span>{t("pending")}</span>
                                                </span>
                                            )}
                                            {racingSession.votingClosedAt && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                                    <LockIcon className="w-3.5 h-3.5" />
                                                    <span>{t("votingClosed")}</span>
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                            {tCommon("type")}: <span className="font-semibold">{racingSession.type}</span> | {tCommon("actions")}:{" "}
                                            {new Date(racingSession.startTime).toLocaleString(locale, { timeZone: "Europe/Warsaw" })}
                                        </p>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                            {t("participantsCount", { count: racingSession.participants.length })}
                                            {wildcard && (
                                                <span className="ml-2 text-amber-600 font-medium">
                                                    | {t("wildcardInfo", { number: wildcard.driver.number, name: wildcard.driver.name })}
                                                </span>
                                            )}
                                        </p>
                                        {/* Saved Results Podium Preview */}
                                        {racingSession.results && racingSession.results.length > 0 && (
                                            <div className="mt-3 p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                                                        {t("confirmedResults")}
                                                    </p>
                                                    {wildcard && (
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 font-semibold">
                                                            <TargetIcon className="w-3.5 h-3.5" />
                                                            <span>{wildcard.driver.name} (WC): P{racingSession.results.find(r => r.driverId === wildcard.driverId)?.position || "?"}</span>
                                                        </span>
                                                    )}
                                                </div>
                                                {isPodiumSession && (
                                                    <div className="grid grid-cols-3 gap-2 items-end pt-1">
                                                        {[
                                                            { pos: 2, driver: resultsMap.get(2), bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-300 dark:border-slate-600", badgeBg: "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100", podiumStep: "h-6 bg-slate-200 dark:bg-slate-700" },
                                                            { pos: 1, driver: resultsMap.get(1), bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-300 dark:border-amber-600/70", badgeBg: "bg-amber-400 text-amber-950 font-bold", podiumStep: "h-10 bg-amber-200 dark:bg-amber-900/60" },
                                                            { pos: 3, driver: resultsMap.get(3), bg: "bg-amber-900/5 dark:bg-amber-950/20", border: "border-amber-700/30 dark:border-amber-700/50", badgeBg: "bg-amber-700 text-amber-100", podiumStep: "h-4 bg-amber-800/20 dark:bg-amber-900/40" },
                                                        ].map((step) => (
                                                            <div key={`admin-result-podium-${step.pos}`} className={`flex flex-col justify-end rounded-lg border ${step.border} ${step.bg} overflow-hidden text-center`}>
                                                                <div className="p-2 flex flex-col items-center">
                                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${step.badgeBg}`}>
                                                                        {step.pos}
                                                                    </div>
                                                                    <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate max-w-full">
                                                                        {step.driver ? step.driver.name : "—"}
                                                                    </span>
                                                                    {step.driver && (
                                                                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-full">
                                                                            #{step.driver.number} {step.driver.team}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className={`${step.podiumStep} flex items-center justify-center text-[11px] font-extrabold text-zinc-700 dark:text-zinc-300`}>
                                                                    P{step.pos}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (isEditingThis) {
                                                    setResolvingSessionId(null);
                                                } else {
                                                    setResolvingSessionId(racingSession.id);
                                                    const p1 = racingSession.results?.find(r => r.position === 1)?.driverId || "";
                                                    const p2 = racingSession.results?.find(r => r.position === 2)?.driverId || "";
                                                    const p3 = racingSession.results?.find(r => r.position === 3)?.driverId || "";
                                                    const wcPos = wildcard
                                                        ? racingSession.results?.find(r => r.driverId === wildcard.driverId)?.position?.toString() || ""
                                                        : "";
                                                    setFirstDriverId(p1);
                                                    setSecondDriverId(p2);
                                                    setThirdDriverId(p3);
                                                    setWildcardPosition(wcPos);
                                                }
                                            }}
                                            className={`px-4 py-2 text-white font-medium rounded-lg transition-colors text-sm ${
                                                isEditingThis
                                                    ? "bg-zinc-600 hover:bg-zinc-700"
                                                    : racingSession.resolved
                                                    ? "bg-amber-600 hover:bg-amber-700"
                                                    : "bg-blue-600 hover:bg-blue-700"
                                            }`}
                                        >
                                            {isEditingThis ? tCommon("cancel") : racingSession.resolved ? t("editResults") : t("enterResults")}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSession(racingSession.id)}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm"
                                        >
                                            {t("deleteSession")}
                                        </button>
                                    </div>
                                </div>
                                {/* Form for Entering Results */}
                                {isEditingThis && (
                                    <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                                        <h4 className="text-md font-semibold text-zinc-900 dark:text-white">
                                            {t("enterResultsTitle")}
                                        </h4>

                                        {isPodiumSession && (
                                            <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                                        Podium (P2 - P1 - P3)
                                                    </p>
                                                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                                        Oficjalne pozycje na podium
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end pt-2">
                                                    {[
                                                        { pos: 2, val: secondDriverId, setter: setSecondDriverId, bg: "bg-slate-100 dark:bg-slate-800/80", border: "border-slate-300 dark:border-slate-600", badgeBg: "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-500", podiumStep: "h-14 sm:h-18 bg-gradient-to-t from-slate-300 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-t-2 border-slate-400 dark:border-slate-500" },
                                                        { pos: 1, val: firstDriverId, setter: setFirstDriverId, bg: "bg-amber-50/70 dark:bg-amber-950/20", border: "border-amber-300 dark:border-amber-600/60 shadow-sm", badgeBg: "bg-amber-400 text-amber-950 border-amber-300 font-black ring-2 ring-amber-300/40", podiumStep: "h-22 sm:h-26 bg-gradient-to-t from-amber-300 to-amber-200 dark:from-amber-900/60 dark:to-amber-800/60 border-t-2 border-amber-400 dark:border-amber-500" },
                                                        { pos: 3, val: thirdDriverId, setter: setThirdDriverId, bg: "bg-amber-900/5 dark:bg-amber-950/10", border: "border-amber-700/30 dark:border-amber-700/40", badgeBg: "bg-amber-700 text-amber-100 border-amber-800", podiumStep: "h-10 sm:h-12 bg-gradient-to-t from-amber-700/30 to-amber-600/20 dark:from-amber-950/50 dark:to-amber-900/40 border-t-2 border-amber-600/40 dark:border-amber-700/50" },
                                                    ].map((step) => (
                                                        <div
                                                            key={`admin-podium-step-${step.pos}`}
                                                            className={`flex flex-col justify-end rounded-xl border ${step.border} ${step.bg} overflow-hidden transition-all`}
                                                        >
                                                            <div className="p-2 sm:p-2.5 flex flex-col items-center text-center space-y-1.5 flex-1 justify-center">
                                                                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs border shadow-xs ${step.badgeBg}`}>
                                                                    {step.pos}
                                                                </div>
                                                                <span className="text-[10px] sm:text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                                                    {step.pos === 1 ? t("p1Label") : step.pos === 2 ? t("p2Label") : t("p3Label")}
                                                                </span>
                                                                <select
                                                                    value={step.val}
                                                                    onChange={(e) => step.setter(e.target.value)}
                                                                    className="w-full text-[11px] sm:text-xs px-1 sm:px-1.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-clip overflow-hidden focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
                                                                >
                                                                    <option value="">{tCommon("actions")}</option>
                                                                    {racingSession.participants.map((p) => (
                                                                        <option key={p.driver.id} value={p.driver.id}>
                                                                            #{p.driver.number} {p.driver.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className={`${step.podiumStep} flex items-center justify-center`}>
                                                                <span className="text-sm sm:text-lg font-black tracking-tighter opacity-60 text-zinc-800 dark:text-zinc-200">
                                                                    P{step.pos}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                            {wildcard && (
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                                        {t("wildcardPosLabel", { number: wildcard.driver.number, name: wildcard.driver.name })}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={racingSession.participants.length}
                                                        placeholder={`1 - ${racingSession.participants.length}`}
                                                        value={wildcardPosition}
                                                        onChange={(e) => setWildcardPosition(e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                                                    />
                                                    <span className="text-xs text-zinc-500">
                                                        {t("wildcardPosLimit", { max: racingSession.participants.length })}
                                                    </span>
                                                </div>
                                            )}
                                        <button
                                            disabled={isSubmittingResults}
                                            onClick={() => handleSaveAndCalculate(racingSession)}
                                            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isSubmittingResults ? t("calculating") : t("submitAndCalculate")}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}