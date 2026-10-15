/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// Mock klienta Prisma: każde `prisma.<model>.<metoda>` to automatycznie tworzony vi.fn().
const fns = new Map<string, ReturnType<typeof vi.fn>>();
const models = new Map<string, any>();

function modelProxy(name: string) {
    return new Proxy(
        {},
        {
            get(_t, method: string) {
                const key = `${name}.${method}`;
                if (!fns.has(key)) fns.set(key, vi.fn());
                return fns.get(key);
            },
        }
    );
}

export const prisma: any = new Proxy(
    {},
    {
        get(_t, prop: string) {
            if (prop === "$transaction") {
                // callback -> dostaje ten sam mock jako `tx`; tablica -> Promise.all
                return async (arg: any) =>
                    typeof arg === "function" ? arg(prisma) : Promise.all(arg);
            }
            if (!models.has(prop)) models.set(prop, modelProxy(prop));
            return models.get(prop);
        },
    }
);

export function resetPrismaMock() {
    fns.forEach((fn) => fn.mockReset());
}

