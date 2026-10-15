/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import type { Mock } from "vitest";
import { auth } from "./mocks/auth";
import { prisma } from "./mocks/prisma";

export const db: any = prisma;
const authMock = auth as unknown as Mock;

export const asAnon = () => authMock.mockResolvedValue(null);
export const asUser = (id = "user1") =>
    authMock.mockResolvedValue({ user: { id, role: "USER", email: `${id}@test.pl` } });
export const asAdmin = (id = "admin1") =>
    authMock.mockResolvedValue({ user: { id, role: "ADMIN", email: `${id}@test.pl` } });

export const jsonReq = (body?: unknown, method = "POST", url = "http://localhost/api/test") =>
    new NextRequest(url, {
        method,
        ...(body !== undefined
            ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } }
            : {}),
    });

export const ctx = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

export const calls = (fn: Mock) => fn.mock.calls.map((c) => c[0]);

export const FUTURE = () => new Date(Date.now() + 60 * 60 * 1000);
export const PAST = () => new Date(Date.now() - 60 * 60 * 1000);

