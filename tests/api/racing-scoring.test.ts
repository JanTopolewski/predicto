import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/competitions/[id]/racing/sessions/[sessionId]/calculate-points/route";
import { asAdmin, asAnon, asUser, calls, ctx, db } from "../helpers";

const call = () => POST(new Request("http://x") as never, ctx({ id: "c1", sessionId: "s1" }));

// Result: A=P1, B=P2, C=P3, D=P4
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
        ["A", "B", "C", 9, "all three exact"],
        ["A", "B", "D", 6, "two exact, third outside the podium"],
        ["B", "A", "C", 5, "P1/P2 swapped (1+1) + P3 exact (3)"],
        ["D", "A", "B", 2, "podium drivers in wrong places count, P4 does not"],
        ["D", "X", "Y", 0, "nothing correct"],
    ])("prediction %s-%s-%s => %i pts (%s)", async (a, b, c, expected) => {
        setup([podium(a, b, c)]);
        await call();
        expect(awarded()).toBe(expected);
    });

    it("SPRINT is scored like a race", async () => {
        setup([podium("A", "B", "C")], { type: "SPRINT" });
        await call();
        expect(awarded()).toBe(9);
    });

    it.each(["QUALIFYING", "PRACTICE1", "SPRINT_QUALIFYING"])(
        "%s ignores the podium (wildcard only)",
        async (type) => {
            setup([podium("A", "B", "C")], { type });
            await call();
            expect(awarded()).toBe(0);
        }
    );

    it("an incomplete podium gives no points", async () => {
        setup([{ firstDriverId: "A", secondDriverId: "B" }]);
        await call();
        expect(awarded()).toBe(0);
    });

    it("uses the competition's scoring rules", async () => {
        setup([podium("A", "B", "C")], { rules: { podiumExactPoints: 5, podiumAnyPoints: 2 } });
        await call();
        expect(awarded()).toBe(15);
    });
});

describe("racing calculate-points: wildcard", () => {
    it.each([
        [4, 2, "exact position"],
        [2, 1, "off by 2 => half points"],
        [6, 1, "off by 2 in the other direction"],
        [1, 0, "off by 3"],
    ])("D finishes P4, predicted position %i => %i pts (%s)", async (wildcardPosition, expected) => {
        setup([{ wildcardDriverId: "D", wildcardPosition }], { type: "QUALIFYING" });
        await call();
        expect(awarded()).toBe(expected);
    });

    it("a driver without a result (did not finish) gives no points", async () => {
        setup([{ wildcardDriverId: "Z", wildcardPosition: 4 }], { type: "QUALIFYING" });
        await call();
        expect(awarded()).toBe(0);
    });

    it("podium and wildcard points add up", async () => {
        setup([{ ...podium("A", "B", "C"), wildcardDriverId: "D", wildcardPosition: 4 }]);
        await call();
        expect(awarded()).toBe(11);
    });

    it("wildcardPoints=0 does not fall back to the default 2", async () => {
        setup([{ wildcardDriverId: "D", wildcardPosition: 4 }], {
            type: "QUALIFYING",
            rules: { wildcardPoints: 0 },
        });
        await call();
        expect(awarded()).toBe(0);
    });
});

describe("racing calculate-points: state and authorization", () => {
    it("marks the session as resolved and adds points to members", async () => {
        setup([podium("A", "B", "C")]);
        await call();
        expect(calls(db.racingSession.update)[0].data).toEqual({ resolved: true });
        expect(calls(db.competitionMember.update)[0].data.points.increment).toBe(9);
    });

    it("is idempotent - no ranking change on recalculation", async () => {
        setup([{ ...podium("A", "B", "C"), points: 9 }]);
        await call();
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("returns 400 when there are no results", async () => {
        setup([podium("A", "B", "C")], { results: [] });
        expect((await call()).status).toBe(400);
        expect(db.racingPrediction.update).not.toHaveBeenCalled();
    });

    it("returns 403 for anonymous, regular user and foreign admin", async () => {
        asAnon();
        expect((await call()).status).toBe(403);
        asUser();
        expect((await call()).status).toBe(403);
        setup([]);
        asAdmin("obcy");
        expect((await call()).status).toBe(403);
    });

    it("returns 404 when the session belongs to another competition", async () => {
        setup([]);
        db.racingSession.findUnique.mockResolvedValue({
            weekend: { season: { competition: { id: "inna", createdBy: "admin1" } } },
        });
        expect((await call()).status).toBe(404);
    });
});
