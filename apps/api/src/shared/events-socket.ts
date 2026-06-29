import { createConnection, createServer, type Server, type Socket } from "node:net";

export type EventMessage = {
    topic: string;
    payload: unknown;
};

export type EventConsumer = (message: EventMessage) => void | Promise<void>;

type EventsSocketOptions = {
    host?: string;
    listenHost?: string;
    port?: number;
    onError?: (error: Error) => void;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3055;

export class EventsSocket {
    private static instance: EventsSocket | null = null;

    private readonly host: string;
    private readonly listenHost: string;
    private readonly port: number;
    private readonly onError: ((error: Error) => void) | undefined;
    private readonly consumers = new Set<EventConsumer>();
    private server: Server | null = null;
    private serverStart: Promise<void> | null = null;

    private constructor(options: EventsSocketOptions = {}) {
        this.host = options.host ?? DEFAULT_HOST;
        this.listenHost = options.listenHost ?? this.host;
        this.port = options.port ?? DEFAULT_PORT;
        this.onError = options.onError;
    }

    static create(options: EventsSocketOptions = {}): EventsSocket {
        if (!EventsSocket.instance) EventsSocket.instance = new EventsSocket(options);
        return EventsSocket.instance;
    }

    async write(message: EventMessage): Promise<void> {
        if (!isEventMessage(message)) throw new Error("invalid events socket message");

        const body = JSON.stringify(message);
        if (body === undefined) throw new Error("unable to serialize events socket message");

        await new Promise<void>((resolve, reject) => {
            const socket = createConnection({ host: this.host, port: this.port });
            let settled = false;

            const finish = () => {
                if (settled) return;
                settled = true;
                socket.removeListener("error", fail);
                resolve();
            };
            const fail = (error: Error) => {
                if (settled) return;
                settled = true;
                socket.destroy();
                reject(error);
            };

            socket.once("error", fail);
            socket.once("connect", () => socket.end(`${body}\n`, "utf8", finish));
        });
    }

    attach(consumer: EventConsumer): EventConsumer {
        this.consumers.add(consumer);
        this.ensureServer().catch((error: unknown) => this.reportError(error));
        return consumer;
    }

    detach(consumer: EventConsumer): void {
        this.consumers.delete(consumer);
    }

    async close(): Promise<void> {
        const server = this.server;
        this.server = null;
        this.serverStart = null;
        this.consumers.clear();
        if (!server) return;

        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }

    private ensureServer(): Promise<void> {
        if (this.server) return Promise.resolve();
        if (this.serverStart) return this.serverStart;

        const server = createServer((socket) => this.handleSocket(socket));
        this.server = server;
        this.serverStart = new Promise<void>((resolve, reject) => {
            const onListening = () => {
                server.removeListener("error", onStartError);
                server.on("error", (error) => this.reportError(error));
                resolve();
            };
            const onStartError = (error: Error) => {
                server.removeListener("listening", onListening);
                this.server = null;
                this.serverStart = null;
                reject(error);
            };

            server.once("listening", onListening);
            server.once("error", onStartError);
            server.listen({ host: this.listenHost, port: this.port });
        });

        return this.serverStart;
    }

    private handleSocket(socket: Socket): void {
        socket.setEncoding("utf8");
        let buffer = "";

        socket.on("data", (chunk) => {
            buffer += chunk;
            let newline = buffer.indexOf("\n");

            while (newline !== -1) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                if (line) this.consumeLine(line);
                newline = buffer.indexOf("\n");
            }
        });
        socket.on("end", () => {
            const line = buffer.trim();
            if (line) this.consumeLine(line);
        });
        socket.on("error", (error) => this.reportError(error));
    }

    private consumeLine(line: string): void {
        let parsed: unknown;

        try {
            parsed = JSON.parse(line) as unknown;
        } catch (error) {
            this.reportError(error);
            return;
        }

        if (!isEventMessage(parsed)) {
            this.reportError(new Error("invalid events socket message"));
            return;
        }

        for (const consumer of this.consumers) {
            Promise.resolve(consumer(parsed)).catch((error: unknown) => this.reportError(error));
        }
    }

    private reportError(error: unknown): void {
        const normalized = error instanceof Error ? error : new Error(String(error));
        if (this.onError) this.onError(normalized);
        else console.error(normalized);
    }
}

function isEventMessage(value: unknown): value is EventMessage {
    if (!isRecord(value)) return false;
    return typeof value.topic === "string" && value.topic.length > 0 && "payload" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
