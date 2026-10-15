import { describe, expect, it } from "vitest";
import { POST as footballVote } from "../../app/api/competitions/[id]/football/season-winner/route";
import { POST as racingVote } from "../../app/api/competitions/[id]/racing/season-winner/route";
import { asAnon, asUser, ctx, db, FUTURE, jsonReq, PAST } from "../helpers";

// Football and racing season-winner voting share the same rules - tested in one parametrized suite.
const variants = [
    {
        name: "football",
        vote: footballVote,
        type: "FOOTBALL",
        field: "teamId",
        seasonsKey: "footballSeasons",
        firstEvent: () => db.footballMatch.findFirst,
        eventStart: (date: Date) => ({ id: "e1", kickoff: date }),
        inSeason: () => db.footballMatch.findFirst,
        entity: () => db.team.findUnique,
        predictionModel: () => db.footballSeasonWinnerPrediction,
        seasonCreate: () => db.footballSeason.create,
    },
    {
        name: "racing",
        vote: racingVote,
        type: "RACING",
        field: "driverId",
        seasonsKey: "racingSeasons",
        firstEvent: () => db.racingSession.findFirst,
        eventStart: (date: Date) => ({ id: "e1", startTime: date }),
        inSeason: () => db.racingSessionParticipant.findFirst,
        entity: () => db.driver.findUnique,
        predictionModel: () => db.racingSeasonWinnerPrediction,
        seasonCreate: () => db.racingSeason.create,
    },
] as const;

describe.each(variants)("$name season-winner vote (POST)", (v) => {
    const call = (b: unknown) => v.vote(jsonReq(b), ctx({ id: "c1" }));
    const body = { [v.field]: "X1" };

    function setup(over: { competition?: Record<string, unknown>; firstStart?: Date | null } = {}) {
        asUser("user1");
        db.competitionMember.findUnique.mockResolvedValue({ id: "m" });
        db.competition.findUnique.mockResolvedValue({
            id: "c1",
            type: v.type,
            winnerResolved: false,
            [v.seasonsKey]: [{ id: "s1" }],
            ...over.competition,
        });
        const first = over.firstStart === null ? null : v.eventStart(over.firstStart ?? FUTURE());
        if (v.name === "football") {
            // the same findFirst serves two queries: earliest match (orderBy) and "team plays in season" (OR)
            v.firstEvent().mockImplementation(async (args: any) =>
                args?.where?.OR ? { id: "link" } : first
            );
        } else {
            v.firstEvent().mockResolvedValue(first);
            v.inSeason().mockResolvedValue({ id: "link" });
        }
        v.predictionModel().findUnique.mockResolvedValue(null);
        v.entity().mockResolvedValue({ id: "X1" });
        v.predictionModel().create.mockImplementation(async ({ data }: any) => ({ id: "p1", ...data }));
    }

    it("returns 401 without a session", async () => {
        asAnon();
        expect((await call(body)).status).toBe(401);
    });

    it("returns 400 when the id is missing", async () => {
        setup();
        expect((await call({})).status).toBe(400);
    });

    it("returns 403 for a non-member", async () => {
        setup();
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await call(body)).status).toBe(403);
    });

    it("returns 404 for a competition of the wrong type", async () => {
        setup({ competition: { type: v.type === "FOOTBALL" ? "RACING" : "FOOTBALL" } });
        expect((await call(body)).status).toBe(404);
    });

    it("returns 400 after the winner was announced", async () => {
        setup({ competition: { winnerResolved: true } });
        expect((await call(body)).status).toBe(400);
        expect(v.predictionModel().create).not.toHaveBeenCalled();
    });

    it("returns 400 once the first event of the season has started", async () => {
        setup({ firstStart: PAST() });
        expect((await call(body)).status).toBe(400);
        expect(v.predictionModel().create).not.toHaveBeenCalled();
    });

    it("the vote cannot be changed (second vote returns 400)", async () => {
        setup();
        v.predictionModel().findUnique.mockResolvedValue({ id: "old" });
        expect((await call(body)).status).toBe(400);
        expect(v.predictionModel().create).not.toHaveBeenCalled();
    });

    it("returns 404 for an unknown entity and 400 for one that is not in the season", async () => {
        setup();
        v.entity().mockResolvedValue(null);
        expect((await call(body)).status).toBe(404);
        setup();
        v.inSeason().mockResolvedValue(null);
        expect((await call(body)).status).toBe(400);
    });

    it("saves the vote for the session user (ignores a userId from the body)", async () => {
        setup();
        const res = await call({ ...body, userId: "ofiara" });
        expect(res.status).toBe(201);
        const data = v.predictionModel().create.mock.calls[0][0].data;
        expect(data).toMatchObject({ seasonId: "s1", userId: "user1", [v.field]: "X1" });
    });

    it("voting is allowed when the season has no events yet", async () => {
        setup({ firstStart: null });
        v.inSeason().mockResolvedValue({ id: "link" });
        expect((await call(body)).status).toBe(201);
    });
});