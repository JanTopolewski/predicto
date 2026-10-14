import { describe, expect, it } from "vitest";
import { DELETE, PATCH } from "../../app/api/users/[id]/route";
import { GET as LIST } from "../../app/api/users/route";
import { NextRequest } from "next/server";
import { asAdmin, asAnon, asUser, ctx, db, jsonReq } from "../helpers";

const patch = (id: string, body: unknown) => PATCH(jsonReq(body, "PATCH"), ctx({ id }));
const del = (id: string) => DELETE(jsonReq(undefined, "DELETE"), ctx({ id }));
const list = (qs = "") => LIST(new NextRequest(`http://localhost/api/users${qs}`));

describe("/api/users/[id] - kontrola dostępu", () => {
    it("anonim i zwykły user dostają 403 na PATCH i DELETE", async () => {
        for (const as of [asAnon, () => asUser()]) {
            as();
            expect((await patch("x", { role: "ADMIN" })).status).toBe(403);
            expect((await del("x")).status).toBe(403);
        }
        expect(db.user.update).not.toHaveBeenCalled();
        expect(db.user.delete).not.toHaveBeenCalled();
    });

    it("SECURITY: zwykły user nie może nadać sobie ADMIN", async () => {
        asUser("user1");
        expect((await patch("user1", { role: "ADMIN" })).status).toBe(403);
    });
});

describe("DELETE /api/users/[id]", () => {
    it("admin nie może usunąć własnego konta", async () => {
        asAdmin("admin1");
        expect((await del("admin1")).status).toBe(400);
        expect(db.user.delete).not.toHaveBeenCalled();
    });

    it("admin usuwa innego użytkownika", async () => {
        asAdmin("admin1");
        expect((await del("user9")).status).toBe(200);
        expect(db.user.delete).toHaveBeenCalledWith({ where: { id: "user9" } });
    });
});

describe("PATCH /api/users/[id]", () => {
    it("404 gdy użytkownik nie istnieje", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue(null);
        expect((await patch("x", { role: "USER" })).status).toBe(404);
    });

    it.each([
        [{}, "puste body"],
        [{ role: "SUPERADMIN" }, "nieznana rola"],
        [{ role: null }, "role null"],
        [{ password: "krotkie" }, "za krótkie hasło"],
        [{ password: "          " }, "hasło z samych spacji"],
        [{ password: 12345678 }, "hasło nie-string"],
    ])("400: %j (%s)", async (body, _label) => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ id: "u2" });
        expect((await patch("u2", body)).status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it("zmiana roli nie zwraca passwordHash", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ id: "u2" });
        db.user.update.mockResolvedValue({ id: "u2", role: "ADMIN" });
        const res = await patch("u2", { role: "ADMIN" });
        expect(res.status).toBe(200);
        expect(db.user.update.mock.calls[0][0].select).not.toHaveProperty("passwordHash");
    });

    it("reset hasła zapisuje hash zamiast jawnego hasła", async () => {
        asAdmin();
        db.user.findUnique.mockResolvedValue({ id: "u2" });
        db.user.update.mockResolvedValue({ id: "u2" });
        await patch("u2", { password: "noweHaslo123" });
        const data = db.user.update.mock.calls[0][0].data;
        expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
        expect(data).not.toHaveProperty("password");
    });

    // BUG: admin może zdegradować samego siebie (możliwość pozostawienia systemu bez admina).
    it.fails("BUG: admin nie może odebrać sobie roli ADMIN", async () => {
        asAdmin("admin1");
        db.user.findUnique.mockResolvedValue({ id: "admin1" });
        expect((await patch("admin1", { role: "USER" })).status).toBe(400);
    });
});

describe("GET /api/users", () => {
    it("403 dla nie-admina", async () => {
        asUser();
        expect((await list()).status).toBe(403);
    });

    it("nigdy nie wybiera passwordHash i ogranicza limit do 100", async () => {
        asAdmin();
        db.user.findMany.mockResolvedValue([]);
        db.user.count.mockResolvedValue(0);
        await list("?limit=100000");
        const arg = db.user.findMany.mock.calls[0][0];
        expect(arg.select).not.toHaveProperty("passwordHash");
        expect(arg.take).toBe(100);
    });

    it("paginacja: strona 3 przy limit 10 pomija 20", async () => {
        asAdmin();
        db.user.findMany.mockResolvedValue([]);
        db.user.count.mockResolvedValue(45);
        const body = await (await list("?page=3&limit=10")).json();
        expect(db.user.findMany.mock.calls[0][0].skip).toBe(20);
        expect(body.totalPages).toBe(5);
    });

    // BUG: limit=abc / 0 / ujemny trafia do Prisma jako NaN / 0 / liczba ujemna.
    it.fails.each(["abc", "0", "-5"])("BUG: limit=%s daje bezpieczną wartość >0", async (limit) => {
        asAdmin();
        db.user.findMany.mockResolvedValue([]);
        db.user.count.mockResolvedValue(0);
        await list(`?limit=${limit}`);
        const take = db.user.findMany.mock.calls[0][0].take;
        expect(Number.isFinite(take) && take > 0).toBe(true);
    });
});
