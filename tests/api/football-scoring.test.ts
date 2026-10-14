import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/competitions/[id]/matches/[matchId]/calculate-points/route";
import { asAdmin, asAnon, asUser, ctx, db, calls } from "../helpers";

const call = () => POST(new Request("http://x") as never, ctx({ id: "c1", matchId: "m1" }));

type P = { id: string; userId: string; homeGoals: number; awayGoals: number; points?: number };

function setup(
    result: { homeGoals: number | null; awayGoals: number | null; resolved?: boolean },
    predictions: P[],
    rules: Record<string, number> | null = null,
    over: Record<string, unknown> = {}
) {
    asAdmin("admin1");
    db.footballMatch.findUnique.mockResolvedValue({
        id: "m1",
        resolved: true,
        ...result,
        season: { competitionId: "c1", competition: { createdBy: "admin1" } },
        predictions,
        ...over,
    });
    db.competitionScoring.findUnique.mockResolvedValue(rules);
}

const pred = (homeGoals: number, awayGoals: number, points = 0): P => ({
    id: "p1",
    userId: "u1",
    homeGoals,
    awayGoals,
    points,
});

const awarded = () => calls(db.footballPrediction.update)[0]?.data.points;

describe("football calculate-points: reguły punktacji", () => {
    it.each([
        // wynik 2:1
        [2, 1, 3, "dokładny wynik"],
        [3, 0, 1, "trafiony zwycięzca gospodarzy"],
        [1, 0, 1, "trafiony zwycięzca gospodarzy"],
        [0, 0, 0, "remis przy zwycięstwie gospodarzy"],
        [1, 2, 0, "zwycięzca przeciwny"],
        [0, 3, 0, "zwycięzca przeciwny"],
    ])("wynik 2:1, typ %i:%i => %i pkt (%s)", async (h, a, expected) => {
        setup({ homeGoals: 2, awayGoals: 1 }, [pred(h, a)]);
        await call();
        expect(awarded()).toBe(expected);
    });

    it.each([
        [1, 1, 3],
        [0, 0, 1],
        [3, 3, 1],
        [1, 0, 0],
        [0, 1, 0],
    ])("wynik 1:1 (remis), typ %i:%i => %i pkt", async (h, a, expected) => {
        setup({ homeGoals: 1, awayGoals: 1 }, [pred(h, a)]);
        await call();
        expect(awarded()).toBe(expected);
    });

    it("0:0 trafione dokładnie daje exact, nie exact+winner", async () => {
        setup({ homeGoals: 0, awayGoals: 0 }, [pred(0, 0)]);
        await call();
        expect(awarded()).toBe(3);
    });

    it("używa reguł punktacji konkurencji", async () => {
        setup({ homeGoals: 2, awayGoals: 1 }, [pred(2, 1)], { exactScorePoints: 7, winnerPoints: 4 });
        await call();
        expect(awarded()).toBe(7);
    });

    // BUG: `scoringRules?.x || 3` - wartość 0 jest traktowana jak brak i zamieniana na domyślną.
    it.fails("BUG: skonfigurowane 0 pkt za zwycięzcę nie wraca do domyślnej 1", async () => {
        setup({ homeGoals: 2, awayGoals: 1 }, [pred(3, 0)], { exactScorePoints: 3, winnerPoints: 0 });
        await call();
        expect(awarded()).toBe(0);
    });
});

describe("football calculate-points: ranking użytkowników (CompetitionMember.points)", () => {
    const memberIncrements = () =>
        calls(db.competitionMember.update).map((c) => c.data.points.increment);

    it("dolicza punkty do członka", async () => {
        setup({ homeGoals: 2, awayGoals: 1 }, [pred(2, 1)]);
        await call();
        expect(memberIncrements()).toEqual([3]);
    });

    it("ponowne przeliczenie jest idempotentne (brak podwójnego naliczenia)", async () => {
        setup({ homeGoals: 2, awayGoals: 1 }, [pred(2, 1, 3)]);
        await call();
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("po korekcie wyniku odejmuje wcześniej przyznane punkty", async () => {
        // admin poprawił wynik na 0:0, wcześniej typ 2:1 dostał 3 pkt
        setup({ homeGoals: 0, awayGoals: 0 }, [pred(2, 1, 3)]);
        await call();
        expect(memberIncrements()).toEqual([-3]);
    });
});

describe("football calculate-points: autoryzacja i stan", () => {
    it("403 bez sesji / dla zwykłego użytkownika", async () => {
        asAnon();
        expect((await call()).status).toBe(403);
        asUser();
        expect((await call()).status).toBe(403);
        expect(db.footballMatch.findUnique).not.toHaveBeenCalled();
    });

    it("403 dla admina, który nie jest twórcą konkurencji", async () => {
        setup({ homeGoals: 1, awayGoals: 0 }, [pred(1, 0)]);
        asAdmin("inny-admin");
        expect((await call()).status).toBe(403);
        expect(db.footballPrediction.update).not.toHaveBeenCalled();
    });

    it("404 gdy mecz z innej konkurencji", async () => {
        setup({ homeGoals: 1, awayGoals: 0 }, [], null, {
            season: { competitionId: "inna", competition: { createdBy: "admin1" } },
        });
        expect((await call()).status).toBe(404);
    });

    it("400 gdy wynik nie został ustawiony", async () => {
        setup({ homeGoals: null, awayGoals: null, resolved: false }, [pred(1, 0)], null, {
            resolved: false,
        });
        expect((await call()).status).toBe(400);
        expect(db.footballPrediction.update).not.toHaveBeenCalled();
    });
});

