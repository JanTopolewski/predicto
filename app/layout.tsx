import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import React from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Predicto - Football & Racing Predictions",
    description: "App for football matches and racing predictions",
    icons: {
        icon: [
            { url: "/favicon.ico" },
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
        apple: [
            { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Predicto",
    },
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
        <head>
            <script
                dangerouslySetInnerHTML={{
                    __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (e) {}
            `,
                }}
            />
        </head>
        <body
            className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col`}
        >
        <NextIntlClientProvider locale={locale} messages={messages}>
            <Providers>{children}</Providers>
        </NextIntlClientProvider>
        </body>
        </html>
    );
}