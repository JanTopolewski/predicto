import { describe, expect, it } from "vitest";
import { POST as announce } from "../../app/api/competitions/[id]/racing/season-winner/announce/route";
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

    it("403: anonim, user, obcy admin", async () => {
        asAnon();
        expect((await call()).status).toBe(403);
        asUser();
        expect((await call()).status).toBe(403);
        setup();
        asAdmin("obcy");
        expect((await call()).status).toBe(403);
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("nagradza dokładnie tych, którzy trafili zwycięzcę (domyślnie 10 pkt)", async () => {
        setup();
        const res = await call();
        expect(res.status).toBe(200);
        const updates = calls(db.competitionMember.update);
        expect(updates.map((u) => u.where.competitionId_userId.userId).sort()).toEqual(["u1", "u3"]);
        expect(updates.every((u) => u.data.points.increment === 10)).toBe(true);
    });

    it("400 przy ponownym ogłoszeniu (flaga winnerResolved)", async () => {
        setup({ winnerResolved: true });
        expect((await call()).status).toBe(400);
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("wyścig równoległych żądań: przegrany request nie dolicza punktów drugi raz", async () => {
        setup();
        db.competition.updateMany.mockResolvedValue({ count: 0 }); // ktoś był pierwszy
        const res = await call();
        expect(res.status).toBe(400);
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("400 gdy kierowca nie jedzie w tym sezonie, 400 bez driverId", async () => {
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

    it("403 dla nie-admina", async () => {
        asUser();
        expect((await call({ results: [{ driverId: "A", position: 1 }] })).status).toBe(403);
    });

    it.each([
        ["brak wyników", { results: [] }],
        ["nie-tablica", { results: "A" }],
        ["kierowca spoza sesji", { results: [{ driverId: "Z", position: 1 }] }],
        [
            "duplikat kierowcy",
            {
                results: [
                    { driverId: "A", position: 1 },
                    { driverId: "A", position: 2 },
                ],
            },
        ],
        [
            "duplikat pozycji",
            {
                results: [
                    { driverId: "A", position: 1 },
                    { driverId: "B", position: 1 },
                ],
            },
        ],
        ["pozycja 0", { results: [{ driverId: "A", position: 0 }] }],
        ["pozycja > liczba kierowców", { results: [{ driverId: "A", position: 4 }] }],
        ["pozycja ułamkowa", { results: [{ driverId: "A", position: 1.5 }] }],
    ])("400: %s - nic nie jest zapisane", async (_n, body) => {
        setup();
        expect((await call(body)).status).toBe(400);
        expect(db.racingResult.createMany).not.toHaveBeenCalled();
        expect(db.racingResult.deleteMany).not.toHaveBeenCalled();
    });

    it("zapisuje wyniki w transakcji (zastępuje stare) i zamyka głosowanie", async () => {
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

