"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Team } from "@/types/team";

export default function EditTeamPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const teamId = params.id as string;

    const [team, setTeam] = useState<Team | null>(null);
    const [name, setName] = useState("");
    const [shortName, setShortName] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchTeam = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/teams/${teamId}`);

            if (!response.ok) {
                throw new Error("Nie można pobrać drużyny");
            }

            const data = await response.json();
            setTeam(data.team);
            setName(data.team.name);
            setShortName(data.team.shortName);
        } catch (err) {
            setError("Błąd podczas pobierania drużyny");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [teamId]);

    useEffect(() => {
        if (session && session.user?.role !== "ADMIN") {
            router.push("/dashboard");
        } else if (session?.user?.id) {
            void fetchTeam();
        }
    }, [session, router, fetchTeam]);

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            if (!name || !shortName) {
                setError("Wszystkie pola są wymagane");
                setIsSaving(false);
                return;
            }

            if (shortName.length > 3) {
                setError("Skrót nie może mieć więcej niż 3 znaki");
                setIsSaving(false);
                return;
            }

            const response = await fetch(`/api/teams/${teamId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    shortName: shortName.toUpperCase(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Błąd podczas aktualizacji drużyny");
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
                <p className="text-zinc-600 dark:text-zinc-400">Ładowanie drużyny...</p>
            </div>
        );
    }

    if (!team) {
        return (
            <div className="space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">
                        {error || "Nie znaleziono drużyny"}
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
                    Edytuj drużynę
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                    Zmień szczegóły drużyny
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
                            Nazwa
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            placeholder="np. Lech Poznań"
                            disabled={isSaving}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="shortName"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            Skrót (max 3 znaki)
                        </label>
                        <input
                            id="shortName"
                            type="text"
                            value={shortName.toUpperCase()}
                            onChange={(e) => setShortName(e.target.value.slice(0, 3))}
                            maxLength={3}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 uppercase"
                            placeholder="np. LEC"
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