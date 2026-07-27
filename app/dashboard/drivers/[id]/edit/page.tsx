"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Driver } from "@/types/team";

export default function EditDriverPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const driverId = params.id as string;

    const [driver, setDriver] = useState<Driver | null>(null);
    const [name, setName] = useState("");
    const [number, setNumber] = useState("");
    const [team, setTeam] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchDriver = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/drivers/${driverId}`);

            if (!response.ok) {
                throw new Error("Nie można pobrać kierowcy");
            }

            const data = await response.json();
            setDriver(data.driver);
            setName(data.driver.name);
            setNumber(data.driver.number.toString());
            setTeam(data.driver.team);
        } catch (err) {
            setError("Błąd podczas pobierania kierowcy");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [driverId]);

    useEffect(() => {
        if (session && session.user?.role !== "ADMIN") {
            router.push("/dashboard");
        } else if (session?.user?.id) {
            void fetchDriver();
        }
    }, [session, router, fetchDriver]);

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            if (!name || !number || !team) {
                setError("Wszystkie pola są wymagane");
                setIsSaving(false);
                return;
            }

            const numValue = parseInt(number, 10);
            if (isNaN(numValue) || numValue < 1) {
                setError("Numer musi być liczbą dodatnią");
                setIsSaving(false);
                return;
            }

            const response = await fetch(`/api/drivers/${driverId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    number: numValue,
                    team,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Błąd podczas aktualizacji kierowcy");
                setIsSaving(false);
                return;
            }

            router.push("/dashboard/teams");
        } catch (err) {
            setError("Coś poszło nie tak");
            console.error(err);
            setIsSaving(false);
        }
    };

    if (session?.user?.role !== "ADMIN") {
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-zinc-600 dark:text-zinc-400">Ładowanie kierowcy...</p>
            </div>
        );
    }

    if (!driver) {
        return (
            <div className="space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">
                        {error || "Nie znaleziono kierowcy"}
                    </p>
                </div>
                <Link
                    href="/dashboard/teams"
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                    Wróć do listy
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    Edytuj kierowcę
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                    Zmień szczegóły kierowcy
                </p>
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label
                            htmlFor="name"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            Imię i nazwisko
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            placeholder="np. Max Verstappen"
                            disabled={isSaving}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="number"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            Numer startowy
                        </label>
                        <input
                            id="number"
                            type="number"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            placeholder="np. 1"
                            disabled={isSaving}
                            min="1"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="team"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            Zespół
                        </label>
                        <input
                            id="team"
                            type="text"
                            value={team}
                            onChange={(e) => setTeam(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            placeholder="np. Red Bull Racing"
                            disabled={isSaving}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? "Zapisywanie..." : "Zapisz zmiany"}
                        </button>
                        <Link
                            href="/dashboard/teams"
                            className="flex-1 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-center"
                        >
                            Anuluj
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}