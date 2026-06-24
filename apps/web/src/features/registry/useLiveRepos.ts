import { useEffect, useState } from "react";
import { isRepo, type Repo, type Sort } from "./repositoryTypes";

export function useLiveRepos(initial: Repo[], options: { q: string; sort: Sort }) {
    const [liveRepos, setLiveRepos] = useState<Repo[]>([]);

    useEffect(() => {
        const es = new EventSource("/api/repos/stream", { withCredentials: true });
        es.onmessage = (e) => {
            let row: unknown;
            try {
                row = JSON.parse(e.data) as unknown;
            } catch {
                return;
            }

            if (!isRepo(row)) return;
            setLiveRepos((cur) => [row, ...cur.filter((repo) => repo.repoId !== row.repoId)]);
        };
        return () => es.close();
    }, []);

    const liveIds = new Set(liveRepos.map((repo) => repo.repoId));
    const q = options.q.trim().toLowerCase();
    const repos = [...liveRepos, ...initial.filter((repo) => !liveIds.has(repo.repoId))];
    const visible = q ? repos.filter((repo) => {
        const github = repo.github === "not found" ? null : repo.github;
        return [
            repo.repoId,
            repo.registrant,
            String(repo.githubOwnerId),
            repo.githubOwnerUsername,
            github?.fullName,
            github?.description,
            github?.language,
            repo.transactionHash,
            String(repo.blockNumber),
            String(repo.chainId),
        ].filter(Boolean).join(" ").toLowerCase().includes(q);
    }) : repos;

    if (options.sort === "registered_at_asc") return [...visible].sort((a, b) => a.registeredAt - b.registeredAt);
    if (options.sort === "stars_desc") return [...visible].sort((a, b) => {
        const aStars = a.github === "not found" ? -1 : a.github.stars;
        const bStars = b.github === "not found" ? -1 : b.github.stars;
        return bStars - aStars || b.registeredAt - a.registeredAt;
    });

    return [...visible].sort((a, b) => b.registeredAt - a.registeredAt);
}
