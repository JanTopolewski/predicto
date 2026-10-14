import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/competitions/[id]/racing/sessions/[sessionId]/calculate-points/route";
import { asAdmin, asAnon, asUser, calls, ctx, db } from "../helpers";

const call = () => POST(new Request("http://x") as never, ctx({ id: "c1", sessionId: "s1" }));

// Wynik: A=P1, B=P2, C=P3, D=P4
const RESULTS = ["A", "B", "C", "D"].map((driverId, i) => ({ driverId, position: i + 1 }));

type Pred = Partial<{
    firstDriverId: string;
    secondDriverId: string;
    thirdDriverId: string;
    wildcardDriverId: string;
    wildcardPosition: number;
    points: number;
}>;

function setup(
    predictions: Pred[],
    opts: { type?: string; results?: unknown[]; rules?: Record<string, number> | null } = {}
) {
    asAdmin("admin1");
    db.racingSession.findUnique.mockResolvedValue({
        id: "s1",
        type: opts.type ?? "RACE",
        weekend: { season: { competition: { id: "c1", createdBy: "admin1" } } },
        results: opts.results ?? RESULTS,
        predictions: predictions.map((p, i) => ({ id: `p${i}`, userId: `u${i}`, points: 0, ...p })),
    });
    db.competitionScoring.findUnique.mockResolvedValue(opts.rules ?? null);
}

const podium = (a: string, b: string, c: string): Pred => ({
    firstDriverId: a,
    secondDriverId: b,
    thirdDriverId: c,
});
const awarded = () => calls(db.racingPrediction.update)[0].data.points;

describe("racing calculate-points: podium (RACE / SPRINT)", () => {
    it.each([
        ["A", "B", "C", 9, "komplet dokładnie"],
        ["A", "B", "D", 6, "2 dokładnie, 3. poza podium"],
        ["B", "A", "C", 5, "zamienione P1/P2 (1+1) + P3 dokładnie (3)"],
        ["D", "A", "B", 2, "kierowca z podium na złym miejscu liczy się, P4 nie"],
        ["D", "X", "Y", 0, "nic nie trafione"],
    ])("typ %s-%s-%s => %i pkt (%s)", async (a, b, c, expected) => {
        setup([podium(a, b, c)]);
        await call();
        expect(awarded()).toBe(expected);
    });

    it("SPRINT jest punktowany jak wyścig", async () => {
        setup([podium("A", "B", "C")], { type: "SPRINT" });
        await call();
        expect(awarded()).toBe(9);
    });

    it.each(["QUALIFYING", "PRACTICE1", "SPRINT_QUALIFYING"])(
        "%s ignoruje podium (tylko wildcard)",
        async (type) => {
            setup([podium("A", "B", "C")], { type });
            await call();
            expect(awarded()).toBe(0);
        }
    );

    it("niekompletne podium nie daje punktów", async () => {
        setup([{ firstDriverId: "A", secondDriverId: "B" }]);
        await call();
        expect(awarded()).toBe(0);
    });

    it("używa reguł punktacji konkurencji", async () => {
        setup([podium("A", "B", "C")], { rules: { podiumExactPoints: 5, podiumAnyPoints: 2 } });
        await call();
        expect(awarded()).toBe(15);
    });
});

describe("racing calculate-points: wildcard", () => {
    it.each([
        [4, 2, "dokładna pozycja"],
        [2, 1, "różnica 2 miejsc => połowa"],
        [6, 1, "różnica 2 miejsc w drugą stronę"],
        [1, 0, "różnica 3 miejsc"],
    ])("D jest P4, typ pozycji %i => %i pkt (%s)", async (wildcardPosition, expected) => {
        setup([{ wildcardDriverId: "D", wildcardPosition }], { type: "QUALIFYING" });
        await call();
        expect(awarded()).toBe(expected);
    });

    it("kierowca bez wyniku (nie ukończył) nie daje punktów", async () => {
        setup([{ wildcardDriverId: "Z", wildcardPosition: 4 }], { type: "QUALIFYING" });
        await call();
        expect(awarded()).toBe(0);
    });

    it("podium + wildcard sumują się", async () => {
        setup([{ ...podium("A", "B", "C"), wildcardDriverId: "D", wildcardPosition: 4 }]);
        await call();
        expect(awarded()).toBe(11);
    });

    // BUG: `|| 2` zamienia skonfigurowane 0 na domyślne 2.
    it.fails("BUG: wildcardPoints=0 nie wraca do domyślnej 2", async () => {
        setup([{ wildcardDriverId: "D", wildcardPosition: 4 }], {
            type: "QUALIFYING",
            rules: { wildcardPoints: 0 },
        });
        await call();
        expect(awarded()).toBe(0);
    });
});

describe("racing calculate-points: stan i autoryzacja", () => {
    it("oznacza sesję jako rozliczoną i dolicza punkty członkom", async () => {
        setup([podium("A", "B", "C")]);
        await call();
        expect(calls(db.racingSession.update)[0].data).toEqual({ resolved: true });
        expect(calls(db.competitionMember.update)[0].data.points.increment).toBe(9);
    });

    it("jest idempotentne - brak zmian rankingu przy ponownym przeliczeniu", async () => {
        setup([{ ...podium("A", "B", "C"), points: 9 }]);
        await call();
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("400 gdy brak wyników", async () => {
        setup([podium("A", "B", "C")], { results: [] });
        expect((await call()).status).toBe(400);
        expect(db.racingPrediction.update).not.toHaveBeenCalled();
    });

    it("403 dla anonima, usera i obcego admina", async () => {
        asAnon();
        expect((await call()).status).toBe(403);
        asUser();
        expect((await call()).status).toBe(403);
        setup([]);
        asAdmin("obcy");
        expect((await call()).status).toBe(403);
    });

    it("404 gdy sesja z innej konkurencji", async () => {
        setup([]);
        db.racingSession.findUnique.mockResolvedValue({
            weekend: { season: { competition: { id: "inna", createdBy: "admin1" } } },
        });
        expect((await call()).status).toBe(404);
    });
});

