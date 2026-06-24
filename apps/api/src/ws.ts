import websocket from "@fastify/websocket";
import type { FastifyInstance, FastifyRequest } from "fastify";

type Sub = { channel: "candles" | "trades" | "depth"; market: string; interval?: string };
type Hub = {
    on(event: "event", listener: (key: string, payload: unknown) => void): void;
    off(event: "event", listener: (key: string, payload: unknown) => void): void;
};
type Authorize = (req: FastifyRequest) => Promise<boolean>;

export async function registerWs(app: FastifyInstance, hub: Hub, authorize?: Authorize) {
    await app.register(websocket);
    app.get("/ws", { websocket: true }, async (socket, req) => {
        if (authorize && !(await authorize(req))) {
            socket.close(1008, "not entitled");
            return;
        }

        const subs = new Set<string>();
        const onEvent = (key: string, payload: unknown) => {
            if (!subs.has(key)) return;
            socket.send(JSON.stringify({ key, payload }));
        };

        hub.on("event", onEvent);
        socket.on("message", (buf: { toString(): string }) => {
            const msg = JSON.parse(buf.toString()) as Sub & { type: "sub" | "unsub" };
            const key = `${msg.channel}:${msg.market}${msg.interval ? `:${msg.interval}` : ""}`;

            if (msg.type === "sub") subs.add(key);
            if (msg.type === "unsub") subs.delete(key);
        });
        socket.on("close", () => hub.off("event", onEvent));
    });
}
