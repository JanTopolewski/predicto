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

describe("football calculate-points: scoring rules", () => {
    it.each([
        // actual result 2:1
        [2, 1, 3, "exact score"],
        [3, 0, 1, "correct home win"],
        [1, 0, 1, "correct home win"],
        [0, 0, 0, "draw predicted for a home win"],
        [1, 2, 0, "opposite winner"],
        [0, 3, 0, "opposite winner"],
    ])("actual 2:1, prediction %i:%i => %i pts (%s)", async (h, a, expected) => {
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
    ])("actual 1:1 (draw), prediction %i:%i => %i pts", async (h, a, expected) => {
        setup({ homeGoals: 1, awayGoals: 1 }, [pred(h, a)]);
        await call();
        expect(awarded()).toBe(expected);
    });

    it("an exact 0:0 gives exact points, not exact + winner", async () => {
        setup({ homeGoals: 0, awayGoals: 0 }, [pred(0, 0)]);
        await call();
        expect(awarded()).toBe(3);
    });

    it("uses the competition's scoring rules", async () => {
        setup({ homeGoals: 2, awayGoals: 1 }, [pred(2, 1)], { exactScorePoints: 7, winnerPoints: 4 });
        await call();
        expect(awarded()).toBe(7);
    });

    // BUG: `scoringRules?.x || 3` - a configured 0 is treated as missing and replaced by the default.
    it.fails("BUG: configured 0 winner points does not fall back to the default 1", async () => {
        setup({ homeGoals: 2, awayGoals: 1 }, [pred(3, 0)], { exactScorePoints: 3, winnerPoints: 0 });
        await call();
        expect(awarded()).toBe(0);
    });
});

describe("football calculate-points: member ranking (CompetitionMember.points)", () => {
    const memberIncrements = () =>
        calls(db.competitionMember.update).map((c) => c.data.points.increment);

    it("adds points to the member", async () => {
        setup({ homeGoals: 2, awayGoals: 1 }, [pred(2, 1)]);
        await call();
        expect(memberIncrements()).toEqual([3]);
    });

    it("recalculation is idempotent (no double-counting)", async () => {
        setup({ homeGoals: 2, awayGoals: 1 }, [pred(2, 1, 3)]);
        await call();
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("subtracts previously awarded points after a result correction", async () => {
        // admin corrected the result to 0:0, the 2:1 prediction previously got 3 pts
        setup({ homeGoals: 0, awayGoals: 0 }, [pred(2, 1, 3)]);
        await call();
        expect(memberIncrements()).toEqual([-3]);
    });
});

describe("football calculate-points: authorization and state", () => {
    it("returns 403 without a session / for a regular user", async () => {
        asAnon();
        expect((await call()).status).toBe(403);
        asUser();
        expect((await call()).status).toBe(403);
        expect(db.footballMatch.findUnique).not.toHaveBeenCalled();
    });

    it("returns 403 for an admin who is not the competition creator", async () => {
        setup({ homeGoals: 1, awayGoals: 0 }, [pred(1, 0)]);
        asAdmin("inny-admin");
        expect((await call()).status).toBe(403);
        expect(db.footballPrediction.update).not.toHaveBeenCalled();
    });

    it("returns 404 when the match belongs to another competition", async () => {
        setup({ homeGoals: 1, awayGoals: 0 }, [], null, {
            season: { competitionId: "inna", competition: { createdBy: "admin1" } },
        });
        expect((await call()).status).toBe(404);
    });

    it("returns 400 when the result has not been set", async () => {
        setup({ homeGoals: null, awayGoals: null, resolved: false }, [pred(1, 0)], null, {
            resolved: false,
        });
        expect((await call()).status).toBe(400);
        expect(db.footballPrediction.update).not.toHaveBeenCalled();
    });
});
