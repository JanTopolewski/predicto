import { describe, expect, it } from "vitest";
import { POST as joinById } from "../../app/api/competitions/[id]/join/route";
import { POST as joinByCode } from "../../app/api/competitions/join-by-code/route";
import { GET as getCompetition } from "../../app/api/competitions/[id]/route";
import { DELETE as deleteCompetition } from "../../app/api/competitions/[id]/delete/route";
import { asAdmin, asAnon, asUser, ctx, db, jsonReq } from "../helpers";

const byId = () => joinById(jsonReq(undefined), ctx({ id: "c1" }));
const byCode = (body: unknown) => joinByCode(jsonReq(body));

describe("dołączanie do konkurencji", () => {
    it("401 bez sesji", async () => {
        asAnon();
        expect((await byId()).status).toBe(401);
        expect((await byCode({ inviteCode: "ABC" })).status).toBe(401);
    });

    it("SECURITY: prywatnej konkurencji nie można dołączyć przez id (tylko kodem)", async () => {
        asUser();
        db.competition.findUnique.mockResolvedValue({ id: "c1", isPublic: false });
        expect((await byId()).status).toBe(403);
        expect(db.competitionMember.create).not.toHaveBeenCalled();
    });

    it("publiczna: dołącza z 0 punktów, a ponowne dołączenie to 409", async () => {
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

    it("404 dla nieistniejącej konkurencji", async () => {
        asUser();
        db.competition.findUnique.mockResolvedValue(null);
        expect((await byId()).status).toBe(404);
    });

    it("kod zaproszenia jest niewrażliwy na wielkość liter", async () => {
        asUser();
        db.competition.findUnique.mockResolvedValue({ id: "c1" });
        db.competitionMember.findUnique.mockResolvedValue(null);
        expect((await byCode({ inviteCode: "abc123" })).status).toBe(200);
        expect(db.competition.findUnique.mock.calls[0][0].where).toEqual({ inviteCode: "ABC123" });
    });

    it("zły kod => 404, brak kodu => 400", async () => {
        asUser();
        db.competition.findUnique.mockResolvedValue(null);
        expect((await byCode({ inviteCode: "ZLY" })).status).toBe(404);
        expect((await byCode({})).status).toBe(400);
    });

    // BUG: inviteCode niebędący stringiem rzuca TypeError (.toUpperCase) -> 500 zamiast 400.
    it.fails("BUG: inviteCode nie-string daje 400", async () => {
        asUser();
        expect((await byCode({ inviteCode: { $ne: "" } })).status).toBe(400);
    });
});

describe("GET /api/competitions/[id] - izolacja danych", () => {
    const comp = (over = {}) => ({
        id: "c1",
        type: "FOOTBALL",
        createdBy: "owner",
        members: [{ userId: "member1", points: 5, user: { username: "m", passwordHash: "SEKRET" } }],
        footballSeasons: [],
        racingSeasons: [],
        ...over,
    });
    const get = () => getCompetition(jsonReq(undefined, "GET") as never, ctx({ id: "c1" }));

    it("403 dla anonima i dla nie-członka", async () => {
        db.competition.findUnique.mockResolvedValue(comp());
        asAnon();
        expect((await get()).status).toBe(403);
        asUser("obcy");
        expect((await get()).status).toBe(403);
    });

    it("członek widzi ranking, ale bez wrażliwych pól użytkowników", async () => {
        db.competition.findUnique.mockResolvedValue(comp());
        asUser("member1");
        const res = await get();
        expect(res.status).toBe(200);
        const text = JSON.stringify(await res.json());
        expect(text).toContain('"points":5');
        expect(text).not.toMatch(/SEKRET|passwordHash|email/);
    });
});

describe("DELETE /api/competitions/[id]/delete", () => {
    const del = () => deleteCompetition(jsonReq(undefined, "DELETE") as never, ctx({ id: "c1" }));

    it("403: anonim, user, obcy admin", async () => {
        asAnon();
        expect((await del()).status).toBe(403);
        asUser("owner");
        expect((await del()).status).toBe(403);
        asAdmin("obcy");
        db.competition.findUnique.mockResolvedValue({ id: "c1", createdBy: "owner" });
        expect((await del()).status).toBe(403);
        expect(db.competition.delete).not.toHaveBeenCalled();
    });

    it("twórca-admin usuwa konkurencję", async () => {
        asAdmin("owner");
        db.competition.findUnique.mockResolvedValue({ id: "c1", createdBy: "owner" });
        expect((await del()).status).toBe(200);
        expect(db.competition.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    });
});

