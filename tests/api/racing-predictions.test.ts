import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/competitions/[id]/racing/sessions/[sessionId]/predictions/route";
import { asAnon, asUser, ctx, db, FUTURE, jsonReq, PAST } from "../helpers";

const call = (body: unknown) => POST(jsonReq(body), ctx({ id: "c1", sessionId: "s1" }));
const drivers = ["A", "B", "C", "D"].map((driverId) => ({ driverId }));

function setup(over: Record<string, unknown> = {}) {
    asUser("user1");
    db.competitionMember.findUnique.mockResolvedValue({ id: "m" });
    db.racingSession.findUnique.mockResolvedValue({
        id: "s1",
        type: "RACE",
        resolved: false,
        votingClosedAt: null,
        startTime: FUTURE(),
        weekend: { season: { competition: { id: "c1" } } },
        participants: drivers,
        ...over,
    });
    db.wildcard.findFirst.mockResolvedValue(null);
    db.racingPrediction.upsert.mockImplementation(async (a: any) => a.create);
}

const ok = { firstDriver: "A", secondDriver: "B", thirdDriver: "C" };
const upserted = () => db.racingPrediction.upsert.mock.calls[0][0];

describe("POST racing predictions", () => {
    it("returns 401 without a session", async () => {
        asAnon();
        expect((await call(ok)).status).toBe(401);
    });

    it("returns 403 for a non-member", async () => {
        setup();
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await call(ok)).status).toBe(403);
    });

    it("returns 404 for a session from another competition", async () => {
        setup({ weekend: { season: { competition: { id: "inna" } } } });
        expect((await call(ok)).status).toBe(404);
    });

    it("saves a valid podium for the session user", async () => {
        setup();
        expect((await call(ok)).status).toBe(201);
        expect(upserted().create).toMatchObject({
            userId: "user1",
            firstDriverId: "A",
            secondDriverId: "B",
            thirdDriverId: "C",
        });
    });

    it.each([
        ["resolved session", { resolved: true }],
        ["started session", { startTime: PAST() }],
        ["closed voting", { votingClosedAt: PAST() }],
    ])("returns 400: %s", async (_n, over) => {
        setup(over);
        expect((await call(ok)).status).toBe(400);
        expect(db.racingPrediction.upsert).not.toHaveBeenCalled();
    });

    it.each([
        ["incomplete podium", { firstDriver: "A", secondDriver: "B" }],
        ["same driver twice", { firstDriver: "A", secondDriver: "A", thirdDriver: "C" }],
        ["driver not in the session", { firstDriver: "A", secondDriver: "B", thirdDriver: "ZZZ" }],
        ["empty prediction", {}],
        ["wildcard position above the driver count", { wildcardPosition: 5 }],
        ["fractional wildcard position", { wildcardPosition: 1.5 }],
        ["negative wildcard position", { wildcardPosition: -1 }],
        ["wildcard position as a string", { wildcardPosition: "2" }],
    ])("returns 400: %s", async (_n, body) => {
        setup();
        expect((await call(body)).status).toBe(400);
        expect(db.racingPrediction.upsert).not.toHaveBeenCalled();
    });

    it("takes the wildcard driver from the session (admin-chosen), not from the body", async () => {
        setup();
        db.wildcard.findFirst.mockResolvedValue({ driverId: "D" });
        await call({ ...ok, wildcardPosition: 2, wildcardDriver: "A", wildcardDriverId: "A" });
        expect(upserted().create.wildcardDriverId).toBe("D");
        expect(upserted().create.wildcardPosition).toBe(2);
    });

    it("rejects prediction without wildcard if wildcard is configured for the session", async () => {
        setup();
        db.wildcard.findFirst.mockResolvedValue({ driverId: "D" });
        const res = await call(ok);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.code).toBe("WILDCARD_POSITION_REQUIRED");
    });

    it("non-podium session (qualifying): podium fields are nulled, wildcard works", async () => {
        setup({ type: "QUALIFYING" });
        expect((await call({ ...ok, wildcardPosition: 3 })).status).toBe(201);
        expect(upserted().create).toMatchObject({
            firstDriverId: null,
            secondDriverId: null,
            thirdDriverId: null,
            wildcardPosition: 3,
        });
    });

    it("qualifying: a podium without a wildcard is rejected", async () => {
        setup({ type: "QUALIFYING" });
        expect((await call(ok)).status).toBe(400);
    });
});
