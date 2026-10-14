import { beforeEach, vi } from "vitest";
import { resetPrismaMock } from "./mocks/prisma";
import { auth } from "./mocks/auth";

beforeEach(() => {
    resetPrismaMock();
    (auth as ReturnType<typeof vi.fn>).mockReset();
    // handlery logują błędy 500 - nie zaśmiecamy outputu
    vi.spyOn(console, "error").mockImplementation(() => {});
});

