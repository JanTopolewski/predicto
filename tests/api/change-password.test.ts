import bcrypt from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "../../app/api/auth/change-password/route";
import { asAnon, asUser, db, jsonReq } from "../helpers";

let hash: string;
beforeAll(async () => {
    hash = await bcrypt.hash("stareHaslo123", 4);
});

const call = (body: unknown) => POST(jsonReq(body));

describe("POST /api/auth/change-password", () => {
    it("401 bez sesji", async () => {
        asAnon();
        expect((await call({ currentPassword: "a", newPassword: "b" })).status).toBe(401);
    });

    it.each([
        [{}],
        [{ currentPassword: "stareHaslo123" }],
        [{ currentPassword: "stareHaslo123", newPassword: "krotkie" }],
    ])("400 dla niepoprawnego body %j", async (body) => {
        asUser();
        expect((await call(body)).status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it("400 gdy aktualne hasło błędne - hasło nie jest zmieniane", async () => {
        asUser();
        db.user.findUnique.mockResolvedValue({ id: "user1", passwordHash: hash });
        const res = await call({ currentPassword: "zle", newPassword: "noweHaslo123" });
        expect(res.status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it("400 gdy nowe hasło = stare", async () => {
        asUser();
        db.user.findUnique.mockResolvedValue({ id: "user1", passwordHash: hash });
        const res = await call({ currentPassword: "stareHaslo123", newPassword: "stareHaslo123" });
        expect(res.status).toBe(400);
    });

    it("zmienia hasło tylko zalogowanemu użytkownikowi i zapisuje poprawny hash", async () => {
        asUser("user1");
        db.user.findUnique.mockResolvedValue({ id: "user1", passwordHash: hash });
        const res = await call({
            currentPassword: "stareHaslo123",
            newPassword: "noweHaslo123",
            userId: "ofiara",
        });
        expect(res.status).toBe(200);
        const arg = db.user.update.mock.calls[0][0];
        expect(arg.where).toEqual({ id: "user1" });
        expect(await bcrypt.compare("noweHaslo123", arg.data.passwordHash)).toBe(true);
    });
});

