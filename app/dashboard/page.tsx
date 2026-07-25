"use client";

import React from "react";
import { useSession } from "next-auth/react";

export default function DashboardPage() {
    const { data: session } = useSession();

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                    Witaj, {session?.user?.name}! 👋
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                    Witaj w aplikacji Predicto - twojej platformie do obstawiania meczy
                    i wyścigów F1.
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Twoje punkty
                            </p>
                            <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                                0
                            </p>
                        </div>
                        <div className="text-4xl">⚡</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Aktywne ligi
                            </p>
                            <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                                0
                            </p>
                        </div>
                        <div className="text-4xl">🏆</div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">
                    Dostępne funkcje
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">
                            ⚽ Obstawianie meczy
                        </h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Obstawiaj wyniki meczów piłki nożnej i zdobywaj punkty.
                        </p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">
                            🏎️ Wyścigi F1
                        </h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Typuj wyniki sesji F1 i polepszaj swoje umiejętności.
                        </p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">
                            👥 Ligi prywatne
                        </h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Stwórz ligę ze swoimi znajomymi i konkuruj z nimi.
                        </p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">
                            📊 Ranking i statystyki
                        </h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Śledź swoją pozycję na rankingu i analizuj statystyki.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}