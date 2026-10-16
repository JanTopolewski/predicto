"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { Driver } from "@/types/driver";

export default function EditDriverPage() {
    const t = useTranslations("teams.editDriver");
    const tCommon = useTranslations("common");
    const apiError = useApiError();
    const { data: session, status } = useSession();
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
                const data = await response.json().catch(() => null);
                throw new Error(apiError(data) || t("loadError"));
            }

            const data = await response.json();
            setDriver(data.driver);
            setName(data.driver.name);
            setNumber(data.driver.number.toString());
            setTeam(data.driver.team);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t("loadError");
            setError(msg);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [driverId, apiError, t]);

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        } else if (session?.user?.id) {
            void fetchDriver();
        }
    }, [session, status, router, fetchDriver]);

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            if (!name || !number || !team) {
                setError(t("fieldsRequired"));
                setIsSaving(false);
                return;
            }

            const numValue = parseInt(number, 10);
            if (isNaN(numValue) || numValue < 1) {
                setError(t("numberPositive"));
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

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                setIsSaving(false);
                return;
            }

            router.push("/dashboard/teams");
        } catch (err) {
            console.error(err);
            setError(apiError());
            setIsSaving(false);
        }
    };

    if (status === "loading" || session?.user?.role !== "ADMIN") {
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-zinc-600 dark:text-zinc-400">{tCommon("loading")}</p>
            </div>
        );
    }

    if (error && !driver) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
                <Link
                    href="/dashboard/teams"
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                    {tCommon("back")}
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {t("title")}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                    {t("subtitle")}
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
                            {t("nameLabel")}
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="number"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            {t("numberLabel")}
                        </label>
                        <input
                            id="number"
                            type="number"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            min="1"
                            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="team"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                        >
                            {t("teamLabel")}
                        </label>
                        <input
                            id="team"
                            type="text"
                            value={team}
                            onChange={(e) => setTeam(e.target.value)}
                            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                        />
                    </div>

                    <div className="flex gap-4">
                        <Link
                            href="/dashboard/teams"
                            className="flex-1 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-center"
                        >
                            {tCommon("cancel")}
                        </Link>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? t("submitting") : t("submit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}