import bcrypt from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";
import { PATCH } from "../../app/api/auth/password/route";
import { asAnon, asUser, db, jsonReq } from "../helpers";

const OLD_PASSWORD = "stareHasło_żółć123";
const NEW_PASSWORD = "noweHasło_Gęślą456";

let hash: string;
beforeAll(async () => {
    hash = await bcrypt.hash(OLD_PASSWORD, 4);
});

const call = (body: unknown) => PATCH(jsonReq(body, "PATCH"));

describe("PATCH /api/auth/password", () => {
    it("returns 401 without a session", async () => {
        asAnon();
        expect((await call({ currentPassword: "a", newPassword: "b" })).status).toBe(401);
    });

    it.each([
        [{}],
        [{ currentPassword: OLD_PASSWORD }],
        [{ currentPassword: OLD_PASSWORD, newPassword: "krótkie" }],
    ])("returns 400 for invalid body %j", async (body) => {
        asUser();
        expect((await call(body)).status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the current password is wrong - password is not changed", async () => {
        asUser();
        db.user.findUnique.mockResolvedValue({ id: "user1", passwordHash: hash });
        const res = await call({ currentPassword: "złe", newPassword: NEW_PASSWORD });
        expect(res.status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it("returns 400 when the new password equals the old one", async () => {
        asUser();
        db.user.findUnique.mockResolvedValue({ id: "user1", passwordHash: hash });
        const res = await call({ currentPassword: OLD_PASSWORD, newPassword: OLD_PASSWORD });
        expect(res.status).toBe(400);
    });

    it("changes the password only for the logged-in user and stores a valid hash", async () => {
        asUser("user1");
        db.user.findUnique.mockResolvedValue({ id: "user1", passwordHash: hash });
        const res = await call({
            currentPassword: OLD_PASSWORD,
            newPassword: NEW_PASSWORD,
            userId: "ofiara",
        });
        expect(res.status).toBe(200);
        const arg = db.user.update.mock.calls[0][0];
        expect(arg.where).toEqual({ id: "user1" });
        expect(await bcrypt.compare(NEW_PASSWORD, arg.data.passwordHash)).toBe(true);
    });
});
