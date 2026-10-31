"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { CheckIcon, GlobeIcon, LockIcon, ClipboardIcon } from "@/components/Icons";

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

    const t = useTranslations("competitions");
    const tCommon = useTranslations("common");
    const apiError = useApiError();

    useEffect(() => {
        const fetchCompetitions = async () => {
            try {
                setLoading(true);
                const response = await fetch("/api/competitions?scope=all");

                if (!response.ok) {
                    const data = await response.json();
                    setError(apiError(data));
                    return;
                }

                const data: ApiResponse = await response.json();
                setCompetitions(data.competitions || []);
            } catch (err) {
                setError(apiError());
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        void fetchCompetitions();
    }, [apiError]);

    const handleJoinCompetition = async (competitionId: string) => {
        setJoiningId(competitionId);
        setError("");
        setSuccessMessage("");

        try {
            const response = await fetch(
                `/api/competitions/${competitionId}/members`,
                {
                    method: "POST",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(apiError(data));
                setJoiningId(null);
                return;
            }

            setSuccessMessage(t("joinSuccess"));
            setCompetitions(
                competitions.map((comp) =>
                    comp.id === competitionId ? { ...comp, isMember: true, memberCount: comp.memberCount + 1 } : comp
                )
            );
            setJoiningId(null);
        } catch (err) {
            setError(apiError());
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
                setError(t("enterCodePrompt"));
                setJoiningByCode(false);
                return;
            }

            const response = await fetch(
                `/api/competitions/members`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ inviteCode: inviteCodeInput.toUpperCase() }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(apiError(data));
                setJoiningByCode(false);
                return;
            }

            setSuccessMessage(t("joinSuccess"));
            setInviteCodeInput("");

            const listResponse = await fetch("/api/competitions/all");
            const listData = await listResponse.json();
            setCompetitions(listData.competitions || []);
            setJoiningByCode(false);
        } catch (err) {
            setError(apiError());
            console.error(err);
            setJoiningByCode(false);
        }
    };

    const getCompetitionTypeLabel = (type: string) => {
        return type === "FOOTBALL" ? tCommon("football") : tCommon("racing");
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
                    {isAdmin && (
                        <Link
                            href="/dashboard/competitions/create"
                            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center text-sm sm:text-base whitespace-nowrap"
                        >
                            {t("createButton")}
                        </Link>
                    )}
                </div>
            </div>

            {/* Join by Code Section */}
            {!isAdmin && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        {t("joinByCodeTitle")}
                    </h3>
                    <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={inviteCodeInput}
                            onChange={(e) => setInviteCodeInput(e.target.value)}
                            placeholder={t("joinByCodePlaceholder")}
                            disabled={joiningByCode}
                            className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm uppercase"
                        />
                        <button
                            type="submit"
                            disabled={joiningByCode}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                        >
                            {joiningByCode ? t("joining") : t("joinByCodeButton")}
                        </button>
                    </form>
                </div>
            )}

            {/* Success Message */}
            {successMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                    <CheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {successMessage}
                    </p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Competitions */}
            {loading ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {t("loading")}
                    </p>
                </div>
            ) : competitions.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {t("noCompetitions")}
                    </p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        {tCommon("appName")}
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        {tCommon("type")}
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        {tCommon("season")}
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        {tCommon("members")}
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        {tCommon("status")}
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        {t("inviteCode")}
                                    </th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                                        {tCommon("actions")}
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
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                                        comp.isPublic
                                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                                            : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                                                    }`}
                                                >
                                                    {comp.isPublic ? (
                                                        <>
                                                            <GlobeIcon className="w-3.5 h-3.5" />
                                                            <span>{tCommon("public")}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <LockIcon className="w-3.5 h-3.5" />
                                                            <span>{tCommon("private")}</span>
                                                        </>
                                                    )}
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
                                                            setSuccessMessage(t("codeCopied"));
                                                            setTimeout(() => setSuccessMessage(""), 3000);
                                                        }}
                                                        className="p-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-700 dark:text-zinc-300 transition-colors"
                                                        title={t("copyInviteCode")}
                                                    >
                                                        <ClipboardIcon className="w-3.5 h-3.5" />
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
                                                {comp.isMember || (isAdmin && (comp.createdBy === session?.user?.id || comp.createdBy === "SYSTEM")) ? (
                                                    <>
                                                        <Link
                                                            href={`/dashboard/competitions/${comp.id}`}
                                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                                                        >
                                                            {tCommon("enter")}
                                                        </Link>
                                                    </>
                                                ) : (!isAdmin && (
                                                    <>
                                                        {comp.isPublic ? (
                                                            <button
                                                                onClick={() => handleJoinCompetition(comp.id)}
                                                                disabled={joiningId === comp.id}
                                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {joiningId === comp.id ? t("joining") : t("joinByCodeButton")}
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                                                    {t("needCode")}
                                                                </span>
                                                        )}
                                                    </>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-4">
                        {competitions.map((comp) => (
                            <div
                                key={comp.id}
                                className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-4 border border-zinc-200 dark:border-zinc-800 space-y-3"
                            >
                                {/* Header */}
                                <div>
                                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-1">
                                        {comp.name}
                                    </h3>
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                        {tCommon("season")}: {comp.season}
                                    </p>
                                </div>

                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{tCommon("type")}</p>
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium mt-1 ${getCompetitionTypeColor(comp.type)}`}>
                                            {getCompetitionTypeLabel(comp.type)}
                                        </span>
                                    </div>

                                    <div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{tCommon("members")}</p>
                                        <p className="font-semibold text-zinc-900 dark:text-white text-base mt-1">
                                            {comp.memberCount}
                                        </p>
                                    </div>

                                    <div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{tCommon("status")}</p>
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mt-1 ${
                                            comp.isPublic
                                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                                : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                                        }`}>
                                            {comp.isPublic ? (
                                                <>
                                                    <GlobeIcon className="w-3 h-3" />
                                                    <span>{tCommon("public")}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <LockIcon className="w-3 h-3" />
                                                    <span>{tCommon("private")}</span>
                                                </>
                                            )}
                                        </span>
                                    </div>

                                    {comp.canSeeInviteCode && (
                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("inviteCode")}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <code className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded text-xs font-mono text-zinc-900 dark:text-white">
                                                    {comp.inviteCode}
                                                </code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(comp.inviteCode);
                                                        setSuccessMessage(t("codeCopied"));
                                                        setTimeout(() => setSuccessMessage(""), 3000);
                                                    }}
                                                    className="p-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                                    title={t("copyInviteCode")}
                                                >
                                                    <ClipboardIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                    {comp.isMember || (isAdmin && (comp.createdBy === session?.user?.id || comp.createdBy === "SYSTEM")) ? (
                                        <Link
                                            href={`/dashboard/competitions/${comp.id}`}
                                            className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors text-center"
                                        >
                                            {tCommon("enter")}
                                        </Link>
                                    ) : (!isAdmin && (
                                        <>
                                            {comp.isPublic ? (
                                                <button
                                                    onClick={() => handleJoinCompetition(comp.id)}
                                                    disabled={joiningId === comp.id}
                                                    className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {joiningId === comp.id ? t("joining") : t("joinByCodeButton")}
                                                </button>
                                            ) : (
                                                <div className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-medium rounded text-center">
                                                    {t("needCode")}
                                                </div>
                                            )}
                                        </>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}