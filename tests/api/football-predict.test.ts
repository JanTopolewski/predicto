import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/competitions/[id]/matches/[matchId]/predict/route";
import { asAnon, asUser, ctx, db, FUTURE, jsonReq, PAST } from "../helpers";

const params = ctx({ id: "c1", matchId: "m1" });
const call = (body: unknown) => POST(jsonReq(body), params);

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

    // BUG: match status is not checked - predictions are accepted for cancelled/postponed matches.
    it.fails("BUG: rejects a prediction for a CANCELLED match", async () => {
        setup({ status: "CANCELLED" });
        expect((await call({ homeGoals: 1, awayGoals: 1 })).status).toBe(400);
    });
});
