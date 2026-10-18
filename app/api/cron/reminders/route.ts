import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpush } from "@/lib/webPush";
import { NotificationStage, NotificationTargetType } from "@prisma/client";

// Prevent timeouts in Serverless environments
export const dynamic = "force-dynamic";

interface LocalizedText {
  pl: string;
  en: string;
}

interface PushPayload {
  title: string | LocalizedText;
  body: string | LocalizedText;
  url: string;
}

async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  userSubscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[]
) {
  const payloadString = JSON.stringify(payload);
  const sendPromises = userSubscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payloadString
      );
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      // If subscription expired or was unsubscribed by the browser (404 / 410)
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error(`Failed to send push to subscription ${sub.id}:`, err);
      }
    }
  });

  await Promise.allSettled(sendPromises);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Cron secret exclusively via Authorization header
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const plus4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const plus20Hours = new Date(now.getTime() + 20 * 60 * 60 * 1000);
    const plus24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let sentCount = 0;

    // -------------------------------------------------------------------------
    // 2. FOOTBALL MATCHES
    // -------------------------------------------------------------------------

    // Fetch upcoming scheduled matches within the 24h window
    const upcomingMatches = await prisma.footballMatch.findMany({
      where: {
        status: "SCHEDULED",
        resolved: false,
        kickoff: {
          gt: now,
          lte: plus24Hours,
        },
        OR: [
          { votingClosedAt: null },
          { votingClosedAt: { gt: now } },
        ],
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        season: {
          include: {
            competition: {
              include: {
                members: {
                  include: {
                    user: {
                      include: {
                        pushSubscriptions: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        predictions: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (upcomingMatches.length > 0) {
      // Batch fetch existing logs for all upcoming matches to prevent N+1 queries
      const matchIds = upcomingMatches.map((m) => m.id);
      const existingMatchLogs = await prisma.notificationLog.findMany({
        where: {
          targetId: { in: matchIds },
          type: "MATCH",
        },
        select: { userId: true, targetId: true, stage: true },
      });

      const notifiedMatchSet = new Set(
        existingMatchLogs.map((l) => `${l.targetId}:${l.userId}:${l.stage}`)
      );

      const matchPushTasks: Array<() => Promise<void>> = [];

      for (const match of upcomingMatches) {
        const isLateStage = match.kickoff <= plus4Hours;
        const stage: NotificationStage = isLateStage ? "LATE" : "EARLY";

        // Set of user IDs who have already submitted a prediction
        const usersWithPrediction = new Set(match.predictions.map((p) => p.userId));
        const members = match.season.competition.members;
        const competitionId = match.season.competitionId;

        for (const member of members) {
          const userId = member.userId;
          const userSubs = member.user.pushSubscriptions;
          const key = `${match.id}:${userId}:${stage}`;

          // Conditions: has push subscription, has not voted, has not been notified yet
          if (
            userSubs.length > 0 &&
            !usersWithPrediction.has(userId) &&
            !notifiedMatchSet.has(key)
          ) {
            notifiedMatchSet.add(key);

            const home = match.homeTeam.shortName || match.homeTeam.name;
            const away = match.awayTeam.shortName || match.awayTeam.name;

            const title: LocalizedText =
              stage === "EARLY"
                ? { pl: "Mecz za 1 dzień!", en: "Match in 1 day!" }
                : { pl: "Mecz za 4 godziny!", en: "Match in 4 hours!" };

            const body: LocalizedText =
              stage === "EARLY"
                ? {
                    pl: `Jutro mecz ${home} vs ${away}. Nie zapomnij oddać typu!`,
                    en: `Tomorrow: ${home} vs ${away}. Don't forget to submit your prediction!`,
                  }
                : {
                    pl: `Zostały ostatnie godziny na typowanie meczu ${home} vs ${away}!`,
                    en: `Only a few hours left to predict ${home} vs ${away}!`,
                  };

            matchPushTasks.push(async () => {
              await sendPushToUser(
                userId,
                {
                  title,
                  body,
                  url: `/dashboard/competitions/${competitionId}/matches`,
                },
                userSubs
              );

              try {
                await prisma.notificationLog.create({
                  data: {
                    userId,
                    type: "MATCH",
                    targetId: match.id,
                    stage: stage,
                  },
                });
                sentCount++;
              } catch {
                // Ignore unique constraint collision (race condition)
              }
            });
          }
        }
      }

      // Execute tasks concurrently in parallel batches
      await Promise.allSettled(matchPushTasks.map((task) => task()));
    }

    // -------------------------------------------------------------------------
    // 3. RACING SESSIONS
    // -------------------------------------------------------------------------

    // Fetch upcoming sessions within the 20h window
    const upcomingSessions = await prisma.racingSession.findMany({
      where: {
        resolved: false,
        startTime: {
          gt: now,
          lte: plus20Hours,
        },
        OR: [
          { votingClosedAt: null },
          { votingClosedAt: { gt: now } },
        ],
      },
      include: {
        weekend: {
          include: {
            season: {
              include: {
                competition: {
                  include: {
                    members: {
                      include: {
                        user: {
                          include: {
                            pushSubscriptions: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        predictions: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (upcomingSessions.length > 0) {
      // Batch fetch existing logs for all upcoming racing sessions
      const sessionIds = upcomingSessions.map((s) => s.id);
      const existingSessionLogs = await prisma.notificationLog.findMany({
        where: {
          targetId: { in: sessionIds },
          type: "RACING_SESSION",
        },
        select: { userId: true, targetId: true, stage: true },
      });

      const notifiedSessionSet = new Set(
        existingSessionLogs.map((l) => `${l.targetId}:${l.userId}:${l.stage}`)
      );

      const sessionPushTasks: Array<() => Promise<void>> = [];

      for (const session of upcomingSessions) {
        const isLateStage = session.startTime <= plus4Hours;
        const stage: NotificationStage = isLateStage ? "LATE" : "EARLY";

        const usersWithPrediction = new Set(session.predictions.map((p) => p.userId));
        const members = session.weekend.season.competition.members;
        const competitionId = session.weekend.season.competitionId;
        const gpName = session.weekend.grandPrix;

        for (const member of members) {
          const userId = member.userId;
          const userSubs = member.user.pushSubscriptions;
          const key = `${session.id}:${userId}:${stage}`;

          if (
            userSubs.length > 0 &&
            !usersWithPrediction.has(userId) &&
            !notifiedSessionSet.has(key)
          ) {
            notifiedSessionSet.add(key);

            const title: LocalizedText =
              stage === "EARLY"
                ? { pl: "Sesja wyścigowa za 20 godzin!", en: "Racing session in 20 hours!" }
                : { pl: "Sesja wyścigowa za 4 godziny!", en: "Racing session in 4 hours!" };

            const body: LocalizedText =
              stage === "EARLY"
                ? {
                    pl: `Przed nami ${gpName} (${session.name}). Nie zapomnij oddać typu!`,
                    en: `Upcoming: ${gpName} (${session.name}). Don't forget to submit your prediction!`,
                  }
                : {
                    pl: `Zostały 4 godziny do startu ${gpName} (${session.name}). Oddaj swój typ!`,
                    en: `Only 4 hours left until ${gpName} (${session.name}). Submit your prediction!`,
                  };

            sessionPushTasks.push(async () => {
              await sendPushToUser(
                userId,
                {
                  title,
                  body,
                  url: `/dashboard/competitions/${competitionId}/racing`,
                },
                userSubs
              );

              try {
                await prisma.notificationLog.create({
                  data: {
                    userId,
                    type: "RACING_SESSION",
                    targetId: session.id,
                    stage: stage,
                  },
                });
                sentCount++;
              } catch {
                // Ignore unique constraint collisions
              }
            });
          }
        }
      }

      // Execute tasks concurrently in parallel batches
      await Promise.allSettled(sessionPushTasks.map((task) => task()));
    }

    return NextResponse.json({
      success: true,
      sentNotifications: sentCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Cron reminders error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 }
    );
  }
}