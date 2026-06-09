import { useEffect, useState } from "react";
import type { Repo } from "./App";

export function useLiveRepos(initial: Repo[]) {
    const [repos, setRepos] = useState<Repo[]>(initial);

    useEffect(() => {
        setRepos(initial);
    }, [initial]);

    useEffect(() => {
        const es = new EventSource("/api/repos/stream", { withCredentials: true });
        es.onmessage = (e) => {
            const row = JSON.parse(e.data) as Repo;
            setRepos((cur) => {
                const existing = cur.findIndex((repo) => repo.repoId === row.repoId);
                if (existing === -1) return [row, ...cur];

                const next = [...cur];
                next[existing] = row;
                return next;
            });
        };
        return () => es.close();
    }, []);

    return repos;
}
