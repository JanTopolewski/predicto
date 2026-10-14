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
    db.wildcard.findFirst.mockResolvedValue({ driverId: "D" });
    db.racingPrediction.upsert.mockImplementation(async (a: any) => a.create);
}

const ok = { firstDriver: "A", secondDriver: "B", thirdDriver: "C" };
const upserted = () => db.racingPrediction.upsert.mock.calls[0][0];

describe("POST racing predictions", () => {
    it("401 bez sesji", async () => {
        asAnon();
        expect((await call(ok)).status).toBe(401);
    });

    it("403 dla nie-członka", async () => {
        setup();
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await call(ok)).status).toBe(403);
    });

    it("404 dla sesji z innej konkurencji", async () => {
        setup({ weekend: { season: { competition: { id: "inna" } } } });
        expect((await call(ok)).status).toBe(404);
    });

    it("zapisuje poprawne podium dla użytkownika z sesji", async () => {
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
        ["rozliczona sesja", { resolved: true }],
        ["rozpoczęta sesja", { startTime: PAST() }],
        ["zamknięte głosowanie", { votingClosedAt: PAST() }],
    ])("400: %s", async (_n, over) => {
        setup(over);
        expect((await call(ok)).status).toBe(400);
        expect(db.racingPrediction.upsert).not.toHaveBeenCalled();
    });

    it.each([
        ["niekompletne podium", { firstDriver: "A", secondDriver: "B" }],
        ["ten sam kierowca dwa razy", { firstDriver: "A", secondDriver: "A", thirdDriver: "C" }],
        ["kierowca spoza sesji", { firstDriver: "A", secondDriver: "B", thirdDriver: "ZZZ" }],
        ["pusty typ", {}],
        ["wildcard poza zakresem (0 → brak, 5 > liczba kierowców)", { wildcardPosition: 5 }],
        ["wildcard ułamkowy", { wildcardPosition: 1.5 }],
        ["wildcard ujemny", { wildcardPosition: -1 }],
        ["wildcard jako string", { wildcardPosition: "2" }],
    ])("400: %s", async (_n, body) => {
        setup();
        expect((await call(body)).status).toBe(400);
        expect(db.racingPrediction.upsert).not.toHaveBeenCalled();
    });

    it("kierowca wildcard pochodzi z sesji (ustawia admin), nie z body", async () => {
        setup();
        await call({ ...ok, wildcardPosition: 2, wildcardDriver: "A", wildcardDriverId: "A" });
        expect(upserted().create.wildcardDriverId).toBe("D");
        expect(upserted().create.wildcardPosition).toBe(2);
    });

    it("sesja bez podium (kwalifikacje): pola podium są zerowane, wildcard działa", async () => {
        setup({ type: "QUALIFYING" });
        expect((await call({ ...ok, wildcardPosition: 3 })).status).toBe(201);
        expect(upserted().create).toMatchObject({
            firstDriverId: null,
            secondDriverId: null,
            thirdDriverId: null,
            wildcardPosition: 3,
        });
    });

    it("kwalifikacje: samo podium bez wildcard jest odrzucone", async () => {
        setup({ type: "QUALIFYING" });
        expect((await call(ok)).status).toBe(400);
    });
});

