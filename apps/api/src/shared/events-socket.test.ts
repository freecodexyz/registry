// @ts-ignore
import { createConnection } from "node:net";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { EventsSocket, type EventMessage } from "../shared/events-socket";

// @ts-ignore
const TEST_PORT = 30_000 + (process.pid % 10_000);
const errors: Error[] = [];
const socket = EventsSocket.create({
    port: TEST_PORT,
    onError: (error) => errors.push(error),
});

describe("EventsSocket", () => {
    beforeEach(() => {
        errors.length = 0;
    });

    afterAll(async () => {
        await socket.close();
    });

    it("returns the same singleton instance", () => {
        expect(EventsSocket.create()).toBe(socket);
    });

    it("delivers written messages to attached consumers", async () => {
        const received: EventMessage[] = [];
        const consumer = socket.attach((message) => { received.push(message); });
        const message = { topic: "repo", payload: { repoId: "1" } } satisfies EventMessage;

        await writeEventually(message);
        await waitFor(() => received.length === 1);

        expect(received).toEqual([message]);
        socket.detach(consumer);
    });

    it("stops delivering messages to detached consumers", async () => {
        const received: EventMessage[] = [];
        const consumer = socket.attach((message) => { received.push(message); });

        socket.detach(consumer);
        await writeEventually({ topic: "repo", payload: { repoId: "2" } });
        await wait(25);

        expect(received).toEqual([]);
    });

    it("parses multiple newline-delimited messages from one TCP connection", async () => {
        const received: EventMessage[] = [];
        const consumer = socket.attach((message) => { received.push(message); });
        const messages = [
            { topic: "trades:1", payload: { txHash: "0x1" } },
            { topic: "candles:1:1m", payload: { time: 1, close: 2 } },
        ] satisfies EventMessage[];

        await writeRaw(messages.map((message) => JSON.stringify(message)).join("\n") + "\n");
        await waitFor(() => received.length === messages.length);

        expect(received).toEqual(messages);
        socket.detach(consumer);
    });

    it("reports malformed messages without calling consumers", async () => {
        const received: EventMessage[] = [];
        const consumer = socket.attach((message) => { received.push(message); });

        await writeRaw("not-json\n{}");
        await waitFor(() => errors.length === 2);

        expect(received).toEqual([]);
        expect(errors).toHaveLength(2);
        expect(errors.every((error) => error instanceof Error)).toBe(true);
        socket.detach(consumer);
    });
});

async function writeEventually(message: EventMessage): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
            await socket.write(message);
            return;
        } catch (error) {
            lastError = error;
            await wait(10);
        }
    }

    throw lastError;
}

async function writeRaw(value: string): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
            await writeRawOnce(value);
            return;
        } catch (error) {
            lastError = error;
            await wait(10);
        }
    }

    throw lastError;
}

async function writeRawOnce(value: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const client = createConnection({ host: "127.0.0.1", port: TEST_PORT });

        client.once("error", reject);
        client.once("connect", () => client.end(value, "utf8", resolve));
    });
}

async function waitFor(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        if (predicate()) return;
        await wait(10);
    }

    throw new Error("condition was not met");
}

async function wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
