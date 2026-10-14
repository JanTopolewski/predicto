"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface RacingWeekend {
    id: string;
    grandPrix: string;
    country: string;
    raceDate: string;
    sessions: RacingSession[];
}

interface RacingSession {
    id: string;
    type: string;
    name: string;
    startTime: string;
}

export default function RacingWeekendsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const competitionId = params.id as string;

    const [weekends, setWeekends] = useState<RacingWeekend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [formData, setFormData] = useState({
        grandPrix: "",
        country: "",
        raceDate: "",
    });

    useEffect(() => {
        if (session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
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
                setError("Error loading weekends");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchWeekends();
    }, [competitionId]);

    const handleCreateWeekend = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!formData.grandPrix || !formData.country || !formData.raceDate) {
            setError("All fields are required");
            return;
        }

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/weekends`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Failed to create weekend");
                return;
            }

            const data = await response.json();
            setWeekends([...weekends, data.weekend]);
            setFormData({ grandPrix: "", country: "", raceDate: "" });
            setSuccess("Weekend created successfully!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError("Error creating weekend");
            console.error(err);
        }
    };

    const handleDeleteWeekend = async (weekendId: string) => {
        if (!confirm("Are you sure you want to delete this weekend?")) return;

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/racing/weekends/${weekendId}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                setError("Failed to delete weekend");
                return;
            }

            setWeekends(weekends.filter((w) => w.id !== weekendId));
            setSuccess("Weekend deleted successfully!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError("Error deleting weekend");
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
                    Racing Weekends
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

            {/* Create Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">
                    Create New Weekend
                </h2>
                <form onSubmit={handleCreateWeekend} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder="Grand Prix Name"
                            value={formData.grandPrix}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    grandPrix: e.target.value,
                                })
                            }
                            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="text"
                            placeholder="Country"
                            value={formData.country}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    country: e.target.value,
                                })
                            }
                            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="datetime-local"
                            value={formData.raceDate}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    raceDate: e.target.value,
                                })
                            }
                            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Create Weekend
                    </button>
                </form>
            </div>

            {/* Weekends List */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Loading weekends...
                    </p>
                </div>
            ) : weekends.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        No weekends created yet
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {weekends.map((weekend) => (
                        <div
                            key={weekend.id}
                            className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800"
                        >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                        {weekend.grandPrix}
                                    </h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {weekend.country} •{" "}
                                        {new Date(weekend.raceDate).toLocaleDateString()}
                                    </p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                                        {weekend.sessions.length} sessions
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Link
                                        href={`/dashboard/competitions/${competitionId}/admin/racing/sessions/${weekend.id}`}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                                    >
                                        Manage Sessions
                                    </Link>
                                    <button
                                        onClick={() =>
                                            handleDeleteWeekend(weekend.id)
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