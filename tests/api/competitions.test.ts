import { describe, expect, it } from "vitest";
import { POST as joinById } from "../../app/api/competitions/[id]/members/route";
import { POST as joinByCode } from "../../app/api/competitions/members/route";
import { GET as getCompetition, DELETE as deleteCompetition } from "../../app/api/competitions/[id]/route";
import { asAdmin, asAnon, asUser, ctx, db, jsonReq } from "../helpers";

const byId = () => joinById(jsonReq(undefined), ctx({ id: "c1" }));
const byCode = (body: unknown) => joinByCode(jsonReq(body));

describe("joining a competition", () => {
    it("returns 401 without a session", async () => {
        asAnon();
        expect((await byId()).status).toBe(401);
        expect((await byCode({ inviteCode: "ABC" })).status).toBe(401);
    });

    it("SECURITY: a private competition cannot be joined by id (invite code only)", async () => {
        asUser();
        db.competition.findUnique.mockResolvedValue({ id: "c1", isPublic: false });
        expect((await byId()).status).toBe(403);
        expect(db.competitionMember.create).not.toHaveBeenCalled();
    });

    it("public: joins with 0 points, joining again returns 409", async () => {
        asUser("user1");
        db.competition.findUnique.mockResolvedValue({ id: "c1", isPublic: true });
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await byId()).status).toBe(200);
        expect(db.competitionMember.create.mock.calls[0][0].data).toEqual({
            competitionId: "c1",
            userId: "user1",
            points: 0,
        });

        db.competitionMember.findUnique.mockResolvedValue({ id: "m" });
        expect((await byId()).status).toBe(409);
    });

    it("returns 404 for a non-existent competition", async () => {
        asUser();
        db.competition.findUnique.mockResolvedValue(null);
        expect((await byId()).status).toBe(404);
    });

    it("the invite code is case-insensitive", async () => {
        asUser();
        db.competition.findUnique.mockResolvedValue({ id: "c1" });
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await byCode({ inviteCode: "abc123" })).status).toBe(200);
        expect(db.competition.findUnique.mock.calls[0][0].where).toEqual({ inviteCode: "ABC123" });
    });

    it("wrong code => 404, missing code => 400", async () => {
        asUser();
        db.competition.findUnique.mockResolvedValue(null);
        expect((await byCode({ inviteCode: "ZLY" })).status).toBe(404);
        expect((await byCode({})).status).toBe(400);
    });

    it("a non-string inviteCode returns 400", async () => {
        asUser();
        expect((await byCode({ inviteCode: { $ne: "" } })).status).toBe(400);
        expect((await byCode({ inviteCode: 12345 })).status).toBe(400);
    });
});

describe("GET /api/competitions/[id] - data isolation", () => {
    const comp = (over = {}) => ({
        id: "c1",
        type: "FOOTBALL",
        createdBy: "owner",
        members: [{ userId: "member1", points: 5, user: { username: "Łukasz", passwordHash: "SEKRET" } }],
        footballSeasons: [],
        racingSeasons: [],
        ...over,
    });
    const get = () => getCompetition(jsonReq(undefined, "GET") as never, ctx({ id: "c1" }));

    it("returns 403 for anonymous and for a non-member", async () => {
        db.competition.findUnique.mockResolvedValue(comp());
        asAnon();
        expect((await get()).status).toBe(403);
        asUser("obcy");
        expect((await get()).status).toBe(403);
    });

    it("a member sees the ranking but no sensitive user fields", async () => {
        db.competition.findUnique.mockResolvedValue(comp());
        asUser("member1");
        const res = await get();
        expect(res.status).toBe(200);
        const text = JSON.stringify(await res.json());
        expect(text).toContain('"points":5');
        expect(text).not.toMatch(/SEKRET|passwordHash|email/);
    });
});

describe("DELETE /api/competitions/[id]", () => {
    const del = () => deleteCompetition(jsonReq(undefined, "DELETE") as never, ctx({ id: "c1" }));

    it("returns 403: anonymous, regular user, foreign admin", async () => {
        asAnon();
        expect((await del()).status).toBe(403);
        asUser("owner");
        expect((await del()).status).toBe(403);
        asAdmin("obcy");
        db.competition.findUnique.mockResolvedValue({ id: "c1", createdBy: "owner" });
        expect((await del()).status).toBe(403);
        expect(db.competition.delete).not.toHaveBeenCalled();
    });

    it("the creator-admin deletes the competition", async () => {
        asAdmin("owner");
        db.competition.findUnique.mockResolvedValue({ id: "c1", createdBy: "owner" });
        expect((await del()).status).toBe(200);
        expect(db.competition.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    });
});
