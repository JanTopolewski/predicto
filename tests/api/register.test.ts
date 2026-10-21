import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/auth/register/route";
import { db, jsonReq } from "../helpers";

const PL_PASSWORD = "zażółćGęśląJaźń123!";
const valid = { username: "Żaneta_Kowalska", email: "zaneta@test.pl", password: PL_PASSWORD, acceptTerms: true };
const call = (body: unknown) => POST(jsonReq(body));

describe("POST /api/auth/register", () => {
    it.each([
        [{}],
        [{ ...valid, username: "" }],
        [{ ...valid, email: undefined }],
        [{ ...valid, email: "invalid-email" }],
        [{ ...valid, password: "1234567" }],
        [{ ...valid, acceptTerms: false }],
        [{ ...valid, acceptTerms: undefined }],
    ])("returns 400 for invalid data %j", async (body) => {
        expect((await call(body)).status).toBe(400);
        expect(db.user.create).not.toHaveBeenCalled();
    });

    it("returns 409 when the email is taken / 409 when the username is taken", async () => {
        db.user.findFirst.mockResolvedValue({ email: valid.email, username: "x" });
        const r1 = await call(valid);
        expect(r1.status).toBe(409);
        const b1 = await r1.json();
        expect(b1.code).toBe("EMAIL_TAKEN");
        expect(b1.error).toMatch(/Email/i);

        db.user.findFirst.mockResolvedValue({ email: "inny@test.pl", username: valid.username });
        const r2 = await call(valid);
        expect(r2.status).toBe(409);
        const b2 = await r2.json();
        expect(b2.code).toBe("USERNAME_TAKEN");
        expect(b2.error).toMatch(/Username/i);
    });

    it("stores a bcrypt hash (not the plain password) that verifies, incl. non-ASCII passwords", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockImplementation(async ({ data }: any) => ({ id: "u1", ...data }));

        const res = await call(valid);
        expect(res.status).toBe(201);

        const { data } = db.user.create.mock.calls[0][0];
        expect(data.passwordHash).not.toBe(PL_PASSWORD);
        expect(await bcrypt.compare(PL_PASSWORD, data.passwordHash)).toBe(true);
    });

    it("response contains neither the hash nor the password", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockImplementation(async ({ data }: any) => ({ id: "u1", ...data }));
        const text = JSON.stringify(await (await call(valid)).json());
        expect(text).not.toMatch(/passwordHash/);
        expect(text).not.toContain(PL_PASSWORD);
    });

    it("SECURITY: cannot register as ADMIN via a role field in the body", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockImplementation(async ({ data }: any) => ({ id: "u1", ...data }));
        await call({ ...valid, role: "ADMIN" });
        expect(db.user.create.mock.calls[0][0].data.role).toBe("USER");
    });

    it("a registration race returns 409, not 500", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockRejectedValue({ code: "P2002" });
        expect((await call(valid)).status).toBe(409);
    });

    it("a non-string password returns 400", async () => {
        db.user.findFirst.mockResolvedValue(null);
        expect((await call({ ...valid, password: 12345678 })).status).toBe(400);
    });

    it("email is normalized to lowercase and checked case-insensitively", async () => {
        db.user.findFirst.mockResolvedValue(null);
        db.user.create.mockImplementation(async ({ data }: any) => ({ id: "u1", ...data }));
        await call({ ...valid, email: "Zaneta@Test.PL" });
        expect(db.user.findFirst).toHaveBeenCalledWith({
            where: {
                OR: [
                    { email: { equals: "zaneta@test.pl", mode: "insensitive" } },
                    { username: valid.username },
                ],
            },
        });
        expect(db.user.create.mock.calls[0][0].data.email).toBe("zaneta@test.pl");
    });
});
