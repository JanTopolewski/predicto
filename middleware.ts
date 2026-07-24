import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
    const session = await auth();
    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith("/dashboard")) {
        if (!session) {
            return NextResponse.redirect(
                new URL(`/auth/login?callbackUrl=${pathname}`, request.url)
            );
        }
    }

    if (pathname.startsWith("/auth/") && session) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/auth/:path*"],
};