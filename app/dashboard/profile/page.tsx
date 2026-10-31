"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useApiError } from "@/lib/useApiError";
import { CheckIcon, AlertTriangleIcon } from "@/components/Icons";

export default function ProfilePage() {
    const { data: session, update } = useSession();

    // User details state
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState("");
    const [profileError, setProfileError] = useState("");

    // Password state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);

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

    useEffect(() => {
        if (session?.user) {
            setUsername(session.user.name || "");
            setEmail(session.user.email || "");
        }
    }, [session]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileError("");
        setProfileSuccess("");
        setProfileLoading(true);

        if (!username || !email) {
            setProfileError(tErrors("MISSING_FIELDS"));
            setProfileLoading(false);
            return;
        }

        try {
            const hasUsernameChange = username.trim() !== (session?.user?.name || "");
            const hasEmailChange = email.trim().toLowerCase() !== (session?.user?.email || "").toLowerCase();

            if (!hasUsernameChange && !hasEmailChange) {
                setProfileSuccess(t("noChanges"));
                setProfileLoading(false);
                return;
            }

            const response = await fetch(`/api/users/${session?.user?.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: username.trim(),
                    email: email.trim().toLowerCase(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setProfileError(apiError(data));
                setProfileLoading(false);
                return;
            }

            // Update client session with new name and email
            await update({
                user: {
                    name: data.user.username,
                    email: data.user.email,
                },
            });

            setProfileSuccess(t("profileUpdated"));
        } catch {
            setProfileError(tErrors("INTERNAL_ERROR"));
        } finally {
            setProfileLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError("");
        setPasswordSuccess("");
        setPasswordLoading(true);

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError(tErrors("MISSING_FIELDS"));
            setPasswordLoading(false);
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError(t("passwordTooShort"));
            setPasswordLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError(t("passwordMismatch"));
            setPasswordLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/auth/password", {
                method: "PATCH",
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
                setPasswordError(apiError(data));
                setPasswordLoading(false);
                return;
            }

            setPasswordSuccess(t("successMessage"));
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch {
            setPasswordError(tErrors("INTERNAL_ERROR"));
        } finally {
            setPasswordLoading(false);
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
        <div className="w-full max-w-3xl mx-auto space-y-6">
            <div className="mb-2">
                <Link
                    href="/dashboard"
                    className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    ← {t("backToDashboard")}
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:white mt-2">
                    {t("pageTitle")}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {t("pageSubtitle")}
                </p>
            </div>

            {/* User Info & Edit Profile Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8">
                <div className="mb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                        {t("userDataTitle")}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {t("userDataSubtitle")}
                    </p>
                </div>

                {profileSuccess && (
                    <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                        <CheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">
                            {profileSuccess}
                        </p>
                    </div>
                )}

                {profileError && (
                    <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">{profileError}</p>
                    </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                {t("usernameLabel")}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={profileLoading}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                {t("emailLabel")}
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={profileLoading}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t("systemRole")} <span className="font-semibold text-zinc-700 dark:text-zinc-300">{session?.user?.role || "USER"}</span>
                        </div>
                        <button
                            type="submit"
                            disabled={profileLoading}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50 cursor-pointer"
                        >
                            {profileLoading ? tCommon("loading") : tCommon("save")}
                        </button>
                    </div>
                </form>
            </div>

            {/* Change Password Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8">
                <div className="mb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                        {t("title")}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {t("subtitle")}
                    </p>
                </div>

                {passwordSuccess && (
                    <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                        <CheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">
                            {passwordSuccess}
                        </p>
                    </div>
                )}

                {passwordError && (
                    <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">{passwordError}</p>
                    </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="currentPassword"
                            className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                        >
                            {t("currentPassword")}
                        </label>
                        <input
                            id="currentPassword"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="••••••••"
                            disabled={passwordLoading}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label
                                htmlFor="newPassword"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                            >
                                {t("newPassword")}
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                                disabled={passwordLoading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                            >
                                {t("confirmNewPassword")}
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                                disabled={passwordLoading}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={passwordLoading}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50 cursor-pointer"
                        >
                            {passwordLoading ? t("submittingButton") : t("submitButton")}
                        </button>
                    </div>
                </form>
            </div>

            {/* Delete Account Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8">
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

                <div className="mt-5 flex justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            setDeleteError("");
                            setDeletePassword("");
                            setIsDeleteModalOpen(true);
                        }}
                        className="px-5 py-2.5 border border-red-300 dark:border-red-800/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium rounded-lg transition-colors text-sm cursor-pointer"
                    >
                        {tDelete("button")}
                    </button>
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
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
