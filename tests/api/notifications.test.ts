import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET as getSubscription, POST as postSubscription, DELETE as deleteSubscription } from "../../app/api/push/subscription/route";
import { POST as cronReminders } from "../../app/api/cron/reminders/route";
import { asAnon, asUser, db, jsonReq } from "../helpers";
import { NextRequest } from "next/server";

// Mock web-push module
vi.mock("@/lib/webPush", () => ({
  webpush: {
    sendNotification: vi.fn().mockResolvedValue({}),
    setVapidDetails: vi.fn(),
  },
}));

describe("Push Subscriptions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated user", async () => {
    asAnon();
    const res = await getSubscription();
    expect(res.status).toBe(401);

    const postRes = await postSubscription(jsonReq({ endpoint: "ep", keys: { p256dh: "k", auth: "a" } }));
    expect(postRes.status).toBe(401);
  });

  it("saves subscription for authenticated user", async () => {
    asUser("user1");
    db.pushSubscription.upsert.mockResolvedValue({ id: "sub1" });

    const req = jsonReq({
      endpoint: "https://push.service/endpoint1",
      keys: { p256dh: "key1", auth: "auth1" },
    });

    const res = await postSubscription(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(db.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: "https://push.service/endpoint1" },
      })
    );
  });

  it("unsubscribes user device", async () => {
    asUser("user1");
    db.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

    const req = jsonReq({ endpoint: "https://push.service/endpoint1" }, "DELETE");
    const res = await deleteSubscription(req);
    expect(res.status).toBe(200);
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: {
        endpoint: "https://push.service/endpoint1",
        userId: "user1",
      },
    });
  });
});

describe("Cron Reminders API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret-token";
  });

  it("returns 401 when CRON_SECRET is invalid", async () => {
    const req = new NextRequest("http://localhost/api/cron/reminders", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });

    const res = await cronReminders(req);
    expect(res.status).toBe(401);
  });

  it("processes matches and sends notifications to users without predictions", async () => {
    const { webpush } = await import("@/lib/webPush");

    const req = new NextRequest("http://localhost/api/cron/reminders", {
      method: "POST",
      headers: { authorization: "Bearer secret-token" },
    });

    // Match in 20 hours (EARLY stage)
    const kickoff = new Date(Date.now() + 20 * 60 * 60 * 1000);

    db.footballMatch.findMany.mockResolvedValue([
      {
        id: "match1",
        kickoff,
        homeTeam: { name: "Arsenal", shortName: "ARS" },
        awayTeam: { name: "Chelsea", shortName: "CHE" },
        season: {
          competitionId: "comp1",
          competition: {
            members: [
              {
                userId: "user1",
                user: {
                  pushSubscriptions: [{ id: "sub1", endpoint: "ep1", p256dh: "k", auth: "a" }],
                },
              },
              {
                userId: "user2",
                user: {
                  pushSubscriptions: [{ id: "sub2", endpoint: "ep2", p256dh: "k", auth: "a" }],
                },
              },
            ],
          },
        },
        predictions: [{ userId: "user2" }], // user2 has already voted
      },
    ]);

    db.notificationLog.findMany.mockResolvedValue([]); // no one has received a log yet
    db.notificationLog.create.mockResolvedValue({ id: "log1" });
    db.racingSession.findMany.mockResolvedValue([]);

    const res = await cronReminders(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.sentNotifications).toBe(1);

    // Notification should be sent to user1, but NOT user2
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(db.notificationLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user1",
        type: "MATCH",
        targetId: "match1",
        stage: "EARLY",
      },
    });
  });

  it("does not send duplicate notifications if log exists", async () => {
    const { webpush } = await import("@/lib/webPush");

    const req = new NextRequest("http://localhost/api/cron/reminders", {
      method: "POST",
      headers: { authorization: "Bearer secret-token" },
    });

    const kickoff = new Date(Date.now() + 20 * 60 * 60 * 1000);

    db.footballMatch.findMany.mockResolvedValue([
      {
        id: "match1",
        kickoff,
        homeTeam: { name: "Arsenal", shortName: "ARS" },
        awayTeam: { name: "Chelsea", shortName: "CHE" },
        season: {
          competitionId: "comp1",
          competition: {
            members: [
              {
                userId: "user1",
                user: {
                  pushSubscriptions: [{ id: "sub1", endpoint: "ep1", p256dh: "k", auth: "a" }],
                },
              },
            ],
          },
        },
        predictions: [],
      },
    ]);

    // Użytkownik ma już log wysłania
    db.notificationLog.findMany.mockResolvedValue([{ userId: "user1" }]);
    db.racingSession.findMany.mockResolvedValue([]);

    const res = await cronReminders(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sentNotifications).toBe(0);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});

