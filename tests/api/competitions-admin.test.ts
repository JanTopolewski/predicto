import { describe, expect, it } from "vitest";
import { GET as listMine, POST as createCompetition } from "../../app/api/competitions/route";
import { GET as listAll } from "../../app/api/competitions/all/route";
import { POST as createMatch } from "../../app/api/competitions/[id]/matches/route";
import { POST as announceFootball } from "../../app/api/competitions/[id]/football/season-winner/announce/route";
import { asAdmin, asAnon, asUser, calls, ctx, db, jsonReq } from "../helpers";

describe("POST /api/competitions", () => {
    const body = {
        name: "Ekstraklasa 2026/27",
        type: "FOOTBALL",
        season: "2026/27",
        startDate: "2026-08-01",
        endDate: "2027-05-30",
    };
    const call = (b: unknown) => createCompetition(jsonReq(b) as never);

    it("returns 401 for anonymous and 403 for a regular user (role from the DB)", async () => {
        asAnon();
        expect((await call(body)).status).toBe(401);
        asUser();
        db.user.findUnique.mockResolvedValue({ role: "USER" });
        expect((await call(body)).status).toBe(403);
        expect(db.competition.create).not.toHaveBeenCalled();
    });

    it("returns 400 when a required field is missing", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
        for (const key of ["name", "type", "season", "startDate", "endDate"]) {
            expect((await call({ ...body, [key]: undefined })).status).toBe(400);
        }
        expect(db.competition.create).not.toHaveBeenCalled();
    });

    it("creates a public competition owned by the session user with a generated invite code", async () => {
        asAdmin("admin1");
        db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
        db.competition.create.mockImplementation(async ({ data }: any) => ({ id: "c1", ...data }));
        const res = await call({ ...body, createdBy: "someone-else" });
        expect(res.status).toBe(201);
        const data = db.competition.create.mock.calls[0][0].data;
        expect(data.createdBy).toBe("admin1");
        expect(data.isPublic).toBe(true);
        expect(data.inviteCode).toMatch(/^[A-Z0-9_-]{10}$/);
    });

    it("respects isPublic=false (0/false are not replaced by the default)", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
        db.competition.create.mockImplementation(async ({ data }: any) => ({ id: "c1", ...data }));
        await call({ ...body, isPublic: false });
        expect(db.competition.create.mock.calls[0][0].data.isPublic).toBe(false);
    });

    it("generates different invite codes for consecutive competitions", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
        db.competition.create.mockImplementation(async ({ data }: any) => ({ id: "c1", ...data }));
        await call(body);
        await call(body);
        const [a, b] = calls(db.competition.create).map((c) => c.data.inviteCode);
        expect(a).not.toBe(b);
    });

    // BUG: no validation of type / dates - values reach Prisma and cause a 500 (or an end date before the start date).
    it.fails("BUG: an unknown competition type returns 400", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
        db.competition.create.mockRejectedValue(new Error("Invalid enum value"));
        expect((await call({ ...body, type: "TENNIS" })).status).toBe(400);
    });

    it.fails("BUG: an end date earlier than the start date returns 400", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
        db.competition.create.mockImplementation(async ({ data }: any) => data);
        expect((await call({ ...body, startDate: "2027-05-30", endDate: "2026-08-01" })).status).toBe(400);
    });
});

describe("GET /api/competitions (my competitions)", () => {
    it("returns 401 for anonymous", async () => {
        asAnon();
        expect((await listMine({} as never)).status).toBe(401);
    });

    it("lists only the user's memberships, with points and member count", async () => {
        asUser("user1");
        db.competitionMember.findMany.mockResolvedValue([
            {
                points: 12,
                competition: {
                    id: "c1",
                    name: "Liga",
                    type: "FOOTBALL",
                    season: "2026",
                    startDate: new Date("2026-01-01"),
                    endDate: new Date("2026-12-31"),
                    _count: { members: 7 },
                },
            },
        ]);
        const body = await (await listMine({} as never)).json();
        expect(db.competitionMember.findMany.mock.calls[0][0].where).toEqual({ userId: "user1" });
        expect(body.competitions[0]).toMatchObject({ id: "c1", points: 12, memberCount: 7 });
    });
});

describe("GET /api/competitions/all - visibility and invite code privacy", () => {
    const comp = (over: Record<string, unknown>) => ({
        id: "c1",
        name: "N",
        type: "FOOTBALL",
        season: "s",
        inviteCode: "SEKRETNYKOD",
        isPublic: true,
        createdBy: "owner",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        _count: { members: 3 },
        ...over,
    });

    it("returns 401 for anonymous", async () => {
        asAnon();
        expect((await listAll({} as never)).status).toBe(401);
    });

    it("a user only searches public competitions outside their memberships", async () => {
        asUser("user1");
        db.competitionMember.findMany.mockResolvedValue([{ points: 1, competition: comp({ id: "mine" }) }]);
        db.competition.findMany.mockResolvedValue([]);
        await listAll({} as never);
        expect(db.competition.findMany.mock.calls[0][0].where).toEqual({
            isPublic: true,
            id: { notIn: ["mine"] },
        });
    });

    it("SECURITY: the invite code is shown only to the creator, never for others' competitions", async () => {
        asUser("owner");
        db.competitionMember.findMany.mockResolvedValue([
            { points: 0, competition: comp({ id: "own", createdBy: "owner" }) },
            { points: 0, competition: comp({ id: "foreign", createdBy: "somebody" }) },
        ]);
        db.competition.findMany.mockResolvedValue([comp({ id: "public", createdBy: "somebody" })]);
        const { competitions } = await (await listAll({} as never)).json();
        const byId = Object.fromEntries(competitions.map((c: any) => [c.id, c]));
        expect(byId.own.inviteCode).toBe("SEKRETNYKOD");
        expect(byId.foreign.inviteCode).toBeNull();
        expect(byId.public.inviteCode).toBeNull();
        expect(byId.public.isMember).toBe(false);
    });

    it("an admin sees all competitions including private ones", async () => {
        asAdmin("admin1");
        db.competition.findMany.mockResolvedValue([
            { ...comp({ isPublic: false }), members: [] },
        ]);
        const { competitions } = await (await listAll({} as never)).json();
        expect(competitions).toHaveLength(1);
        expect(competitions[0].isPublic).toBe(false);
        expect(db.competition.findMany.mock.calls[0][0]).not.toHaveProperty("where");
    });
});

describe("POST /api/competitions/[id]/matches (create match)", () => {
    const call = (b: unknown) => createMatch(jsonReq(b), ctx({ id: "c1" }));
    const valid = { homeTeamId: "t1", awayTeamId: "t2", kickoff: "2026-09-01T18:00:00Z" };

    function setup(over: Record<string, unknown> = {}) {
        asAdmin("owner");
        db.competition.findUnique.mockResolvedValue({
            id: "c1",
            type: "FOOTBALL",
            createdBy: "owner",
            footballSeasons: [{ id: "fs1" }],
            ...over,
        });
        db.team.findUnique.mockImplementation(async ({ where }: any) => ({ id: where.id }));
        db.footballMatch.create.mockImplementation(async ({ data }: any) => ({ id: "m1", ...data }));
    }

    it("returns 403 for a non-admin and for a foreign admin", async () => {
        asUser();
        expect((await call(valid)).status).toBe(403);
        setup();
        asAdmin("obcy");
        expect((await call(valid)).status).toBe(403);
        expect(db.footballMatch.create).not.toHaveBeenCalled();
    });

    it.each([
        [{ ...valid, homeTeamId: undefined }, "missing home team"],
        [{ ...valid, kickoff: undefined }, "missing kickoff"],
        [{ ...valid, awayTeamId: "t1" }, "a team playing against itself"],
    ])("returns 400: %j (%s)", async (b, _label) => {
        setup();
        expect((await call(b)).status).toBe(400);
        expect(db.footballMatch.create).not.toHaveBeenCalled();
    });

    it("returns 404 for a racing competition or unknown team", async () => {
        setup({ type: "RACING" });
        expect((await call(valid)).status).toBe(404);
        setup();
        db.team.findUnique.mockResolvedValueOnce({ id: "t1" }).mockResolvedValueOnce(null);
        expect((await call(valid)).status).toBe(404);
    });

    it("creates a SCHEDULED match in the existing season", async () => {
        setup();
        const res = await call(valid);
        expect(res.status).toBe(201);
        expect(db.footballMatch.create.mock.calls[0][0].data).toMatchObject({
            seasonId: "fs1",
            homeTeamId: "t1",
            awayTeamId: "t2",
            status: "SCHEDULED",
        });
    });

    it("creates the football season lazily when the competition has none", async () => {
        setup({ footballSeasons: [] });
        db.footballSeason.create.mockResolvedValue({ id: "new-season" });
        await call(valid);
        expect(db.footballMatch.create.mock.calls[0][0].data.seasonId).toBe("new-season");
    });

    // BUG: kickoff is not validated - "not-a-date" becomes an Invalid Date and fails in Prisma (500).
    it.fails("BUG: an invalid kickoff returns 400", async () => {
        setup();
        db.footballMatch.create.mockRejectedValue(new Error("Invalid Date"));
        expect((await call({ ...valid, kickoff: "not-a-date" })).status).toBe(400);
    });
});

describe("POST football season-winner/announce", () => {
    const call = (b: unknown = { winningTeamId: "T1" }) =>
        announceFootball(jsonReq(b), ctx({ id: "c1" }));

    function setup(over: Record<string, unknown> = {}) {
        asAdmin("owner");
        db.competition.findUnique.mockResolvedValue({
            id: "c1",
            type: "FOOTBALL",
            createdBy: "owner",
            winnerResolved: false,
            footballSeasons: [
                {
                    id: "fs1",
                    seasonWinnerPredictions: [
                        { userId: "u1", teamId: "T1" },
                        { userId: "u2", teamId: "T2" },
                    ],
                },
            ],
            ...over,
        });
        db.team.findUnique.mockResolvedValue({ id: "T1", name: "Legia" });
        db.footballMatch.findFirst.mockResolvedValue({ id: "m" });
        db.competitionScoring.findUnique.mockResolvedValue(null);
        db.competition.updateMany.mockResolvedValue({ count: 1 });
    }

    it("returns 403 for non-admin / foreign admin", async () => {
        asUser();
        expect((await call()).status).toBe(403);
        setup();
        asAdmin("obcy");
        expect((await call()).status).toBe(403);
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("rewards only the users who picked the winning team", async () => {
        setup();
        expect((await call()).status).toBe(200);
        const updates = calls(db.competitionMember.update);
        expect(updates).toHaveLength(1);
        expect(updates[0].where.competitionId_userId.userId).toBe("u1");
        expect(updates[0].data.points.increment).toBe(10);
    });

    it("a repeated announcement and a lost race both return 400 without awarding points", async () => {
        setup({ winnerResolved: true });
        expect((await call()).status).toBe(400);
        setup();
        db.competition.updateMany.mockResolvedValue({ count: 0 });
        expect((await call()).status).toBe(400);
        expect(db.competitionMember.update).not.toHaveBeenCalled();
    });

    it("returns 400 for a team that does not play in this season", async () => {
        setup();
        db.footballMatch.findFirst.mockResolvedValue(null);
        expect((await call()).status).toBe(400);
        expect((await call({})).status).toBe(400);
    });
});