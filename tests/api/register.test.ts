import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/auth/register/route";
import { db, jsonReq } from "../helpers";

const valid = { username: "jan", email: "jan@test.pl", password: "tajnehaslo123" };
const call = (body: unknown) => POST(jsonReq(body));

describe("POST /api/auth/register", () => {
    it.each([
        [{}],
        [{ ...valid, username: "" }],
        [{ ...valid, email: undefined }],
        [{ ...valid, password: "1234567" }],
    ])("400 dla niepoprawnych danych %j", async (body) => {
        expect((await call(body)).status).toBe(400);
        expect(db.user.create).not.toHaveBeenCalled();
    });

    it("409 gdy email zajęty / 409 gdy nazwa zajęta", async () => {
        db.user.findFirst.mockResolvedValue({ email: valid.email, username: "x" });
        const r1 = await call(valid);
        expect(r1.status).toBe(409);
        expect((await r1.json()).message).toMatch(/Email/);

        db.user.findFirst.mockResolvedValue({ email: "inny@test.pl", username: valid.username });
        const r2 = await call(valid);
        expect(r2.status).toBe(409);
        expect((await r2.json()).message).toMatch(/Nazwa/);
    });

    it("zapisuje hash (nie jawne hasło), który weryfikuje się bcryptem", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockImplementation(async ({ data }: any) => ({ id: "u1", ...data }));

        const res = await call(valid);
        expect(res.status).toBe(201);

        const { data } = db.user.create.mock.calls[0][0];
        expect(data.passwordHash).not.toBe(valid.password);
        expect(await bcrypt.compare(valid.password, data.passwordHash)).toBe(true);
    });

    it("odpowiedź nie zawiera hasha ani hasła", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockImplementation(async ({ data }: any) => ({ id: "u1", ...data }));
        const text = JSON.stringify(await (await call(valid)).json());
        expect(text).not.toMatch(/passwordHash|tajnehaslo123/);
    });

    it("SECURITY: nie da się zarejestrować jako ADMIN przez pole role w body", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockImplementation(async ({ data }: any) => ({ id: "u1", ...data }));
        await call({ ...valid, role: "ADMIN" });
        expect(db.user.create.mock.calls[0][0].data.role).toBe("USER");
    });

    // BUG: równoległa rejestracja tego samego emaila -> naruszenie unique (P2002) zwraca 500 zamiast 409.
    it.fails("BUG: wyścig przy rejestracji zwraca 409, nie 500", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockRejectedValue({ code: "P2002" });
        expect((await call(valid)).status).toBe(409);
    });

    // BUG: hasło nie-string (np. liczba) przechodzi walidację długości i wywala bcrypt -> 500.
    it.fails("BUG: hasło niebędące stringiem daje 400", async () => {
        db.user.findFirst.mockResolvedValue(null);
        expect((await call({ ...valid, password: 12345678 })).status).toBe(400);
    });

    // BUG: email jest case-sensitive, można założyć Jan@x.pl i jan@x.pl jako dwa konta.
    it.fails("BUG: email jest normalizowany do małych liter", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockImplementation(async ({ data }: any) => ({ id: "u1", ...data }));
        await call({ ...valid, email: "Jan@Test.PL" });
        expect(db.user.create.mock.calls[0][0].data.email).toBe("jan@test.pl");
    });
});

