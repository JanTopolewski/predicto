import path from "node:path";
import { defineConfig } from "vitest/config";

const root = __dirname;

export default defineConfig({
    resolve: {
        // Specyficzne aliasy muszą być przed ogólnym "@/".
        // Prisma i auth podmieniamy na mocki - testy nie potrzebują bazy ani next-auth.
        alias: [
            { find: "@/lib/prisma", replacement: path.resolve(root, "tests/mocks/prisma.ts") },
            { find: "@/lib/auth", replacement: path.resolve(root, "tests/mocks/auth.ts") },
            { find: /^@\//, replacement: root.replace(/\\/g, "/") + "/" },
        ],
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
        // bcrypt (cost 10) bywa wolny na CI
        testTimeout: 15000,
    },
});

