import { describe, expect, it } from "vitest";
import { DELETE, PATCH } from "../../app/api/users/[id]/route";
import { GET as LIST } from "../../app/api/users/route";
import { NextRequest } from "next/server";
import { asAdmin, asAnon, asUser, ctx, db, jsonReq } from "../helpers";

const patch = (id: string, body: unknown) => PATCH(jsonReq(body, "PATCH"), ctx({ id }));
const del = (id: string) => DELETE(jsonReq(undefined, "DELETE"), ctx({ id }));
const list = (qs = "") => LIST(new NextRequest(`http://localhost/api/users${qs}`));

describe("/api/users/[id] - access control", () => {
    it("anonymous and regular users get 403 on PATCH and DELETE", async () => {
        for (const as of [asAnon, () => asUser()]) {
            as();
            expect((await patch("x", { role: "ADMIN" })).status).toBe(403);
            expect((await del("x")).status).toBe(403);
        }
        expect(db.user.update).not.toHaveBeenCalled();
        expect(db.user.delete).not.toHaveBeenCalled();
    });

    it("SECURITY: a regular user cannot grant themselves ADMIN", async () => {
        asUser("user1");
        expect((await patch("user1", { role: "ADMIN" })).status).toBe(403);
    });
});

describe("DELETE /api/users/[id]", () => {
    it("an admin cannot delete their own account", async () => {
        asAdmin("admin1");
        expect((await del("admin1")).status).toBe(400);
        expect(db.user.delete).not.toHaveBeenCalled();
    });

    it("an admin deletes another user", async () => {
        asAdmin("admin1");
        expect((await del("user9")).status).toBe(200);
        expect(db.user.delete).toHaveBeenCalledWith({ where: { id: "user9" } });
    });
});

describe("PATCH /api/users/[id]", () => {
    it("returns 404 when the user does not exist", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue(null);
        expect((await patch("x", { role: "USER" })).status).toBe(404);
    });

    it.each([
        [{}, "empty body"],
        [{ role: "SUPERADMIN" }, "unknown role"],
        [{ role: null }, "null role"],
        [{ password: "krótkie" }, "too short password"],
        [{ password: "          " }, "whitespace-only password"],
        [{ password: 12345678 }, "non-string password"],
    ])("returns 400: %j (%s)", async (body, _label) => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ id: "u2" });
        expect((await patch("u2", body)).status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it("a role change does not return passwordHash", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ id: "u2" });
        db.user.update.mockResolvedValue({ id: "u2", role: "ADMIN" });
        const res = await patch("u2", { role: "ADMIN" });
        expect(res.status).toBe(200);
        expect(db.user.update.mock.calls[0][0].select).not.toHaveProperty("passwordHash");
    });

    it("a password reset stores a hash instead of the plain password", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ id: "u2" });
        db.user.update.mockResolvedValue({ id: "u2" });
        await patch("u2", { password: "noweHasło_żółć123" });
        const data = db.user.update.mock.calls[0][0].data;
        expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
        expect(data).not.toHaveProperty("password");
    });

    it("an admin cannot remove their own ADMIN role", async () => {
        asAdmin("admin1");
        db.user.findUnique.mockResolvedValue({ id: "admin1" });
        expect((await patch("admin1", { role: "USER" })).status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });
});

describe("GET /api/users", () => {
    it("returns 403 for a non-admin", async () => {
        asUser();
        expect((await list()).status).toBe(403);
    });

    it("never selects passwordHash and caps the limit at 100", async () => {
        asAdmin();
        db.user.findMany.mockResolvedValue([]);
        db.user.count.mockResolvedValue(0);
        await list("?limit=100000");
        const arg = db.user.findMany.mock.calls[0][0];
        expect(arg.select).not.toHaveProperty("passwordHash");
        expect(arg.take).toBe(100);
    });

    it("pagination: page 3 with limit 10 skips 20", async () => {
        asAdmin();
        db.user.findMany.mockResolvedValue([]);
        db.user.count.mockResolvedValue(45);
        const body = await (await list("?page=3&limit=10")).json();
        expect(db.user.findMany.mock.calls[0][0].skip).toBe(20);
        expect(body.totalPages).toBe(5);
    });

    it.each(["abc", "0", "-5"])("limit=%s results in a safe value > 0", async (limit) => {
        asAdmin();
        db.user.findMany.mockResolvedValue([]);
        db.user.count.mockResolvedValue(0);
        await list(`?limit=${limit}`);
        const take = db.user.findMany.mock.calls[0][0].take;
        expect(Number.isFinite(take) && take > 0).toBe(true);
    });
});
