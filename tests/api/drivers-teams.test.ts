import { describe, expect, it } from "vitest";
import { GET as listDrivers, POST as createDriver } from "../../app/api/drivers/route";
import {
    DELETE as deleteDriver,
    GET as getDriver,
    PUT as updateDriver,
} from "../../app/api/drivers/[id]/route";
import { GET as listTeams, POST as createTeam } from "../../app/api/teams/route";
import {
    DELETE as deleteTeam,
    GET as getTeam,
    PUT as updateTeam,
} from "../../app/api/teams/[id]/route";
import { asAnon, asUser, ctx, db, jsonReq } from "../helpers";

const idCtx = ctx({ id: "x1" });
const req = (body?: unknown, method = "POST") => jsonReq(body, method) as never;

/** These routes check the role in the DB (not in the JWT) - the session only provides the id. */
const withDbRole = (role: "ADMIN" | "USER") => {
    asUser("u1");
    db.user.findUnique.mockResolvedValue({ role });
};

const protectedHandlers: [string, () => Promise<Response>][] = [
    ["GET /drivers", () => listDrivers()],
    ["POST /drivers", () => createDriver(req({ name: "A", number: 1, team: "T" }))],
    ["GET /drivers/[id]", () => getDriver(req(undefined, "GET"), idCtx)],
    ["PUT /drivers/[id]", () => updateDriver(req({ name: "A", number: 1, team: "T" }, "PUT"), idCtx)],
    ["DELETE /drivers/[id]", () => deleteDriver(req(undefined, "DELETE"), idCtx)],
    ["GET /teams", () => listTeams(req(undefined, "GET"))],
    ["POST /teams", () => createTeam(req({ name: "A", shortName: "a" }))],
    ["GET /teams/[id]", () => getTeam(req(undefined, "GET"), idCtx)],
    ["PUT /teams/[id]", () => updateTeam(req({ name: "A", shortName: "a" }, "PUT"), idCtx)],
    ["DELETE /teams/[id]", () => deleteTeam(req(undefined, "DELETE"), idCtx)],
];

describe("drivers & teams - access control", () => {
    it.each(protectedHandlers)("%s: 401 for anonymous", async (_n, call) => {
        asAnon();
        expect((await call()).status).toBe(401);
    });

    it.each(protectedHandlers)("%s: 403 for a regular user, nothing is modified", async (_n, call) => {
        withDbRole("USER");
        expect((await call()).status).toBe(403);
        for (const model of ["driver", "team"]) {
            expect(db[model].create).not.toHaveBeenCalled();
            expect(db[model].update).not.toHaveBeenCalled();
            expect(db[model].delete).not.toHaveBeenCalled();
        }
    });

    it("SECURITY: a stale ADMIN role in the JWT does not help when the DB says USER", async () => {
        // session mock claims ADMIN, but the DB (source of truth) says the user was demoted
        const { auth } = await import("../mocks/auth");
        (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
        db.user.findUnique.mockResolvedValue({ role: "USER" });
        expect((await createDriver(req({ name: "A", number: 1, team: "T" }))).status).toBe(403);
        expect((await createTeam(req({ name: "A", shortName: "a" }))).status).toBe(403);
    });
});

describe("POST /api/drivers", () => {
    const call = (body: unknown) => createDriver(req(body));

    it.each([
        [{}, "empty body"],
        [{ name: "Max", team: "RB" }, "missing number"],
        [{ name: "Max", number: 0, team: "RB" }, "number 0"],
        [{ name: "Max", number: -3, team: "RB" }, "negative number"],
        [{ name: "Max", number: 1.5, team: "RB" }, "fractional number"],
        [{ name: "Max", number: "33", team: "RB" }, "number as a string"],
    ])("400: %j (%s)", async (body, _label) => {
        withDbRole("ADMIN");
        expect((await call(body)).status).toBe(400);
        expect(db.driver.create).not.toHaveBeenCalled();
    });

    it("409 when the number is already taken", async () => {
        withDbRole("ADMIN");
        db.driver.findUnique.mockResolvedValue({ id: "other" });
        expect((await call({ name: "Max", number: 33, team: "RB" })).status).toBe(409);
    });

    it("creates a driver (Polish diacritics in the name are preserved)", async () => {
        withDbRole("ADMIN");
        db.driver.findUnique.mockResolvedValue(null);
        db.driver.create.mockImplementation(async ({ data }: any) => ({ id: "d1", ...data }));
        const res = await call({ name: "Łukasz Żółć", number: 88, team: "Orlen Team" });
        expect(res.status).toBe(201);
        expect(db.driver.create.mock.calls[0][0].data).toEqual({
            name: "Łukasz Żółć",
            number: 88,
            team: "Orlen Team",
        });
    });

    it("GET /api/teams supports ?sort=name", async () => {
        withDbRole("ADMIN");
        db.team.findMany.mockResolvedValue([]);
        const res = await listTeams(jsonReq(undefined, "GET", "http://localhost/api/teams?sort=name") as never);
        expect(res.status).toBe(200);
        expect(db.team.findMany).toHaveBeenCalledWith({
            orderBy: { name: "asc" },
        });
    });
});

describe("PUT /api/drivers/[id]", () => {
    const call = (body: unknown) => updateDriver(req(body, "PUT"), idCtx);
    const body = { name: "Max", number: 33, team: "RB" };

    it("404 for an unknown driver", async () => {
        withDbRole("ADMIN");
        db.driver.findUnique.mockResolvedValue(null);
        expect((await call(body)).status).toBe(404);
    });

    it("409 when the number belongs to a different driver", async () => {
        withDbRole("ADMIN");
        db.driver.findUnique.mockImplementation(async ({ where }: any) =>
            where.number ? { id: "other" } : { id: "x1" }
        );
        expect((await call(body)).status).toBe(409);
        expect(db.driver.update).not.toHaveBeenCalled();
    });

    it("allows saving the driver with their own, unchanged number", async () => {
        withDbRole("ADMIN");
        db.driver.findUnique.mockImplementation(async () => ({ id: "x1" }));
        db.driver.update.mockImplementation(async ({ data }: any) => data);
        expect((await call(body)).status).toBe(200);
    });
});

describe("DELETE /api/drivers/[id] and /api/teams/[id] - referential integrity", () => {
    const usedDriver = (field: string) => ({
        id: "x1",
        _count: {
            sessionParticipants: 0,
            racingResults: 0,
            wildcards: 0,
            seasonWinnerPredictions: 0,
            racingPredictionFirsts: 0,
            racingPredictionSeconds: 0,
            racingPredictionThirds: 0,
            [field]: 1,
        },
    });

    it.each([
        "sessionParticipants",
        "racingResults",
        "wildcards",
        "seasonWinnerPredictions",
        "racingPredictionFirsts",
        "racingPredictionSeconds",
        "racingPredictionThirds",
    ])("a driver referenced by %s cannot be deleted (409)", async (field) => {
        withDbRole("ADMIN");
        db.driver.findUnique.mockResolvedValue(usedDriver(field));
        expect((await deleteDriver(req(undefined, "DELETE"), idCtx)).status).toBe(409);
        expect(db.driver.delete).not.toHaveBeenCalled();
    });

    it("an unused driver is deleted", async () => {
        withDbRole("ADMIN");
        db.driver.findUnique.mockResolvedValue(usedDriver("none"));
        expect((await deleteDriver(req(undefined, "DELETE"), idCtx)).status).toBe(200);
        expect(db.driver.delete).toHaveBeenCalledWith({ where: { id: "x1" } });
    });

    it.each(["homeMatches", "awayMatches", "seasonWinnerPredictions"])(
        "a team referenced by %s cannot be deleted (409)",
        async (field) => {
            withDbRole("ADMIN");
            db.team.findUnique.mockResolvedValue({
                id: "x1",
                _count: { homeMatches: 0, awayMatches: 0, seasonWinnerPredictions: 0, [field]: 2 },
            });
            expect((await deleteTeam(req(undefined, "DELETE"), idCtx)).status).toBe(409);
            expect(db.team.delete).not.toHaveBeenCalled();
        }
    );

    it("an unused team is deleted", async () => {
        withDbRole("ADMIN");
        db.team.findUnique.mockResolvedValue({
            id: "x1",
            _count: { homeMatches: 0, awayMatches: 0, seasonWinnerPredictions: 0 },
        });
        expect((await deleteTeam(req(undefined, "DELETE"), idCtx)).status).toBe(200);
    });
});

describe("teams", () => {
    it("POST: the short name is stored in upper case and checked for uniqueness in upper case", async () => {
        withDbRole("ADMIN");
        db.team.findUnique.mockResolvedValue(null);
        db.team.create.mockImplementation(async ({ data }: any) => ({ id: "t1", ...data }));
        const res = await createTeam(req({ name: "Legia Warszawa", shortName: "leg" }));
        expect(res.status).toBe(201);
        expect(db.team.findUnique.mock.calls[0][0].where).toEqual({ shortName: "LEG" });
        expect(db.team.create.mock.calls[0][0].data.shortName).toBe("LEG");
    });

    it("POST: 409 for a duplicated short name regardless of case", async () => {
        withDbRole("ADMIN");
        db.team.findUnique.mockResolvedValue({ id: "t0" });
        expect((await createTeam(req({ name: "Inna", shortName: "leg" }))).status).toBe(409);
    });

    it("POST: 400 when name or short name is missing", async () => {
        withDbRole("ADMIN");
        expect((await createTeam(req({ name: "Legia" }))).status).toBe(400);
        expect((await createTeam(req({ shortName: "LEG" }))).status).toBe(400);
    });

    it("PUT: 409 when the short name belongs to another team, own short name is fine", async () => {
        withDbRole("ADMIN");
        db.team.findUnique.mockImplementation(async ({ where }: any) =>
            where.shortName ? { id: "other" } : { id: "x1" }
        );
        expect((await updateTeam(req({ name: "A", shortName: "b" }, "PUT"), idCtx)).status).toBe(409);

        db.team.findUnique.mockImplementation(async ({ where }: any) =>
            where.shortName ? { id: "x1" } : { id: "x1" }
        );
        db.team.update.mockImplementation(async ({ data }: any) => data);
        expect((await updateTeam(req({ name: "A", shortName: "b" }, "PUT"), idCtx)).status).toBe(200);
    });

    it("a non-string shortName returns 400", async () => {
        withDbRole("ADMIN");
        expect((await createTeam(req({ name: "Legia", shortName: 123 }))).status).toBe(400);
        expect((await createTeam(req({ name: "Legia", shortName: { id: "test" } }))).status).toBe(400);
        expect((await updateTeam(req({ name: "Legia", shortName: 123 }, "PUT"), idCtx)).status).toBe(400);
    });
});

