"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Competition {
    id: string;
    name: string;
    type: string;
    season: string;
    memberCount: number;
    inviteCode: string;
    isPublic: boolean;
    isMember: boolean;
    createdBy?: string;
    canSeeInviteCode?: boolean;
}

interface ApiResponse {
    competitions: Competition[];
}

export default function CompetitionsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const [inviteCodeInput, setInviteCodeInput] = useState("");
    const [joiningByCode, setJoiningByCode] = useState(false);

    useEffect(() => {
        const fetchCompetitions = async () => {
            try {
                setLoading(true);
                const response = await fetch("/api/competitions/all");

                if (!response.ok) {
                    throw new Error("Nie można pobrać konkurencji");
                }

                const data: ApiResponse = await response.json();
                setCompetitions(data.competitions || []);
            } catch (err) {
                setError("Błąd podczas pobierania konkurencji");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        void fetchCompetitions();
    }, []);

    const handleJoinCompetition = async (competitionId: string) => {
        setJoiningId(competitionId);
        setError("");
        setSuccessMessage("");

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/join`,
                {
                    method: "POST",
                }
            );

            if (!response.ok) {
                const data = await response.json();
                setError(data.message || "Błąd podczas dołączania do konkurencji");
                setJoiningId(null);
                return;
            }

            setSuccessMessage("Pomyślnie dołączyłeś do konkurencji!");
            setCompetitions(
                competitions.map((comp) =>
                    comp.id === competitionId ? { ...comp, isMember: true, memberCount: comp.memberCount + 1 } : comp
                )
            );
            setJoiningId(null);
        } catch (err) {
            setError("Błąd podczas dołączania do konkurencji");
            console.error(err);
            setJoiningId(null);
        }
    };

    const handleJoinByCode = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");
        setJoiningByCode(true);

        try {
            if (!inviteCodeInput.trim()) {
                setError("Wpisz kod dostępu");
                setJoiningByCode(false);
                return;
            }

            const response = await fetch(
                `/api/competitions/join-by-code`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ inviteCode: inviteCodeInput.toUpperCase() }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Błąd podczas dołączania do konkurencji");
                setJoiningByCode(false);
                return;
            }

            setSuccessMessage("Pomyślnie dołączyłeś do konkurencji!");
            setInviteCodeInput("");

            const listResponse = await fetch("/api/competitions/all");
            const listData = await listResponse.json();
            setCompetitions(listData.competitions || []);
            setJoiningByCode(false);
        } catch (err) {
            setError("Błąd podczas dołączania do konkurencji");
            console.error(err);
            setJoiningByCode(false);
        }
    };

    const getCompetitionTypeLabel = (type: string) => {
        return type === "FOOTBALL" ? "⚽ Piłka nożna" : "🏎️ Wyścigi";
    };

    const getCompetitionTypeColor = (type: string) => {
        return type === "FOOTBALL"
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
            : "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300";
    };

    const isAdmin = session?.user?.role === "ADMIN";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                            Konkurencje
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                            Przeglądaj dostępne konkurencje i dołącz do nich
                        </p>
                    </div>
                    {isAdmin && (
                        <Link
                            href="/dashboard/competitions/create"
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                        >
                            + Utwórz konkurencję
                        </Link>
                    )}
                </div>
            </div>

            {/* Join by Code Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                    🔒 Dołącz do konkurencji prywatnej
                </h3>
                <form onSubmit={handleJoinByCode} className="flex gap-2">
                    <input
                        type="text"
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value)}
                        placeholder="Wpisz kod dostępu (np. ABC123XYZ9)"
                        disabled={joiningByCode}
                        className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm uppercase"
                    />
                    <button
                        type="submit"
                        disabled={joiningByCode}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {joiningByCode ? "Dołączanie..." : "Dołącz"}
                    </button>
                </form>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        ✓ {successMessage}
                    </p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Competitions Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                {loading ? (
                    <div className="p-8 text-center">
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Ładowanie konkurencji...
                        </p>
                    </div>
                ) : competitions.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Brak dostępnych konkurencji
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Konkurencja
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Typ
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Sezon
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Członkowie
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                    Kod dostępu
                                </th>
                                <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                                    Akcje
                                </th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {competitions.map((comp) => (
                                <tr
                                    key={comp.id}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-zinc-900 dark:text-white">
                                            {comp.name}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCompetitionTypeColor(
                                                    comp.type
                                                )}`}
                                            >
                                                {getCompetitionTypeLabel(comp.type)}
                                            </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-zinc-600 dark:text-zinc-400">
                                            {comp.season}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-zinc-600 dark:text-zinc-400">
                                            {comp.memberCount}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                                    comp.isPublic
                                                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                                        : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                                                }`}
                                            >
                                                {comp.isPublic ? "🌍 Publiczna" : "🔒 Prywatna"}
                                            </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {comp.canSeeInviteCode ? (
                                            <div className="flex items-center gap-2">
                                                <code className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono text-zinc-900 dark:text-white">
                                                    {comp.inviteCode}
                                                </code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(comp.inviteCode);
                                                        setSuccessMessage("Kod skopiowany do schowka!");
                                                        setTimeout(() => setSuccessMessage(""), 3000);
                                                    }}
                                                    className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded transition-colors"
                                                    title="Skopiuj kod"
                                                >
                                                    📋
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                                    -
                                                </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end">
                                            {comp.isMember ? (
                                                <>
                                                    <Link
                                                        href={`/dashboard/competitions/${comp.id}`}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                                                    >
                                                        Wejdź
                                                    </Link>
                                                </>
                                            ) : (
                                                <>
                                                    {comp.isPublic ? (
                                                        <button
                                                            onClick={() => handleJoinCompetition(comp.id)}
                                                            disabled={joiningId === comp.id}
                                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {joiningId === comp.id ? "Dołączanie..." : "Dołącz"}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                                                Potrzebujesz kodu
                                                            </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}