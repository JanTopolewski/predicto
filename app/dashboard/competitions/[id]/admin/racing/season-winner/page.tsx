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

export default function RacingSeasonWinnerPage() {
    const { data: session } = useSession();
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
        if (session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, router]);

    useEffect(() => {
        const fetchDrivers = async () => {
            try {
                setLoading(true);
                const response = await fetch("/api/drivers");
                if (response.ok) {
                    const data = await response.json();
                    setDrivers(data.drivers || []);
                }
            } catch (err) {
                setError("Error loading drivers");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDrivers();
    }, []);

    const handleAnnounceWinner = async () => {
        if (!selectedDriverId) {
            setError("Please select a driver");
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
                const data = await response.json();
                setError(data.error || "Failed to announce winner");
                setIsAnnouncing(false);
                return;
            }

            const data = await response.json();
            setSuccess(
                `${data.driverName} announced as season winner! ${data.playersRewarded} players received ${data.pointsAwarded} points.`
            );
            setSelectedDriverId("");
            setTimeout(() => {
                router.push(
                    `/dashboard/competitions/${competitionId}`
                );
            }, 2000);
        } catch (err) {
            setError("Error announcing winner");
            console.error(err);
        } finally {
            setIsAnnouncing(false);
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
                    Announce Season Winner
                </h1>
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing`}
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

            {/* Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800 max-w-2xl">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
                    Select Season Champion
                </h2>

                {loading ? (
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Loading drivers...
                    </p>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-3">
                                Driver
                            </label>
                            <select
                                value={selectedDriverId}
                                onChange={(e) =>
                                    setSelectedDriverId(e.target.value)
                                }
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a driver...</option>
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
                            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                        >
                            {isAnnouncing ? "Announcing..." : "Announce Champion"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}