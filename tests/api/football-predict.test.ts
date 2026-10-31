import { describe, expect, it } from "vitest";
import { GET, POST } from "../../app/api/competitions/[id]/matches/[matchId]/predictions/route";
import { asAnon, asUser, ctx, db, FUTURE, jsonReq, PAST } from "../helpers";

const params = ctx({ id: "c1", matchId: "m1" });
const call = (body: unknown) => POST(jsonReq(body), params);
const callGet = (url = "http://localhost/api/competitions/c1/matches/m1/predictions?scope=all") =>
    GET(jsonReq(undefined, "GET", url) as never, params);

function setup(matchOverrides: Record<string, unknown> = {}) {
    asUser("user1");
    db.competitionMember.findUnique.mockResolvedValue({ id: "mem1" });
    db.footballMatch.findUnique.mockResolvedValue({
        id: "m1",
        kickoff: FUTURE(),
        votingClosedAt: null,
        status: "SCHEDULED",
        season: { competitionId: "c1" },
        ...matchOverrides,
    });
    db.footballPrediction.upsert.mockImplementation(async (a: any) => a.create);
}

describe("POST football predict", () => {
    it("returns 401 without a session", async () => {
        asAnon();
        expect((await call({ homeGoals: 1, awayGoals: 0 })).status).toBe(401);
        expect(db.footballPrediction.upsert).not.toHaveBeenCalled();
    });

    it.each([
        [{}],
        [{ homeGoals: 1 }],
        [{ homeGoals: -1, awayGoals: 0 }],
        [{ homeGoals: 21, awayGoals: 0 }],
        [{ homeGoals: 1.5, awayGoals: 0 }],
        [{ homeGoals: "2", awayGoals: 0 }],
        [{ homeGoals: null, awayGoals: 0 }],
    ])("returns 400 for invalid goals %j", async (body) => {
        setup();
        expect((await call(body)).status).toBe(400);
        expect(db.footballPrediction.upsert).not.toHaveBeenCalled();
    });

    it("accepts boundary values 0 and 20", async () => {
        setup();
        expect((await call({ homeGoals: 0, awayGoals: 20 })).status).toBe(201);
    });

    it("returns 403 for a non-member of the competition", async () => {
        setup();
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await call({ homeGoals: 1, awayGoals: 1 })).status).toBe(403);
    });

    it("returns 404 when the match belongs to another competition (IDOR)", async () => {
        setup({ season: { competitionId: "INNA" } });
        expect((await call({ homeGoals: 1, awayGoals: 1 })).status).toBe(404);
        expect(db.footballPrediction.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 after kickoff", async () => {
        setup({ kickoff: PAST() });
        expect((await call({ homeGoals: 1, awayGoals: 1 })).status).toBe(400);
        expect(db.footballPrediction.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 once voting is closed, even before kickoff", async () => {
        setup({ votingClosedAt: PAST() });
        expect((await call({ homeGoals: 1, awayGoals: 1 })).status).toBe(400);
    });

    it("saves the prediction for the session user and ignores userId from the body", async () => {
        setup();
        const res = await call({ homeGoals: 2, awayGoals: 1, userId: "ofiara" });
        expect(res.status).toBe(201);
        const arg = db.footballPrediction.upsert.mock.calls[0][0];
        expect(arg.where.matchId_userId.userId).toBe("user1");
        expect(arg.create.userId).toBe("user1");
        expect(arg.create).not.toHaveProperty("points");
    });

    it.each([
        ["CANCELLED", { status: "CANCELLED" }],
        ["POSTPONED", { status: "POSTPONED" }],
        ["FINISHED", { status: "FINISHED" }],
        ["IN_PROGRESS", { status: "IN_PROGRESS" }],
        ["resolved match", { resolved: true }],
    ])("rejects predictions for a non-SCHEDULED or resolved match (%s)", async (_name, overrides) => {
        setup(overrides);
        expect((await call({ homeGoals: 1, awayGoals: 1 })).status).toBe(400);
        expect(db.footballPrediction.upsert).not.toHaveBeenCalled();
    });
});

describe("GET all football predictions for match", () => {
    it("returns 401 without session", async () => {
        asAnon();
        expect((await callGet()).status).toBe(401);
    });

    it("returns 403 when match has not started yet", async () => {
        asUser("user1");
        db.competition.findUnique.mockResolvedValue({ id: "c1", createdBy: "creator" });
        db.competitionMember.findUnique.mockResolvedValue({ id: "mem1" });
        db.footballMatch.findUnique.mockResolvedValue({
            id: "m1",
            kickoff: FUTURE(),
            resolved: false,
            season: { competitionId: "c1" },
            predictions: [],
        });
        const res = await callGet();
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.code).toBe("EVENT_NOT_STARTED");
    });

    it("returns only current user's prediction without scope=all", async () => {
        asUser("user1");
        db.competition.findUnique.mockResolvedValue({ id: "c1", createdBy: "creator" });
        db.competitionMember.findUnique.mockResolvedValue({ id: "mem1" });
        db.footballPrediction.findUnique.mockResolvedValue({
            id: "p1",
            userId: "user1",
            homeGoals: 2,
            awayGoals: 1,
            points: 0,
        });

        const res = await callGet("http://localhost/api/competitions/c1/matches/m1/predictions");
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.prediction).toMatchObject({ homeGoals: 2, awayGoals: 1 });
        expect(db.footballMatch.findUnique).not.toHaveBeenCalled();
    });

    it("returns predictions for all members after match kickoff", async () => {
        asUser("user1");
        db.competition.findUnique.mockResolvedValue({ id: "c1", createdBy: "creator" });
        db.competitionMember.findUnique.mockResolvedValue({ id: "mem1" });
        db.footballMatch.findUnique.mockResolvedValue({
            id: "m1",
            kickoff: PAST(),
            resolved: false,
            homeTeam: { name: "Home" },
            awayTeam: { name: "Away" },
            season: { competitionId: "c1" },
            predictions: [
                {
                    id: "p1",
                    userId: "user1",
                    homeGoals: 2,
                    awayGoals: 1,
                    points: 0,
                    user: { id: "user1", username: "User One" },
                },
            ],
        });
        db.competitionMember.findMany.mockResolvedValue([
            { userId: "user1", user: { id: "user1", username: "User One" } },
            { userId: "user2", user: { id: "user2", username: "User Two" } },
        ]);

        const res = await callGet();
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.predictions).toHaveLength(2);
        expect(data.predictions[0].user.username).toBe("User One");
        expect(data.predictions[0].prediction).toMatchObject({ homeGoals: 2, awayGoals: 1 });
        expect(data.predictions[1].user.username).toBe("User Two");
        expect(data.predictions[1].prediction).toBeNull();
    });
});
