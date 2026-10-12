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
    const { data: session } = useSession();
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
        if (session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, router]);

    useEffect(() => {
        const fetchData = async () => {
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
                }
            } catch (err) {
                setError("Error loading data");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [competitionId, weekendId]);

    const handleToggleDriver = (driverId: string) => {
        setFormData((prev) => ({
            ...prev,
            selectedDrivers: prev.selectedDrivers.includes(driverId)
                ? prev.selectedDrivers.filter((id) => id !== driverId)
                : [...prev.selectedDrivers, driverId],
        }));
    };

    const handleCreateSession = async (e: React.SubmitEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (
            !formData.name ||
            !formData.startTime ||
            formData.selectedDrivers.length === 0
        ) {
            setError("All fields are required and select at least one driver");
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
                const data = await response.json();
                setError(data.error || "Failed to create session");
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
            setSuccess("Session created successfully!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError("Error creating session");
            console.error(err);
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm("Are you sure you want to delete this session?")) return;

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/sessions/${sessionId}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                setError("Failed to delete session");
                return;
            }

            setSessions(sessions.filter((s) => s.id !== sessionId));
            setSuccess("Session deleted successfully!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError("Error deleting session");
            console.error(err);
        }
    };

    const handleSaveAndCalculate = async (racingSession: RacingSession) => {
    setIsSubmittingResults(true);
    setError("");
    setSuccess("");
    const isPodiumSession = racingSession.type === "SPRINT" || racingSession.type === "RACE";
    const resultsPayload: { driverId: string; position: number }[] = [];
    if (isPodiumSession) {
        if (!firstDriverId || !secondDriverId || !thirdDriverId) {
            setError("Wybierz kierowców dla pozycji 1, 2 i 3");
            setIsSubmittingResults(false);
            return;
        }
        if (firstDriverId === secondDriverId || firstDriverId === thirdDriverId || secondDriverId === thirdDriverId) {
            setError("Miejsca na podium muszą zajmować różni kierowcy");
            setIsSubmittingResults(false);
            return;
        }
        resultsPayload.push({ driverId: firstDriverId, position: 1 });
        resultsPayload.push({ driverId: secondDriverId, position: 2 });
        resultsPayload.push({ driverId: thirdDriverId, position: 3 });
    }
    const wildcard = racingSession.wildcards?.[0];
    const maxPos = racingSession.participants.length;
    if (wildcard && wildcardPosition) {
        const pos = parseInt(wildcardPosition);
        if (isNaN(pos) || pos < 1 || pos > maxPos) {
            setError(`Pozycja Wildcard musi być liczbą od 1 do ${maxPos}`);
            setIsSubmittingResults(false);
            return;
        }
        const existingIdx = resultsPayload.findIndex(r => r.driverId === wildcard.driverId);
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
            const data = await saveRes.json();
            throw new Error(data.error || "Błąd zapisu wyników");
        }
        const calcRes = await fetch(
            `/api/competitions/${competitionId}/racing/sessions/${racingSession.id}/calculate-points`,
            { method: "POST" }
        );
        if (!calcRes.ok) {
            const data = await calcRes.json();
            throw new Error(data.error || "Błąd podliczania punktów");
        }
        setSuccess("✓ Wyniki zatwierdzone, głosowanie zablokowane i punkty podliczone!");
        setResolvingSessionId(null);
        
        const weekendResponse = await fetch(
            `/api/competitions/${competitionId}/racing/weekends/${weekendId}`
        );
        if (weekendResponse.ok) {
            const weekendData = await weekendResponse.json();
            setSessions(weekendData.weekend?.sessions || []);
        }
    } catch (err: any) {
        setError(err.message || "Wystąpił błąd");
    } finally {
        setIsSubmittingResults(false);
    }
};

    if (!session?.user?.id) {
        return (
            <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
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
                    Racing Sessions
                </h1>
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
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

            {/* Create Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">
                    Create New Session
                </h2>
                <form onSubmit={handleCreateSession} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder="Session Name"
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
                            Select Wildcard Driver (Optional)
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
                            <option value="">No wildcard</option>
                            <option value="RANDOM" className="font-bold text-amber-600">🎲 Random Driver</option>
                            <option disabled>────────────</option>
                            {drivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                    #{driver.number} {driver.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
                            {formData.wildcardDriverId === "RANDOM" 
                                ? "A random driver will be selected from participants"
                                : "Players will predict this driver's finishing position"}
                        </p>
                    </div>

                    {/* Driver Selection */}
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                            Select Participating Drivers
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
                            Selected: {formData.selectedDrivers.length} drivers
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Create Session
                    </button>
                </form>
            </div>

            {/* Sessions List */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Loading sessions...
                    </p>
                </div>
            ) : sessions.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        No sessions created yet
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sessions.map((racingSession) => {
                        const isPodiumSession = racingSession.type === "SPRINT" || racingSession.type === "RACE";
                        const wildcard = racingSession.wildcards?.[0];
                        const isEditingThis = resolvingSessionId === racingSession.id;
                        // Przygotowanie mapy zapisanych już wyników do podglądu
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
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                                {racingSession.name}
                                            </h3>
                                            {racingSession.resolved ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                    ✓ Rozliczona
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                    ⏳ Oczekuje na wyniki
                                                </span>
                                            )}
                                            {racingSession.votingClosedAt && (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                                    🔒 Głosowanie zablokowane
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                            Typ: <span className="font-semibold">{racingSession.type}</span> | Start:{" "}
                                            {new Date(racingSession.startTime).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}
                                        </p>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                            Uczestnicy: {racingSession.participants.length} kierowców
                                            {wildcard && (
                                                <span className="ml-2 text-amber-600 font-medium">
                                                    | Wildcard: #{wildcard.driver.number} {wildcard.driver.name}
                                                </span>
                                            )}
                                        </p>
                                        {/* Podgląd wprowadzonych wyników */}
                                        {racingSession.results && racingSession.results.length > 0 && (
                                            <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                                                    Zatwierdzone wyniki:
                                                </p>
                                                <div className="flex flex-wrap gap-4 text-sm text-zinc-800 dark:text-zinc-200">
                                                    {resultsMap.get(1) && <span>🥇 P1: {resultsMap.get(1)?.name}</span>}
                                                    {resultsMap.get(2) && <span>🥈 P2: {resultsMap.get(2)?.name}</span>}
                                                    {resultsMap.get(3) && <span>🥉 P3: {resultsMap.get(3)?.name}</span>}
                                                    {wildcard && (
                                                        <span>
                                                            🎯 {wildcard.driver.name} (Wildcard): P{racingSession.results.find(r => r.driverId === wildcard.driverId)?.position || "?"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* Przyciski akcji */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (isEditingThis) {
                                                    setResolvingSessionId(null);
                                                } else {
                                                    setResolvingSessionId(racingSession.id);
                                                    // Załaduj istniejące wartości do edycji jeśli są
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
                                            {isEditingThis ? "Anuluj" : racingSession.resolved ? "Edytuj wyniki" : "Wprowadź wyniki"}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSession(racingSession.id)}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm"
                                        >
                                            Usuń
                                        </button>
                                    </div>
                                </div>
                                {/* Formularz wprowadzania wyników */}
                                {isEditingThis && (
                                    <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                        <h4 className="text-md font-semibold text-zinc-900 dark:text-white mb-3">
                                            Wprowadź oficjalne wyniki sesji
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            {isPodiumSession && (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                                            🥇 1. Miejsce (P1)
                                                        </label>
                                                        <select
                                                            value={firstDriverId}
                                                            onChange={(e) => setFirstDriverId(e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                                                        >
                                                            <option value="">Wybierz kierowcę</option>
                                                            {racingSession.participants.map((p) => (
                                                                <option key={p.driver.id} value={p.driver.id}>
                                                                    #{p.driver.number} {p.driver.name} ({p.driver.team})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                                            🥈 2. Miejsce (P2)
                                                        </label>
                                                        <select
                                                            value={secondDriverId}
                                                            onChange={(e) => setSecondDriverId(e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                                                        >
                                                            <option value="">Wybierz kierowcę</option>
                                                            {racingSession.participants.map((p) => (
                                                                <option key={p.driver.id} value={p.driver.id}>
                                                                    #{p.driver.number} {p.driver.name} ({p.driver.team})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                                            🥉 3. Miejsce (P3)
                                                        </label>
                                                        <select
                                                            value={thirdDriverId}
                                                            onChange={(e) => setThirdDriverId(e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                                                        >
                                                            <option value="">Wybierz kierowcę</option>
                                                            {racingSession.participants.map((p) => (
                                                                <option key={p.driver.id} value={p.driver.id}>
                                                                    #{p.driver.number} {p.driver.name} ({p.driver.team})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </>
                                            )}
                                            {wildcard && (
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                                        🎯 Pozycja Wildcard: #{wildcard.driver.number} {wildcard.driver.name}
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
                                                        Limit: 1 - {racingSession.participants.length}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            disabled={isSubmittingResults}
                                            onClick={() => handleSaveAndCalculate(racingSession)}
                                            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isSubmittingResults ? "Zapisywanie i podliczanie..." : "✓ Zatwierdź wyniki i podlicz punkty"}
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