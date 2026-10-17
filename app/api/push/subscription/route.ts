import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError, unauthorized } from "@/lib/api";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized();
    }

    const count = await prisma.pushSubscription.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      subscribed: count > 0,
      count,
    });
  } catch (error) {
    console.error("GET /api/push/subscription error:", error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized();
    }

    const body = await request.json();
    const { endpoint, keys } = body || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return apiError(400, "INVALID_SUBSCRIPTION", "Invalid subscription data");
    }

    // Save or update subscription for this endpoint
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        userId: session.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ success: true, id: subscription.id });
  } catch (error) {
    console.error("POST /api/push/subscription error:", error);
    return internalError();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized();
    }

    const body = await request.json().catch(() => ({}));
    const { endpoint } = body;

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint,
          userId: session.user.id,
        },
      });
    } else {
      // If no specific endpoint provided, remove all subscriptions for this user
      await prisma.pushSubscription.deleteMany({
        where: {
          userId: session.user.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/push/subscription error:", error);
    return internalError();
  }
}
