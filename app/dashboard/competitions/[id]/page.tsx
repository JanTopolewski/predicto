"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { Locale } from "@/i18n/config";
import { CheckIcon, TrophyIcon, BallIcon, FlagIcon, SettingsIcon, TrashIcon, AlertTriangleIcon } from "@/components/Icons";

interface Match {
    id: string;
    homeTeam: { id: string; name: string; shortName: string };
    awayTeam: { id: string; name: string; shortName: string };
    homeGoals: number | null;
    awayGoals: number | null;
    kickoff: string;
    status: string;
    resolved: boolean;
    predictions: Array<{ id: string; userId: string; homeGoals: number; awayGoals: number }>;
}

interface Team {
    id: string;
    name: string;
}

interface Driver {
    id: string;
    name: string;
    number: number;
}

interface SeasonPrediction {
    id: string;
    teamId?: string | null;
    driverId?: string | null;
    team?: Team | null;
    driver?: Driver | null;
}

interface CompetitionDetail {
    id: string;
    name: string;
    type: string;
    season: string;
    startDate: string;
    endDate: string;
    createdBy: string;
    members: Array<{
        id: string;
        username: string;
        points: number;
    }>;
    matches: Match[];
    allTeams: Team[];
    allDrivers: Driver[];
    seasonPrediction: SeasonPrediction | null;
    hasStarted: boolean;
    winnerResolved: boolean;
}

export default function CompetitionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState("");
    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [predictingWinner, setPredictingWinner] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    const t = useTranslations("competitions");
    const tCommon = useTranslations("common");
    const apiError = useApiError();
    const locale = useLocale() as Locale;

    const competitionId = params.id as string;
    const isMember = competition?.members.some(m => m.id === session?.user?.id);
    const isAdmin = session?.user?.role === "ADMIN";
    const isOwner = competition?.createdBy === session?.user?.id;

    const fetchCompetition = useCallback(async () => {
        try {
            const response = await fetch(`/api/competitions/${competitionId}`);

            if (!response.ok) {
                const data = await response.json();
                setError(apiError(data));
                return;
            }

            const data = await response.json();
            setCompetition(data.competition);

            const pred = data.competition.seasonPrediction;
            if (data.competition.type === "FOOTBALL" && pred?.team?.id) {
                setSelectedTeamId(pred.team.id);
            } else if (data.competition.type === "RACING" && pred?.driver?.id) {
                setSelectedDriverId(pred.driver.id);
            }
        } catch (err) {
            setError(apiError());
            console.error(err);
        }
    }, [competitionId, apiError]);

    useEffect(() => {
        const loadCompetition = async () => {
            setLoading(true);
            await fetchCompetition();
            setLoading(false);
        };

        void loadCompetition();
    }, [fetchCompetition]);

    const handlePredictWinner = async () => {
        const selectedId = competition?.type === "FOOTBALL" ? selectedTeamId : selectedDriverId;

        if (!selectedId) {
            setError(competition?.type === "FOOTBALL" ? t("seasonWinner.selectTeam") : t("seasonWinner.selectDriver"));
            return;
        }

        setError("");
        setPredictingWinner(true);

        try {
            const endpoint = competition?.type === "FOOTBALL"
                ? `/api/competitions/${competitionId}/football/season-winner`
                : `/api/competitions/${competitionId}/racing/season-winner`;

            const bodyKey = competition?.type === "FOOTBALL" ? "teamId" : "driverId";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [bodyKey]: selectedId }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(apiError(data));
                setPredictingWinner(false);
                return;
            }

            setSuccessMessage(t("seasonWinner.predictionSaved"));
            setPredictingWinner(false);
            await fetchCompetition();
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError(apiError());
            console.error(err);
            setPredictingWinner(false);
        }
    };

    const getCompetitionTypeLabel = (type: string) => {
        return type === "FOOTBALL" ? tCommon("football") : tCommon("racing");
    };

    const getRankingWithTies = (members: Array<{ id: string; username: string; points: number }>) => {
        const sorted = [...members].sort((a, b) => b.points - a.points);
        const ranking = [];
        let currentPosition = 1;

        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i].points !== sorted[i - 1].points) {
                currentPosition = i + 1;
            }
            ranking.push({
                ...sorted[i],
                position: currentPosition,
            });
        }

        return ranking;
    };

    const getMedalColor = (position: number) => {
        switch (position) {
            case 1:
                return "bg-yellow-500";
            case 2:
                return "bg-gray-400";
            case 3:
                return "bg-orange-600";
            default:
                return "bg-zinc-400";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-zinc-600 dark:text-zinc-400">{tCommon("loading")}</p>
            </div>
        );
    }

    if (error || !competition) {
        return (
            <div className="space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">
                        {error || t("details.notFound")}
                    </p>
                </div>
                <Link
                    href="/dashboard/competitions"
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                    {t("details.backToList")}
                </Link>
            </div>
        );
    }

    const rankingData = getRankingWithTies(competition.members);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                            {competition.name}
                        </h2>
                        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-2">
                            {getCompetitionTypeLabel(competition.type)} • {tCommon("season")} {competition.season}
                        </p>
                    </div>
                    <Link
                        href="/dashboard/competitions"
                        className="px-4 sm:px-6 py-2.5 sm:py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium rounded-lg transition-colors text-center text-sm sm:text-base"
                    >
                        {tCommon("back")}
                    </Link>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {successMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                    <CheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">{successMessage}</p>
                </div>
            )}

            {/* Competition Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                        {t("startDate")}
                    </p>
                    <p className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">
                        {new Date(competition.startDate).toLocaleDateString(locale, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                        {t("endDate")}
                    </p>
                    <p className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">
                        {new Date(competition.endDate).toLocaleDateString(locale, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>
            </div>

            {/* Season Winner Prediction - For members and if first match/session didn't start */}
            {isMember && !isAdmin && !competition.hasStarted && !competition.winnerResolved && !competition.seasonPrediction && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-4">
                        <TrophyIcon className="w-5 h-5 text-amber-500" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {t("seasonWinner.title")}
                        </h3>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        {t("seasonWinner.description")}
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                            {competition.type === "FOOTBALL" ? t("seasonWinner.selectTeam") : t("seasonWinner.selectDriver")}
                        </label>
                        {competition.type === "FOOTBALL" ? (
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                disabled={predictingWinner}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">{t("seasonWinner.selectTeam")}</option>
                                {competition.allTeams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <select
                                value={selectedDriverId}
                                onChange={(e) => setSelectedDriverId(e.target.value)}
                                disabled={predictingWinner}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">{t("seasonWinner.selectDriver")}</option>
                                {competition.allDrivers.map((driver) => (
                                    <option key={driver.id} value={driver.id}>
                                        {driver.name} (#{driver.number})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <button
                        onClick={handlePredictWinner}
                        disabled={predictingWinner || !selectedTeamId && !selectedDriverId}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {predictingWinner ? t("seasonWinner.saving") : t("seasonWinner.savePrediction")}
                    </button>
                </div>
            )}

            {isMember && !isAdmin && competition.seasonPrediction && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                        <TrophyIcon className="w-5 h-5 text-amber-500" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {t("seasonWinner.yourPick")}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckIcon className="w-4 h-4 flex-shrink-0" />
                        <span>
                            {competition.type === "FOOTBALL" 
                                ? competition.seasonPrediction.team?.name 
                                : `${competition.seasonPrediction.driver?.name} (#${competition.seasonPrediction.driver?.number})`}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{t("seasonWinner.pickRegistered")}</p>
                </div>
            )}

            {isMember && competition.hasStarted && !competition.seasonPrediction && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center gap-2">
                    <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                        {t("seasonWinner.seasonAlreadyStarted")}
                    </p>
                </div>
            )}

            {/* Matches - For FOOTBALL members */}
            {isMember && competition.type === "FOOTBALL" && competition.matches.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-4">
                        <BallIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {t("details.matchesTitle")}
                        </h3>
                    </div>
                    <Link
                        href={`/dashboard/competitions/${competitionId}/matches`}
                        className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    >
                        {t("details.browseMatches")}
                    </Link>
                </div>
            )}

            {/* Racing Sessions - For RACING members */}
            {isMember && competition.type === "RACING" && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-4">
                        <FlagIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {t("details.racingTitle")}
                        </h3>
                    </div>
                    <Link
                        href={`/dashboard/competitions/${competitionId}/racing`}
                        className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    >
                        {t("details.browseRacing")}
                    </Link>
                </div>
            )}

            {(isMember || isAdmin) && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                            {t("ranking")}
                        </h3>
                    </div>

                    {competition.members.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-zinc-600 dark:text-zinc-400">
                                {t("details.noMembers")}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {rankingData.map((member) => (
                                <div
                                    key={member.id}
                                    className="p-4 sm:p-6 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <div
                                        className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full font-bold text-white ${getMedalColor(member.position)}`}
                                    >
                                        {member.position}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className={`font-medium ${
                                                member.username === session?.user?.name
                                                    ? "text-blue-600 dark:text-blue-400"
                                                    : "text-zinc-900 dark:text-white"
                                            }`}
                                        >
                                            {member.username}
                                            {member.username === session?.user?.name && ` ${t("details.youIndicator")}`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                                            {member.points} {tCommon("pointsShort")}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Admin Actions - FOOTBALL */}
            {isAdmin && isOwner && competition.type === "FOOTBALL" && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-4">
                        <SettingsIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {t("details.adminPanel")}
                        </h3>
                    </div>
                    <div className="flex flex-col flex-wrap sm:flex-row gap-3">
                        <Link
                            href={`/dashboard/competitions/${competitionId}/admin/matches`}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center"
                        >
                            <BallIcon className="w-4 h-4" />
                            <span>{t("details.manageMatches")}</span>
                        </Link>
                        <button
                            onClick={async () => {
                                if (window.confirm(t("details.deleteConfirm"))) {
                                    try {
                                        const response = await fetch(`/api/competitions/${competitionId}/delete`, {
                                            method: "DELETE",
                                        });

                                        if (!response.ok) {
                                            const data = await response.json();
                                            alert(apiError(data));
                                            return;
                                        }

                                        router.push("/dashboard/competitions");
                                    } catch (err) {
                                        alert(apiError());
                                        console.error(err);
                                    }
                                }
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                        >
                            <TrashIcon className="w-4 h-4" />
                            <span>{t("details.deleteCompetition")}</span>
                        </button>

                        {!competition?.winnerResolved && (
                            <Link
                                href={`/dashboard/competitions/${competitionId}/admin/announce-winner`}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white font-medium rounded-lg transition-colors text-center"
                            >
                                <TrophyIcon className="w-4 h-4" />
                                <span>{t("details.announceWinner")}</span>
                            </Link>
                        )}

                        {competition?.winnerResolved && (
                            <div className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 font-medium text-center">
                                <CheckIcon className="w-4 h-4" />
                                <span>{t("details.winnerAlreadyAnnounced")}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Admin Actions - RACING */}
            {isAdmin && isOwner && competition.type === "RACING" && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-4">
                        <SettingsIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {t("details.adminPanel")}
                        </h3>
                    </div>
                    <div className="flex flex-col flex-wrap sm:flex-row gap-3">
                        <Link
                            href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center"
                        >
                            <FlagIcon className="w-4 h-4" />
                            <span>{t("details.manageWeekends")}</span>
                        </Link>
                        <button
                            onClick={async () => {
                                if (window.confirm(t("details.deleteConfirm"))) {
                                    try {
                                        const response = await fetch(`/api/competitions/${competitionId}/delete`, {
                                            method: "DELETE",
                                        });

                                        if (!response.ok) {
                                            const data = await response.json();
                                            alert(apiError(data));
                                            return;
                                        }

                                        router.push("/dashboard/competitions");
                                    } catch (err) {
                                        alert(apiError());
                                        console.error(err);
                                    }
                                }
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                        >
                            <TrashIcon className="w-4 h-4" />
                            <span>{t("details.deleteCompetition")}</span>
                        </button>

                        {!competition?.winnerResolved && (
                            <Link
                                href={`/dashboard/competitions/${competitionId}/admin/racing/season-winner`}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white font-medium rounded-lg transition-colors text-center"
                            >
                                <TrophyIcon className="w-4 h-4" />
                                <span>{t("details.announceWinner")}</span>
                            </Link>
                        )}

                        {competition?.winnerResolved && (
                            <div className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 font-medium text-center">
                                <CheckIcon className="w-4 h-4" />
                                <span>{t("details.winnerAlreadyAnnounced")}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}