"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BellIcon, BellSlashIcon } from "@/components/Icons";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationToggle() {
  const t = useTranslations("notifications");
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    } else {
      setIsSupported(false);
      setLoading(false);
    }
  }, []);

  const checkSubscription = async () => {
    try {
      setLoading(true);
      const registration = await navigator.serviceWorker.getRegistration();

      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(Boolean(subscription));
      } else {
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error("Error checking push subscription:", err);
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!isSupported || loading) return;

    setErrorMsg(null);
    setLoading(true);

    try {
      if (isSubscribed) {
        // DISABLE NOTIFICATIONS
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();

          if (subscription) {
            const endpoint = subscription.endpoint;
            await subscription.unsubscribe();

            await fetch("/api/push/subscriptions", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint }),
            });
          }
        }
        setIsSubscribed(false);
      } else {
        // ENABLE NOTIFICATIONS
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setErrorMsg(t("permissionDenied"));
          setLoading(false);
          return;
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register("/sw.js");

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          throw new Error("VAPID public key not configured");
        }

        const convertedVapidKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });

        const subJson = subscription.toJSON();

        const res = await fetch("/api/push/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to save subscription on server");
        }

        setIsSubscribed(true);
      }
    } catch (err: unknown) {
      console.error("Notification toggle error:", err);
      setErrorMsg(t("permissionDenied"));
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleToggle}
        disabled={loading}
        title={isSubscribed ? t("disable") : t("enable")}
        aria-label={isSubscribed ? t("disable") : t("enable")}
        className={`p-2 rounded-lg transition-colors flex items-center justify-center relative ${
          isSubscribed
            ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
        } ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {isSubscribed ? (
          <>
            <BellIcon className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-900" />
          </>
        ) : (
          <BellSlashIcon className="w-5 h-5" />
        )}
      </button>

      {errorMsg && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 text-xs text-red-700 bg-red-100 dark:bg-red-950/80 dark:text-red-300 rounded shadow-sm whitespace-nowrap z-50">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

