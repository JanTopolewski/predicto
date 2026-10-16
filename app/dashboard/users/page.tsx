"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useApiError } from "@/lib/useApiError";

interface User {
    id: string;
    username: string;
    email: string;
    role: "USER" | "ADMIN";
    createdAt: string;
}

interface ApiResponse {
    users: User[];
    total: number;
    page: number;
    totalPages: number;
}

export default function UsersPage() {
    const t = useTranslations("users");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const apiError = useApiError();
    const { data: session, status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState("");
    const [password, setPassword] = useState("");
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        action: "delete" | "promote" | "changePassword" | null;
        userId: string;
        username: string;
    }>({
        isOpen: false,
        action: null,
        userId: "",
        username: "",
    });
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.push("/dashboard");
        }
    }, [session, status, router]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`/api/users?page=${page}&limit=10`);
            const data = await response.json();

            if (!response.ok) {
                setError(apiError(data) || t("loadError"));
                return;
            }

            const apiData = data as ApiResponse;
            setUsers(apiData.users || []);
            setTotalPages(apiData.totalPages || 1);
        } catch (err) {
            console.error(err);
            setError(t("loadError"));
        } finally {
            setLoading(false);
        }
    }, [page, apiError, t]);

    useEffect(() => {
        void fetchUsers();
    }, [fetchUsers]);

    const openConfirmDialog = (
        action: "delete" | "promote" | "changePassword",
        userId: string,
        username: string
    ) => {
        setConfirmDialog({
            isOpen: true,
            action,
            userId,
            username,
        });
    };

    const closeConfirmDialog = () => {
        setConfirmDialog({
            isOpen: false,
            action: null,
            userId: "",
            username: "",
        });
        setPassword("");
    };

    const handleDeleteUser = async () => {
        setActionLoading(true);
        try {
            const response = await fetch(`/api/users/${confirmDialog.userId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                return;
            }

            setUsers(users.filter((u) => u.id !== confirmDialog.userId));
            closeConfirmDialog();
        } catch (err) {
            console.error(err);
            setError(apiError());
        } finally {
            setActionLoading(false);
        }
    };

    const handlePromoteUser = async () => {
        setActionLoading(true);
        try {
            const response = await fetch(`/api/users/${confirmDialog.userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: "ADMIN" }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(apiError(data));
                return;
            }

            const updatedUser = await response.json();
            setUsers(
                users.map((u) =>
                    u.id === confirmDialog.userId ? updatedUser.user : u
                )
            );
            closeConfirmDialog();
        } catch (err) {
            console.error(err);
            setError(apiError());
        } finally {
            setActionLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        setActionLoading(true);
        try {
            const response = await fetch(`/api/users/${confirmDialog.userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: password.trim() }),
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                setError(apiError(data));
                return;
            }

            if (data?.user) {
                setUsers((prevUsers) =>
                    prevUsers.map((u) =>
                        u.id === confirmDialog.userId ? data.user : u
                    )
                );
            }
            closeConfirmDialog();
        } catch (err) {
            console.error(err);
            setError(apiError());
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (confirmDialog.action === "delete") {
            await handleDeleteUser();
        } else if (confirmDialog.action === "promote") {
            await handlePromoteUser();
        } else if (confirmDialog.action === "changePassword") {
            await handlePasswordChange();
        }
    };

    if (status === "loading" || session?.user?.role !== "ADMIN") {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {t("title")}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                    {t("subtitle")}
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                {loading ? (
                    <div className="p-8 text-center">
                        <p className="text-zinc-600 dark:text-zinc-400">
                            {tCommon("loading")}
                        </p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-zinc-600 dark:text-zinc-400">
                            {t("loadError")}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        {t("table.user")}
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        {t("table.role")}
                                    </th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                                        {t("table.registered")}
                                    </th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-white">
                                        {t("table.actions")}
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {users.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-zinc-900 dark:text-white">
                                                {user.username}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-zinc-600 dark:text-zinc-400">
                                                {user.email}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                                    user.role === "ADMIN"
                                                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300"
                                                }`}
                                            >
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {new Date(user.createdAt).toLocaleDateString(locale, { timeZone: "Europe/Warsaw" })}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {user.role !== "ADMIN" && (
                                                    <button
                                                        onClick={() =>
                                                            openConfirmDialog(
                                                                "promote",
                                                                user.id,
                                                                user.username
                                                            )
                                                        }
                                                        className="whitespace-nowrap px-3 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                                                    >
                                                        {t("promoteToAdmin")}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        openConfirmDialog("changePassword", user.id, user.username)
                                                    }
                                                    className="whitespace-nowrap px-3 py-1 bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 text-white text-sm font-medium rounded transition-colors"
                                                >
                                                    {t("changePassword")}
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        openConfirmDialog("delete", user.id, user.username)
                                                    }
                                                    className="whitespace-nowrap px-3 py-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded transition-colors"
                                                >
                                                    {t("deleteUser")}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                {t("pagination.pageOf", { page, totalPages })}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                                >
                                    {t("pagination.previous")}
                                </button>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                                >
                                    {t("pagination.next")}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Confirmation Dialog */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 max-w-sm w-full border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
                            {confirmDialog.action === "delete"
                                ? t("dialog.deleteTitle")
                                : confirmDialog.action === "promote"
                                    ? t("dialog.promoteTitle")
                                    : t("dialog.passwordTitle", { username: confirmDialog.username })}
                        </h3>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            {confirmDialog.action === "delete"
                                ? t("dialog.deleteConfirm", { username: confirmDialog.username })
                                : confirmDialog.action === "promote"
                                    ? t("dialog.promoteConfirm", { username: confirmDialog.username })
                                    : t("dialog.newPasswordLabel")}
                        </p>
                        {confirmDialog.action === "changePassword" && (
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full mb-3 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                                placeholder="••••••••"
                            />
                        )}
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={closeConfirmDialog}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t("dialog.cancelButton")}
                            </button>
                            <button
                                onClick={() => void handleConfirm()}
                                disabled={actionLoading || (confirmDialog.action === "changePassword" && password.trim().length < 8)}
                                className={`px-4 py-2 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    confirmDialog.action === "delete"
                                        ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                                        : confirmDialog.action === "promote"
                                            ? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                                            : "bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600"
                                }`}
                            >
                                {actionLoading ? t("dialog.saving") : t("dialog.confirmButton")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}