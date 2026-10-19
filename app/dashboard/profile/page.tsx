"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { CheckIcon, AlertTriangleIcon } from "@/components/Icons";

export default function ProfilePage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Delete account state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    const t = useTranslations("auth.reset");
    const tDelete = useTranslations("auth.deleteAccount");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("apiErrors");
    const apiError = useApiError();

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");
        setIsLoading(true);

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError(tErrors("MISSING_FIELDS"));
            setIsLoading(false);
            return;
        }

        if (newPassword.length < 8) {
            setError(t("passwordTooShort"));
            setIsLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t("passwordMismatch"));
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(apiError(data));
                setIsLoading(false);
                return;
            }

            setSuccessMessage(t("successMessage"));
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setIsLoading(false);

            setTimeout(() => {
                router.push("/dashboard");
            }, 2000);
        } catch (_err) {
            setError(apiError());
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!session?.user?.id) return;

        setDeleteError("");
        if (!deletePassword) {
            setDeleteError(tErrors("MISSING_FIELDS"));
            return;
        }

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/users/${session.user.id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    password: deletePassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setDeleteError(apiError(data));
                setIsDeleting(false);
                return;
            }

            // Successfully deleted - sign out and redirect to login
            await signOut({ callbackUrl: "/auth/login" });
        } catch {
            setDeleteError(tErrors("INTERNAL_ERROR"));
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 px-4 sm:px-6 py-8 sm:py-0">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-center text-zinc-900 dark:text-white mb-2">
                            {tCommon("appName")}
                        </h1>
                        <p className="text-center text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                            {t("title")}
                        </p>
                    </div>

                    {successMessage && (
                        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                            <CheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                {successMessage}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                        <div>
                            <label
                                htmlFor="currentPassword"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                {t("currentPassword")}
                            </label>
                            <input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="newPassword"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                {t("newPassword")}
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                            >
                                {t("confirmNewPassword")}
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                        >
                            {isLoading ? t("submittingButton") : t("submitButton")}
                        </button>
                    </form>

                    <div className="mt-4 sm:mt-6 text-center">
                        <Link
                            href="/dashboard"
                            className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                            ← {t("backToDashboard")}
                        </Link>
                    </div>
                </div>

                {/* Delete Account */}
                <div className="mt-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                            <AlertTriangleIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                {tDelete("sectionTitle")}
                            </h2>
                            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white mt-1">
                                {tDelete("title")}
                            </h3>
                            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                {tDelete("subtitle")}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <button
                            type="button"
                            onClick={() => {
                                setDeleteError("");
                                setDeletePassword("");
                                setIsDeleteModalOpen(true);
                            }}
                            className="w-full px-4 py-2.5 border border-red-300 dark:border-red-800/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium rounded-lg transition-colors text-sm cursor-pointer"
                        >
                            {tDelete("button")}
                        </button>
                    </div>
                </div>
            </div>

            {/* Delete Account Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                            <div className="p-2 rounded-full bg-red-100 dark:bg-red-950">
                                <AlertTriangleIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                {tDelete("modalTitle")}
                            </h3>
                        </div>

                        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                            {tDelete("modalDescription")}
                        </p>

                        {deleteError && (
                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs sm:text-sm">
                                {deleteError}
                            </div>
                        )}

                        <form onSubmit={handleDeleteAccount} className="space-y-4">
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                    {tDelete("passwordPrompt")}
                                </label>
                                <input
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    placeholder={tDelete("passwordPlaceholder")}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    disabled={isDeleting}
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    disabled={isDeleting}
                                    className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-medium transition-colors cursor-pointer"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isDeleting}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isDeleting ? tDelete("deleting") : tDelete("confirmButton")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

