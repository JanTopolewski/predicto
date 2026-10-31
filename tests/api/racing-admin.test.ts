import { describe, expect, it } from "vitest";
import { PUT as announce } from "../../app/api/competitions/[id]/racing/season-winner/route";
import { POST as results } from "../../app/api/competitions/[id]/racing/sessions/[sessionId]/results/route";
import { asAdmin, asAnon, asUser, calls, ctx, db, jsonReq } from "../helpers";

describe("racing season-winner announce", () => {
    const call = (body: unknown = { driverId: "A" }) =>
        announce(jsonReq(body), ctx({ id: "c1" }));

    function setup(over: Record<string, unknown> = {}) {
        asAdmin("owner");
        db.competition.findUnique.mockResolvedValue({
            id: "c1",
            type: "RACING",
            createdBy: "owner",
            winnerResolved: false,
            racingSeasons: [
                {
                    id: "rs1",
                    seasonWinnerPredictions: [
                        { userId: "u1", driverId: "A" },
                        { userId: "u2", driverId: "B" },
                        { userId: "u3", driverId: "A" },
                    ],
                },
            ],
            ...over,
        });
        db.driver.findUnique.mockResolvedValue({ id: "A", name: "Driver A" });
        db.racingSessionParticipant.findFirst.mockResolvedValue({ id: "part" });
        db.competitionScoring.findUnique.mockResolvedValue(null);
        db.competition.updateMany.mockResolvedValue({ count: 1 });
    }

    it("returns 403: anonymous, regular user, foreign admin", async () => {
        asAnon();
        expect((await call()).status).toBe(403);
        asUser();
        expect((await call()).status).toBe(403);
        setup();
        asAdmin("obcy");
        expect((await call()).status).toBe(403);
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("rewards exactly those who guessed the winner (default 10 pts)", async () => {
        setup();
        const res = await call();
        expect(res.status).toBe(200);
        const updates = calls(db.competitionMember.update);
        expect(updates.map((u) => u.where.competitionId_userId.userId).sort()).toEqual(["u1", "u3"]);
        expect(updates.every((u) => u.data.points.increment === 10)).toBe(true);
    });

    it("returns 400 on a repeated announcement (winnerResolved flag)", async () => {
        setup({ winnerResolved: true });
        expect((await call()).status).toBe(400);
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("concurrent requests: the losing request does not award points a second time", async () => {
        setup();
        db.competition.updateMany.mockResolvedValue({ count: 0 }); // someone else was first
        const res = await call();
        expect(res.status).toBe(400);
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the driver is not in this season / without driverId", async () => {
        setup();
        db.racingSessionParticipant.findFirst.mockResolvedValue(null);
        expect((await call()).status).toBe(400);
        expect((await call({})).status).toBe(400);
    });
});

describe("racing session results (admin)", () => {
    const call = (body: unknown) => results(jsonReq(body), ctx({ id: "c1", sessionId: "s1" }));

    function setup() {
        asAdmin("owner");
        db.racingSession.findUnique.mockResolvedValue({
            id: "s1",
            weekend: { season: { competition: { id: "c1", createdBy: "owner" } } },
            participants: ["A", "B", "C"].map((driverId) => ({ driverId })),
            wildcards: [],
        });
    }

    it("returns 403 for a non-admin", async () => {
        asUser();
        expect((await call({ results: [{ driverId: "A", position: 1 }] })).status).toBe(403);
    });

    it.each([
        ["no results", { results: [] }],
        ["not an array", { results: "A" }],
        ["driver not in the session", { results: [{ driverId: "Z", position: 1 }] }],
        [
            "duplicate driver",
            {
                results: [
                    { driverId: "A", position: 1 },
                    { driverId: "A", position: 2 },
                ],
            },
        ],
        [
            "duplicate position",
            {
                results: [
                    { driverId: "A", position: 1 },
                    { driverId: "B", position: 1 },
                ],
            },
        ],
        ["position 0", { results: [{ driverId: "A", position: 0 }] }],
        ["position above the driver count", { results: [{ driverId: "A", position: 4 }] }],
        ["fractional position", { results: [{ driverId: "A", position: 1.5 }] }],
    ])("returns 400: %s - nothing is saved", async (_n, body) => {
        setup();
        expect((await call(body)).status).toBe(400);
        expect(db.racingResult.createMany).not.toHaveBeenCalled();
        expect(db.racingResult.deleteMany).not.toHaveBeenCalled();
    });

    it("saves results in a transaction (replacing old ones) and closes voting", async () => {
        setup();
        const res = await call({
            results: [
                { driverId: "B", position: 1 },
                { driverId: "A", position: 2 },
            ],
        });
        expect(res.status).toBe(200);
        expect(db.racingResult.deleteMany).toHaveBeenCalledWith({ where: { sessionId: "s1" } });
        expect(db.racingResult.createMany.mock.calls[0][0].data).toEqual([
            { sessionId: "s1", driverId: "B", position: 1 },
            { sessionId: "s1", driverId: "A", position: 2 },
        ]);
        expect(calls(db.racingSession.update)[0].data.votingClosedAt).toBeInstanceOf(Date);
    });
});
