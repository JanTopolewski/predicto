"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function RacingAdminPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const competitionId = params.id as string;

    useEffect(() => {
        if (session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, router]);

    if (session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    🏎️ Racing Admin Panel
                </h1>
                <Link
                    href={`/dashboard/competitions/${competitionId}`}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                    Back
                </Link>
            </div>

            {/* Admin Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manage Weekends */}
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow"
                >
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                        📅 Manage Weekends
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                        Create and manage racing weekends, organize Grand Prix events
                    </p>
                    <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded">
                        Open
                    </span>
                </Link>

                {/* Manage Sessions */}
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/weekends`}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow"
                >
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                        ⏱️ Manage Sessions
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                        Create practice, qualifying, sprint and race sessions with drivers
                    </p>
                    <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded">
                        Open
                    </span>
                </Link>

                {/* Announce Season Winner */}
                <Link
                    href={`/dashboard/competitions/${competitionId}/admin/racing/season-winner`}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-shadow"
                >
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                        🏆 Announce Champion
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                        Announce the season champion and award points to correct predictions
                    </p>
                    <span className="inline-block px-4 py-2 bg-green-600 text-white text-sm font-medium rounded">
                        Open
                    </span>
                </Link>
            </div>
        </div>
    );
}