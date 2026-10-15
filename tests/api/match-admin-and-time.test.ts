import { afterEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "../../app/api/competitions/[id]/matches/[matchId]/route";
import { formatPolishDateTime, isTimePassed } from "../../lib/timeUtils";
import { asAdmin, ctx, db, jsonReq } from "../helpers";

afterEach(() => vi.useRealTimers());

describe("timeUtils - prediction lock boundary", () => {
    it("isTimePassed: false exactly at start time, true one millisecond later", () => {
        vi.useFakeTimers();
        const start = new Date("2026-05-01T12:00:00.000Z");
        vi.setSystemTime(start);
        expect(isTimePassed(start)).toBe(false);
        vi.setSystemTime(new Date(start.getTime() + 1));
        expect(isTimePassed(start)).toBe(true);
    });

    it("formatPolishDateTime accounts for winter/summer time", () => {
        expect(formatPolishDateTime(new Date("2026-01-15T12:00:00Z"))).toContain("13:00");
        expect(formatPolishDateTime(new Date("2026-07-15T12:00:00Z"))).toContain("14:00");
    });

    it("formatPolishDateTime does not depend on the server timezone (UTC midnight -> 02:00 in summer)", () => {
        expect(formatPolishDateTime(new Date("2026-07-15T00:00:00Z"))).toContain("02:00");
    });
});

describe("PATCH football match (admin)", () => {
    const patch = (body: unknown) => PATCH(jsonReq(body, "PATCH"), ctx({ id: "c1", matchId: "m1" }));
    function setup(over: Record<string, unknown> = {}) {
        asAdmin("owner");
        db.footballMatch.findUnique.mockResolvedValue({
            id: "m1",
            kickoff: new Date(Date.now() + 24 * 60 * 60 * 1000),
            resolved: false,
            season: { competitionId: "c1", competition: { createdBy: "owner" } },
            predictions: [],
            ...over,
        });
        db.footballMatch.update.mockImplementation(async (a: any) => a.data);
    }

    it("setting both scores marks the match as resolved", async () => {
        setup();
        await patch({ homeGoals: 2, awayGoals: 0 });
        expect(db.footballMatch.update.mock.calls[0][0].data.resolved).toBe(true);
    });

    it("a 0:0 result also resolves the match (0 is not treated as missing)", async () => {
        setup();
        await patch({ homeGoals: 0, awayGoals: 0 });
        const data = db.footballMatch.update.mock.calls[0][0].data;
        expect(data).toMatchObject({ homeGoals: 0, awayGoals: 0, resolved: true });
    });

    it("only one side of the score does not resolve the match", async () => {
        setup();
        await patch({ homeGoals: 2 });
        expect(db.footballMatch.update.mock.calls[0][0].data.resolved).toBeUndefined();
    });

    it.each([[-1], [1.5], ["abc"], [999]])("rejects invalid goals %j", async (goals) => {
        setup();
        const res = await patch({ homeGoals: goals, awayGoals: 0 });
        expect(res.status).toBe(400);
        expect(db.footballMatch.update).not.toHaveBeenCalled();
    });

    it("allows resetting votingClosedAt to null before match kickoff to reopen voting", async () => {
        setup({ votingClosedAt: new Date(Date.now() - 3600 * 1000) });
        const res = await patch({ votingClosedAt: null });
        expect(res.status).toBe(200);
        expect(db.footballMatch.update.mock.calls[0][0].data.votingClosedAt).toBeNull();
    });

    it("parses valid votingClosedAt date", async () => {
        setup();
        const dateStr = "2026-05-01T10:00:00.000Z";
        const res = await patch({ votingClosedAt: dateStr });
        expect(res.status).toBe(200);
        expect(db.footballMatch.update.mock.calls[0][0].data.votingClosedAt).toEqual(new Date(dateStr));
    });

    it("rejects invalid votingClosedAt date format", async () => {
        setup();
        const res = await patch({ votingClosedAt: "not-a-date" });
        expect(res.status).toBe(400);
        expect(db.footballMatch.update).not.toHaveBeenCalled();
    });

    it("rejects modifying votingClosedAt when match is already resolved", async () => {
        setup({ resolved: true });
        const res = await patch({ votingClosedAt: null });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/rozliczonego meczu/);
        expect(db.footballMatch.update).not.toHaveBeenCalled();
    });

    it("rejects modifying votingClosedAt when match has already started", async () => {
        setup({ kickoff: new Date(Date.now() - 60 * 1000) });
        const res = await patch({ votingClosedAt: null });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/po rozpoczęciu meczu/);
        expect(db.footballMatch.update).not.toHaveBeenCalled();
    });
});
