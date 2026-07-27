"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Team, Driver } from "@/types/team";

type EntityType = "team" | "driver";

export default function TeamsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<EntityType>("team");

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [teamsRes, driversRes] = await Promise.all([
                fetch("/api/teams"),
                fetch("/api/drivers"),
            ]);

            if (!teamsRes.ok || !driversRes.ok) {
                throw new Error("Nie można pobrać danych");
            }

            const teamsData = await teamsRes.json();
            const driversData = await driversRes.json();

            setTeams(teamsData.teams || []);
            setDrivers(driversData.drivers || []);
        } catch (err) {
            setError("Błąd podczas pobierania danych");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session && session.user?.role !== "ADMIN") {
            router.push("/dashboard");
        } else if (session?.user?.id) {
            void fetchData();
        }
    }, [session, router, fetchData]);

    const handleDeleteTeam = async (teamId: string) => {
        if (!confirm("Czy na pewno chcesz usunąć tę drużynę?")) {
            return;
        }

        setDeletingId(teamId);
        setError("");

        try {
            const response = await fetch(`/api/teams/${teamId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.message || "Błąd podczas usuwania drużyny");
                setDeletingId(null);
                return;
            }

            setTeams(teams.filter((team) => team.id !== teamId));
            setDeletingId(null);
        } catch (err) {
            setError("Błąd podczas usuwania drużyny");
            console.error(err);
            setDeletingId(null);
        }
    };

    const handleDeleteDriver = async (driverId: string) => {
        if (!confirm("Czy na pewno chcesz usunąć tego kierowcę?")) {
            return;
        }

        setDeletingId(driverId);
        setError("");

        try {
            const response = await fetch(`/api/drivers/${driverId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.message || "Błąd podczas usuwania kierowcy");
                setDeletingId(null);
                return;
            }

            setDrivers(drivers.filter((driver) => driver.id !== driverId));
            setDeletingId(null);
        } catch (err) {
            setError("Błąd podczas usuwania kierowcy");
            console.error(err);
            setDeletingId(null);
        }
    };

    if (session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                            Zarządzanie drużynami i kierowcami
                        </h2>
                        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2">
                            Dodawaj, edytuj i usuwaj drużyny piłkarskie oraz kierowców wyścigowych
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-t-lg overflow-hidden">
                <button
                    onClick={() => setActiveTab("team")}
                    className={`flex-1 px-4 py-3 font-medium transition-colors text-center ${
                        activeTab === "team"
                            ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30"
                            : "border-b-2 border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                >
                    ⚽ Drużyny piłkarskie
                </button>
                <button
                    onClick={() => setActiveTab("driver")}
                    className={`flex-1 px-4 py-3 font-medium transition-colors text-center ${
                        activeTab === "driver"
                            ? "border-b-2 border-orange-600 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30"
                            : "border-b-2 border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                >
                    🏎️ Kierowcy
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Teams Tab */}
            {activeTab === "team" && (
                <>
                    <div className="flex justify-end">
                        <Link
                            href="/dashboard/teams/create"
                            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center text-sm sm:text-base whitespace-nowrap"
                        >
                            + Dodaj drużynę
                        </Link>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-600 dark:text-zinc-400">
                                Ładowanie drużyn...
                            </p>
                        </div>
                    ) : teams.length === 0 ? (
                        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                Brak dodanych drużyn
                            </p>
                            <Link
                                href="/dashboard/teams/create"
                                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                            >
                                Dodaj pierwszą drużynę
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                Nazwa
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                Skrót
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                Data utworzenia
                                            </th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                                                Akcje
                                            </th>
                                        </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {teams.map((team) => (
                                            <tr
                                                key={team.id}
                                                className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-zinc-900 dark:text-white">
                                                        {team.name}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <code className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono text-zinc-900 dark:text-white">
                                                        {team.shortName}
                                                    </code>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                                                        {new Date(team.createdAt).toLocaleDateString(
                                                            "pl-PL"
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Link
                                                            href={`/dashboard/teams/${team.id}/edit`}
                                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                                                        >
                                                            Edytuj
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDeleteTeam(team.id)}
                                                            disabled={deletingId === team.id}
                                                            className="px-3 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {deletingId === team.id ? "Usuwanie..." : "Usuń"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-4">
                                {teams.map((team) => (
                                    <div
                                        key={team.id}
                                        className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-4 border border-zinc-200 dark:border-zinc-800 space-y-3"
                                    >
                                        <div>
                                            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                                                {team.name}
                                            </h3>
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                                {new Date(team.createdAt).toLocaleDateString("pl-PL")}
                                            </p>
                                        </div>

                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                Skrót
                                            </p>
                                            <code className="text-lg font-mono font-semibold text-zinc-900 dark:text-white">
                                                {team.shortName}
                                            </code>
                                        </div>

                                        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                                            <Link
                                                href={`/dashboard/teams/${team.id}/edit`}
                                                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors text-center"
                                            >
                                                Edytuj
                                            </Link>
                                            <button
                                                onClick={() => handleDeleteTeam(team.id)}
                                                disabled={deletingId === team.id}
                                                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {deletingId === team.id ? "Usuwanie..." : "Usuń"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Drivers Tab */}
            {activeTab === "driver" && (
                <>
                    <div className="flex justify-end">
                        <Link
                            href="/dashboard/drivers/create"
                            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center text-sm sm:text-base whitespace-nowrap"
                        >
                            + Dodaj kierowcę
                        </Link>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-600 dark:text-zinc-400">
                                Ładowanie kierowców...
                            </p>
                        </div>
                    ) : drivers.length === 0 ? (
                        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                Brak dodanych kierowców
                            </p>
                            <Link
                                href="/dashboard/drivers/create"
                                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                            >
                                Dodaj pierwszego kierowcę
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                Numer
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                Imię i nazwisko
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                Zespół
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                Data utworzenia
                                            </th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                                                Akcje
                                            </th>
                                        </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {drivers.map((driver) => (
                                            <tr
                                                key={driver.id}
                                                className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <td className="px-6 py-4">
                                                    <code className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono font-bold text-zinc-900 dark:text-white">
                                                        #{driver.number}
                                                    </code>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-zinc-900 dark:text-white">
                                                        {driver.name}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-zinc-600 dark:text-zinc-400">
                                                        {driver.team}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                                                        {new Date(driver.createdAt).toLocaleDateString(
                                                            "pl-PL"
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Link
                                                            href={`/dashboard/drivers/${driver.id}/edit`}
                                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                                                        >
                                                            Edytuj
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDeleteDriver(driver.id)}
                                                            disabled={deletingId === driver.id}
                                                            className="px-3 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {deletingId === driver.id ? "Usuwanie..." : "Usuń"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-4">
                                {drivers.map((driver) => (
                                    <div
                                        key={driver.id}
                                        className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-4 border border-zinc-200 dark:border-zinc-800 space-y-3"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                                                    {driver.name}
                                                </h3>
                                                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                                    {new Date(driver.createdAt).toLocaleDateString(
                                                        "pl-PL"
                                                    )}
                                                </p>
                                            </div>
                                            <code className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded text-sm font-bold">
                                                #{driver.number}
                                            </code>
                                        </div>

                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                Zespół
                                            </p>
                                            <p className="font-semibold text-zinc-900 dark:text-white">
                                                {driver.team}
                                            </p>
                                        </div>

                                        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                                            <Link
                                                href={`/dashboard/drivers/${driver.id}/edit`}
                                                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors text-center"
                                            >
                                                Edytuj
                                            </Link>
                                            <button
                                                onClick={() => handleDeleteDriver(driver.id)}
                                                disabled={deletingId === driver.id}
                                                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {deletingId === driver.id ? "Usuwanie..." : "Usuń"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}