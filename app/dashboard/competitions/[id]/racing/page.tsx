"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Driver {
    id: string;
    name: string;
    number: number;
    team: string;
}

interface RacingSessionParticipant {
    driver: Driver;
}

interface RacingSession {
    id: string;
    type: string;
    name: string;
    startTime: string;
    resolved: boolean;
    participants: RacingSessionParticipant[];
    predictions: any[];
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
    const { data: session } = useSession();
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
        wildcardDriverId: string;
        wildcardPosition: number;
    } | null>(null);

    useEffect(() => {
        if (!session?.user?.id) {
            router.push("/auth/login");
        }
    }, [session, router]);

    useEffect(() => {
        const fetchWeekends = async () => {
            try {
                setLoading(true);
                const response = await fetch(
                    `/api/competitions/${competitionId}/racing/weekends`
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch weekends");
                }

                const data = await response.json();
                setWeekends(data.weekends || []);
            } catch (err) {
                setError("Error loading racing weekends");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchWeekends();
    }, [competitionId]);

    const handleSelectWildcard = (
        sessionId: string,
        driverId: string,
        drivers: Driver[]
    ) => {
        const selectedDriver = drivers.find((d) => d.id === driverId);
        if (selectedDriver) {
            setCurrentPrediction((prev) =>
                prev && prev.sessionId === sessionId
                    ? { ...prev, wildcardDriverId: driverId }
                    : {
                        sessionId,
                        firstDriver: "",
                        secondDriver: "",
                        thirdDriver: "",
                        wildcardDriverId: driverId,
                        wildcardPosition: 1,
                    }
            );
        }
    };

    const handleSubmitPrediction = async (
        sessionId: string,
        sessionType: string,
    ) => {
        if (!currentPrediction || currentPrediction.sessionId !== sessionId) {
            setError("Please select all required fields");
            return;
        }

        const isPodiumSession = PODIUM_SESSIONS.includes(sessionType);

        if (
            isPodiumSession &&
            (!currentPrediction.firstDriver ||
                !currentPrediction.secondDriver ||
                !currentPrediction.thirdDriver)
        ) {
            setError("Please select podium drivers");
            return;
        }

        if (
            !currentPrediction.wildcardDriverId ||
            !currentPrediction.wildcardPosition
        ) {
            setError("Please select wildcard driver and position");
            return;
        }

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/sessions/${sessionId}/predictions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        firstDriver: isPodiumSession
                            ? currentPrediction.firstDriver
                            : null,
                        secondDriver: isPodiumSession
                            ? currentPrediction.secondDriver
                            : null,
                        thirdDriver: isPodiumSession
                            ? currentPrediction.thirdDriver
                            : null,
                        wildcardDriverId:
                        currentPrediction.wildcardDriverId,
                        wildcardPosition:
                        currentPrediction.wildcardPosition,
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Failed to save prediction");
                return;
            }

            setSuccess("Prediction saved successfully!");
            setCurrentPrediction(null);
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError("Error saving prediction");
            console.error(err);
        }
    };

    if (!session?.user?.id) {
        return (
            <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                <p className="text-zinc-600 dark:text-zinc-400">
                    Please login first
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    Racing Predictions
                </h1>
                <Link
                    href={`/dashboard/competitions/${competitionId}`}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                    Back
                </Link>
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {success && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        ✓ {success}
                    </p>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Loading weekends...
                    </p>
                </div>
            ) : weekends.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        No weekends available
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
                                {new Date(weekend.raceDate).toLocaleDateString()}
                            </p>

                            <div className="space-y-6">
                                {weekend.sessions.map((racingSession) => {
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
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                                {isStarted && (
                                                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs font-semibold rounded-full">
                                                        Session started
                                                    </span>
                                                )}
                                            </div>

                                            {!isStarted && !racingSession.resolved ? (
                                                <div className="space-y-3">
                                                    {isPodiumSession && (
                                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-3">
                                                                SELECT PODIUM (3 pts exact, 1 pt any):
                                                            </p>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                {[1, 2, 3].map(
                                                                    (pos) => (
                                                                        <div
                                                                            key={`podium-${pos}`}
                                                                        >
                                                                            <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                                                                                Position {pos}
                                                                            </label>
                                                                            <select
                                                                                value={
                                                                                    pos ===
                                                                                    1
                                                                                        ? currentPrediction
                                                                                            ?.sessionId ===
                                                                                        racingSession.id
                                                                                            ? currentPrediction
                                                                                                .firstDriver
                                                                                            : ""
                                                                                        : pos ===
                                                                                        2
                                                                                            ? currentPrediction
                                                                                                ?.sessionId ===
                                                                                            racingSession.id
                                                                                                ? currentPrediction
                                                                                                    .secondDriver
                                                                                                : ""
                                                                                            : currentPrediction
                                                                                                ?.sessionId ===
                                                                                            racingSession.id
                                                                                                ? currentPrediction
                                                                                                    .thirdDriver
                                                                                                : ""
                                                                                }
                                                                                onChange={(
                                                                                    e
                                                                                ) => {
                                                                                    setCurrentPrediction(
                                                                                        (
                                                                                            prev
                                                                                        ) =>
                                                                                            prev &&
                                                                                            prev.sessionId ===
                                                                                            racingSession.id
                                                                                                ? {
                                                                                                    ...prev,
                                                                                                    [pos ===
                                                                                                    1
                                                                                                        ? "firstDriver"
                                                                                                        : pos ===
                                                                                                        2
                                                                                                            ? "secondDriver"
                                                                                                            : "thirdDriver"]:
                                                                                                    e
                                                                                                        .target
                                                                                                        .value,
                                                                                                }
                                                                                                : null
                                                                                    );
                                                                                }}
                                                                                className="w-full px-2 py-1 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                                                            >
                                                                                <option value="">
                                                                                    Select...
                                                                                </option>
                                                                                {racingSession.participants.map(
                                                                                    (
                                                                                        p
                                                                                    ) => (
                                                                                        <option
                                                                                            key={
                                                                                                p
                                                                                                    .driver
                                                                                                    .id
                                                                                            }
                                                                                            value={
                                                                                                p
                                                                                                    .driver
                                                                                                    .id
                                                                                            }
                                                                                        >
                                                                                            #{p.driver.number}{" "}
                                                                                            {p.driver.name}
                                                                                        </option>
                                                                                    )
                                                                                )}
                                                                            </select>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-3">
                                                            WILDCARD DRIVER (2 pts exact, 1 pt ±2 positions):
                                                        </p>
                                                        <select
                                                            value={
                                                                currentPrediction?.sessionId ===
                                                                racingSession.id
                                                                    ? currentPrediction.wildcardDriverId
                                                                    : ""
                                                            }
                                                            onChange={(e) =>
                                                                handleSelectWildcard(
                                                                    racingSession.id,
                                                                    e.target.value,
                                                                    racingSession.participants.map(
                                                                        (p) =>
                                                                            p.driver
                                                                    )
                                                                )
                                                            }
                                                            className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                                        >
                                                            <option value="">
                                                                Select wildcard driver...
                                                            </option>
                                                            {racingSession.participants.map(
                                                                (p) => (
                                                                    <option
                                                                        key={
                                                                            p
                                                                                .driver
                                                                                .id
                                                                        }
                                                                        value={
                                                                            p
                                                                                .driver
                                                                                .id
                                                                        }
                                                                    >
                                                                        #{p.driver.number}{" "}
                                                                        {p.driver.name}
                                                                    </option>
                                                                )
                                                            )}
                                                        </select>

                                                        {currentPrediction?.sessionId ===
                                                            racingSession.id && (
                                                                <div className="mt-3">
                                                                    <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                                                                        Predicted Position
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        max="20"
                                                                        value={
                                                                            currentPrediction.wildcardPosition
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setCurrentPrediction(
                                                                                (
                                                                                    prev
                                                                                ) =>
                                                                                    prev
                                                                                        ? {
                                                                                            ...prev,
                                                                                            wildcardPosition:
                                                                                                parseInt(
                                                                                                    e
                                                                                                        .target
                                                                                                        .value
                                                                                                ),
                                                                                        }
                                                                                        : null
                                                                            )
                                                                        }
                                                                        className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                                                    />
                                                                </div>
                                                            )}
                                                    </div>

                                                    <button
                                                        onClick={() =>
                                                            handleSubmitPrediction(
                                                                racingSession.id,
                                                                racingSession.type
                                                            )
                                                        }
                                                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                                                    >
                                                        Save Prediction
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {racingSession.resolved
                                                        ? "Session resolved"
                                                        : "Session is in progress"}
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