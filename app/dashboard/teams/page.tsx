"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { Team } from "@/types/team";
import { Driver } from "@/types/driver";

type EntityType = "team" | "driver";

export default function TeamsPage() {
    const t = useTranslations("teams");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const apiError = useApiError();
    const { data: session, status } = useSession();
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
                const badRes = !teamsRes.ok ? teamsRes : driversRes;
                const errData = await badRes.json().catch(() => null);
                throw new Error(apiError(errData) || t("loadError"));
            }

            const teamsData = await teamsRes.json();
            const driversData = await driversRes.json();

            setTeams(teamsData.teams || []);
            setDrivers(driversData.drivers || []);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t("loadError");
            setError(msg);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [apiError, t]);

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        } else if (session?.user?.id) {
            void fetchData();
        }
    }, [session, status, router, fetchData]);

    const handleDeleteTeam = async (teamId: string) => {
        if (!confirm(t("deleteConfirmTeam"))) {
            return;
        }

        setDeletingId(teamId);
        setError("");

        try {
            const response = await fetch(`/api/teams/${teamId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                setDeletingId(null);
                return;
            }

            setTeams(teams.filter((team) => team.id !== teamId));
            setDeletingId(null);
        } catch (err) {
            console.error(err);
            setError(apiError());
            setDeletingId(null);
        }
    };

    const handleDeleteDriver = async (driverId: string) => {
        if (!confirm(t("deleteConfirmDriver"))) {
            return;
        }

        setDeletingId(driverId);
        setError("");

        try {
            const response = await fetch(`/api/drivers/${driverId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                setDeletingId(null);
                return;
            }

            setDrivers(drivers.filter((driver) => driver.id !== driverId));
            setDeletingId(null);
        } catch (err) {
            console.error(err);
            setError(apiError());
            setDeletingId(null);
        }
    };

    if (status === "loading" || session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                            {t("title")}
                        </h2>
                        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2">
                            {t("subtitle")}
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
                    ⚽ {t("tabs.teams")}
                </button>
                <button
                    onClick={() => setActiveTab("driver")}
                    className={`flex-1 px-4 py-3 font-medium transition-colors text-center ${
                        activeTab === "driver"
                            ? "border-b-2 border-orange-600 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30"
                            : "border-b-2 border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                >
                    🏎️ {t("tabs.drivers")}
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
                            {t("addTeam")}
                        </Link>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-600 dark:text-zinc-400">
                                {tCommon("loading")}
                            </p>
                        </div>
                    ) : teams.length === 0 ? (
                        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                {t("noTeams")}
                            </p>
                            <Link
                                href="/dashboard/teams/create"
                                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                            >
                                {t("addTeam")}
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
                                                {t("teamTable.name")}
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                {t("teamTable.shortName")}
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                {t("teamTable.created")}
                                            </th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                                                {t("teamTable.actions")}
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
                                                            locale,
                                                            { timeZone: "Europe/Warsaw" }
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Link
                                                            href={`/dashboard/teams/${team.id}/edit`}
                                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                                                        >
                                                            {tCommon("edit")}
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDeleteTeam(team.id)}
                                                            disabled={deletingId === team.id}
                                                            className="px-3 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {deletingId === team.id ? tCommon("loading") : tCommon("delete")}
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
                                                {new Date(team.createdAt).toLocaleDateString(locale, { timeZone: "Europe/Warsaw" })}
                                            </p>
                                        </div>

                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                {t("teamTable.shortName")}
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
                                                {tCommon("edit")}
                                            </Link>
                                            <button
                                                onClick={() => handleDeleteTeam(team.id)}
                                                disabled={deletingId === team.id}
                                                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {deletingId === team.id ? tCommon("loading") : tCommon("delete")}
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
                            {t("addDriver")}
                        </Link>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-600 dark:text-zinc-400">
                                {tCommon("loading")}
                            </p>
                        </div>
                    ) : drivers.length === 0 ? (
                        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                                {t("noDrivers")}
                            </p>
                            <Link
                                href="/dashboard/drivers/create"
                                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                            >
                                {t("addDriver")}
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
                                                {t("driverTable.number")}
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                {t("driverTable.name")}
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                {t("driverTable.team")}
                                            </th>
                                            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                                {t("teamTable.created")}
                                            </th>
                                            <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                                                {t("driverTable.actions")}
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
                                                            locale,
                                                            { timeZone: "Europe/Warsaw" }
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Link
                                                            href={`/dashboard/drivers/${driver.id}/edit`}
                                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                                                        >
                                                            {tCommon("edit")}
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDeleteDriver(driver.id)}
                                                            disabled={deletingId === driver.id}
                                                            className="px-3 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {deletingId === driver.id ? tCommon("loading") : tCommon("delete")}
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
                                                        locale,
                                                        { timeZone: "Europe/Warsaw" }
                                                    )}
                                                </p>
                                            </div>
                                            <code className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded text-sm font-bold">
                                                #{driver.number}
                                            </code>
                                        </div>

                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                {t("driverTable.team")}
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
                                                {tCommon("edit")}
                                            </Link>
                                            <button
                                                onClick={() => handleDeleteDriver(driver.id)}
                                                disabled={deletingId === driver.id}
                                                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {deletingId === driver.id ? tCommon("loading") : tCommon("delete")}
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