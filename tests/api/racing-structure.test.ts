import { describe, expect, it, vi } from "vitest";
import { GET as listWeekends, POST as createWeekend } from "../../app/api/competitions/[id]/racing/weekends/route";
import {
    DELETE as deleteWeekend,
    GET as getWeekend,
} from "../../app/api/competitions/[id]/racing/weekends/[weekendId]/route";
import { GET as listSessions, POST as createSession } from "../../app/api/competitions/[id]/racing/sessions/route";
import {
    DELETE as deleteSession,
    PATCH as patchSession,
} from "../../app/api/competitions/[id]/racing/sessions/[sessionId]/route";
import { asAdmin, asAnon, asUser, calls, ctx, db, jsonReq } from "../helpers";

const cid = ctx({ id: "c1" });
const racingComp = (over: Record<string, unknown> = {}) => ({
    id: "c1",
    type: "RACING",
    createdBy: "owner",
    racingSeasons: [{ id: "rs1", weekends: [] }],
    ...over,
});

describe("racing weekends", () => {
    const body = { grandPrix: "Grand Prix Polski", country: "Polska", raceDate: "2026-09-13T13:00:00Z" };

    it("POST: 403 for non-admin and foreign admin, 400 for missing fields", async () => {
        asUser();
        expect((await createWeekend(jsonReq(body), cid)).status).toBe(403);
        asAdmin("owner");
        db.competition.findUnique.mockResolvedValue(racingComp());
        expect((await createWeekend(jsonReq({ ...body, country: "" }), cid)).status).toBe(400);
        asAdmin("obcy");
        expect((await createWeekend(jsonReq(body), cid)).status).toBe(403);
        expect(db.racingWeekend.create).not.toHaveBeenCalled();
    });

    it("POST: 404 for a football competition, creates the season lazily", async () => {
        asAdmin("owner");
        db.competition.findUnique.mockResolvedValue(racingComp({ type: "FOOTBALL" }));
        expect((await createWeekend(jsonReq(body), cid)).status).toBe(404);

        db.competition.findUnique.mockResolvedValue(racingComp({ racingSeasons: [] }));
        db.racingSeason.create.mockResolvedValue({ id: "new" });
        db.racingWeekend.create.mockImplementation(async ({ data }: any) => ({ id: "w1", ...data }));
        expect((await createWeekend(jsonReq(body), cid)).status).toBe(201);
        expect(db.racingWeekend.create.mock.calls[0][0].data.seasonId).toBe("new");
    });

    it("GET: 401 anonymous, 403 for a non-member, member and creator-admin allowed", async () => {
        db.competition.findUnique.mockResolvedValue(racingComp());
        asAnon();
        expect((await listWeekends({} as never, cid)).status).toBe(401);

        asUser("obcy");
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await listWeekends({} as never, cid)).status).toBe(403);

        asUser("member");
        db.competitionMember.findUnique.mockResolvedValue({ id: "m" });
        expect((await listWeekends({} as never, cid)).status).toBe(200);

        asAdmin("owner");
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await listWeekends({} as never, cid)).status).toBe(200);
    });

    it("GET [weekendId]: 403 for non-member, 404 for a weekend of another competition", async () => {
        const wctx = ctx({ id: "c1", weekendId: "w1" });
        asUser("obcy");
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await getWeekend({} as never, wctx)).status).toBe(403);

        asUser("member");
        db.competitionMember.findUnique.mockResolvedValue({ id: "m" });
        db.racingWeekend.findUnique.mockResolvedValue({ season: { competition: { id: "inna" } } });
        expect((await getWeekend({} as never, wctx)).status).toBe(404);
    });

    describe("DELETE [weekendId]", () => {
        const wctx = ctx({ id: "c1", weekendId: "w1" });
        const del = () => deleteWeekend({} as never, wctx);

        it("403 for non-admin/foreign admin, 404 for another competition's weekend", async () => {
            asUser();
            expect((await del()).status).toBe(403);
            asAdmin("obcy");
            db.racingWeekend.findUnique.mockResolvedValue({
                season: { competition: { id: "c1", createdBy: "owner" } },
            });
            expect((await del()).status).toBe(403);
            db.racingWeekend.findUnique.mockResolvedValue({
                season: { competition: { id: "inna", createdBy: "obcy" } },
            });
            expect((await del()).status).toBe(404);
            expect(db.racingWeekend.delete).not.toHaveBeenCalled();
        });

        it("creator-admin deletes an unscored weekend", async () => {
            asAdmin("owner");
            db.racingWeekend.findUnique.mockResolvedValue({
                sessions: [{ resolved: false }],
                season: { competition: { id: "c1", createdBy: "owner" } },
            });
            expect((await del()).status).toBe(200);
        });

        it("a weekend with a resolved session cannot be deleted", async () => {
            asAdmin("owner");
            db.racingWeekend.findUnique.mockResolvedValue({
                sessions: [{ resolved: true }],
                season: { competition: { id: "c1", createdBy: "owner" } },
            });
            expect((await del()).status).toBe(400);
            expect(db.racingWeekend.delete).not.toHaveBeenCalled();
        });
    });
});

describe("POST racing sessions (create)", () => {
    const base = {
        weekendId: "w1",
        type: "RACE",
        name: "Wyścig",
        startTime: "2026-09-13T13:00:00Z",
        participatingDriverIds: ["A", "B", "C"],
    };
    const call = (b: unknown) => createSession(jsonReq(b), cid);

    function setup() {
        asAdmin("owner");
        db.racingWeekend.findUnique.mockResolvedValue({
            id: "w1",
            season: { competition: { id: "c1", createdBy: "owner" } },
        });
        db.racingSession.create.mockImplementation(async ({ data }: any) => ({ id: "s1", ...data }));
    }
    const created = () => db.racingSession.create.mock.calls[0][0].data;

    it("403 for non-admin and for foreign admin", async () => {
        asUser();
        expect((await call(base)).status).toBe(403);
        setup();
        asAdmin("obcy");
        expect((await call(base)).status).toBe(403);
        expect(db.racingSession.create).not.toHaveBeenCalled();
    });

    it.each([
        [{ ...base, name: undefined }, "missing name"],
        [{ ...base, participatingDriverIds: undefined }, "missing participants"],
        [{ ...base, participatingDriverIds: [] }, "empty participants"],
        [{ ...base, type: "QUALIFYING" }, "qualifying without a wildcard driver"],
        [{ ...base, wildcardDriverId: "Z" }, "wildcard driver who does not participate"],
    ])("400: %j (%s)", async (b, _label) => {
        setup();
        expect((await call(b)).status).toBe(400);
        expect(db.racingSession.create).not.toHaveBeenCalled();
    });

    it("404 when the weekend belongs to another competition", async () => {
        setup();
        db.racingWeekend.findUnique.mockResolvedValue({
            season: { competition: { id: "inna", createdBy: "owner" } },
        });
        expect((await call(base)).status).toBe(404);
    });

    it("creates participants and an explicitly chosen wildcard", async () => {
        setup();
        const res = await call({ ...base, wildcardDriverId: "B" });
        expect(res.status).toBe(201);
        expect(created().participants.createMany.data).toEqual([
            { driverId: "A" },
            { driverId: "B" },
            { driverId: "C" },
        ]);
        expect(created().wildcards.create).toEqual({ driverId: "B" });
    });

    it("a race without a wildcard is allowed (wildcard only required without a podium)", async () => {
        setup();
        expect((await call(base)).status).toBe(201);
        expect(created()).not.toHaveProperty("wildcards");
    });

    it("RANDOM wildcard picks one of the participants", async () => {
        setup();
        const spy = vi.spyOn(Math, "random").mockReturnValue(0.99);
        const res = await call({ ...base, type: "QUALIFYING", wildcardDriverId: "RANDOM" });
        spy.mockRestore();
        expect(res.status).toBe(201);
        expect(created().wildcards.create.driverId).toBe("C");
    });

    it("a non-array participatingDriverIds returns 400", async () => {
        setup();
        expect((await call({ ...base, wildcardDriverId: "A", participatingDriverIds: { a: 1 } })).status).toBe(400);
        expect(db.racingSession.create).not.toHaveBeenCalled();
    });

    it("an unknown session type returns 400", async () => {
        setup();
        expect((await call({ ...base, type: "WARMUP", wildcardDriverId: "A" })).status).toBe(400);
        expect(db.racingSession.create).not.toHaveBeenCalled();
    });
});

describe("GET racing sessions", () => {
    it("401 anonymous, 403 non-member", async () => {
        asAnon();
        expect((await listSessions({} as never, cid)).status).toBe(401);
        asUser("obcy");
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await listSessions({} as never, cid)).status).toBe(403);
    });

    it("a member only receives their own predictions", async () => {
        asUser("member");
        db.competitionMember.findUnique.mockResolvedValue({ id: "m" });
        db.competition.findUnique.mockResolvedValue({ racingSeasons: [{ weekends: [{ sessions: [{ id: "s1" }] }] }] });
        const res = await listSessions({} as never, cid);
        expect((await res.json()).sessions).toEqual([{ id: "s1" }]);
        const include = db.competition.findUnique.mock.calls[0][0].include;
        const sessionInclude = include.racingSeasons.include.weekends.include.sessions.include;
        expect(sessionInclude.predictions.where).toEqual({ userId: "member" });
    });
});

describe("PATCH / DELETE racing session", () => {
    const sctx = ctx({ id: "c1", sessionId: "s1" });
    const session = (over: Record<string, unknown> = {}) => ({
        id: "s1",
        resolved: false,
        weekend: { season: { competition: { id: "c1", createdBy: "owner" } } },
        participants: [],
        ...over,
    });
    const patch = (b: unknown) => patchSession(jsonReq(b, "PATCH"), sctx);
    const del = () => deleteSession({} as never, sctx);

    it("403 for non-admin and for foreign admin (both methods)", async () => {
        asUser();
        expect((await patch({ name: "x" })).status).toBe(403);
        expect((await del()).status).toBe(403);
        asAdmin("obcy");
        db.racingSession.findUnique.mockResolvedValue(session());
        expect((await patch({ name: "x" })).status).toBe(403);
        expect((await del()).status).toBe(403);
        expect(db.racingSession.update).not.toHaveBeenCalled();
        expect(db.racingSession.delete).not.toHaveBeenCalled();
    });

    it("404 when the session belongs to another competition", async () => {
        asAdmin("owner");
        db.racingSession.findUnique.mockResolvedValue(
            session({ weekend: { season: { competition: { id: "inna", createdBy: "owner" } } } })
        );
        expect((await patch({ name: "x" })).status).toBe(404);
        expect((await del()).status).toBe(404);
    });

    it("PATCH replaces participants and updates only the provided fields", async () => {
        asAdmin("owner");
        db.racingSession.findUnique.mockResolvedValue(session());
        db.racingSession.update.mockImplementation(async ({ data }: any) => data);
        await patch({ name: "Nowa nazwa", participatingDriverIds: ["A", "B"] });
        expect(db.racingSessionParticipant.deleteMany).toHaveBeenCalledWith({ where: { sessionId: "s1" } });
        expect(db.racingSessionParticipant.createMany.mock.calls[0][0].data).toEqual([
            { sessionId: "s1", driverId: "A" },
            { sessionId: "s1", driverId: "B" },
        ]);
        expect(calls(db.racingSession.update)[0].data).toEqual({ name: "Nowa nazwa" });
    });

    it("DELETE refuses a resolved session, deletes an unresolved one", async () => {
        asAdmin("owner");
        db.racingSession.findUnique.mockResolvedValue(session({ resolved: true }));
        expect((await del()).status).toBe(400);
        expect(db.racingSession.delete).not.toHaveBeenCalled();

        db.racingSession.findUnique.mockResolvedValue(session());
        expect((await del()).status).toBe(200);
    });

    it("PATCH of participants on a resolved session returns 400", async () => {
        asAdmin("owner");
        db.racingSession.findUnique.mockResolvedValue(session({ resolved: true }));
        db.racingSession.update.mockImplementation(async ({ data }: any) => data);
        expect((await patch({ participatingDriverIds: ["A"] })).status).toBe(400);
        expect(db.racingSessionParticipant.deleteMany).not.toHaveBeenCalled();
    });
});

