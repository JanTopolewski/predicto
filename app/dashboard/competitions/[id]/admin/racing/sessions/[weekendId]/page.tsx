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
    participants: { driver: Driver }[];
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

    const [formData, setFormData] = useState({
        name: "",
        type: "PRACTICE1",
        startTime: "",
        selectedDrivers: [] as string[],
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

                // Fetch sessions
                const sessionsResponse = await fetch(
                    `/api/competitions/${competitionId}/racing/sessions`
                );
                if (sessionsResponse.ok) {
                    const sessionsData = await sessionsResponse.json();
                    const filtered = sessionsData.sessions.filter(
                        (s: RacingSession) =>
                            s.participants.some(
                                (p) =>
                                    p.driver.id ===
                                    sessionsData.sessions[0]?.participants[0]
                                        ?.driver.id
                            )
                    );
                    setSessions(filtered || []);
                }
            } catch (err) {
                setError("Error loading data");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [competitionId]);

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
                    {sessions.map((racingSession) => (
                        <div
                            key={racingSession.id}
                            className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800"
                        >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                        {racingSession.name}
                                    </h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        Type: {racingSession.type}
                                    </p>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {new Date(
                                            racingSession.startTime
                                        ).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                                        {racingSession.participants.length}{" "}
                                        drivers
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() =>
                                            handleDeleteSession(
                                                racingSession.id
                                            )
                                        }
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}