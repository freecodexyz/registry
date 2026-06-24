import { useEffect, useEffectEvent, useState } from "react";

let socket: WebSocket | null = null;
const listeners = new Map<string, Set<(p: unknown) => void>>();
let reconnectDelay = 250;

export const MARKET_LIVE_REFETCH_INTERVAL_MS = 12_000;

function ensureSocket() {
    if (socket && socket.readyState <= WebSocket.OPEN) return socket;

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${proto}//${location.host}/ws`);
    socket.onopen = () => {
        reconnectDelay = 250;
        for (const key of listeners.keys()) {
            const [channel, market, interval] = key.split(":");
            socket?.send(JSON.stringify({ type: "sub", channel, market, interval }));
        }
    };
    socket.onmessage = (e) => {
        const { key, payload } = JSON.parse(e.data) as { key: string; payload: unknown };
        listeners.get(key)?.forEach((cb) => cb(payload));
    };
    socket.onclose = () => {
        socket = null;
        setTimeout(ensureSocket, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 10_000);
    };

    return socket;
}

export function useSubscription<T>(
    channel: string,
    market: string,
    cb: (p: T) => void,
    interval?: string,
) {
    const [, setVersion] = useState(0);
    const onPayload = useEffectEvent((payload: unknown) => {
        cb(payload as T);
        setVersion((version) => version + 1);
    });

    useEffect(() => {
        const key = `${channel}:${market}${interval ? `:${interval}` : ""}`;
        const set = listeners.get(key) ?? new Set<(p: unknown) => void>();
        const listener = (payload: unknown) => onPayload(payload);

        set.add(listener);
        listeners.set(key, set);

        const s = ensureSocket();
        if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify({ type: "sub", channel, market, interval }));
        }

        return () => {
            set.delete(listener);
            if (set.size === 0) {
                listeners.delete(key);
                if (s.readyState === WebSocket.OPEN) {
                    s.send(JSON.stringify({ type: "unsub", channel, market, interval }));
                }
            }
        };
    }, [channel, market, interval]);
}
