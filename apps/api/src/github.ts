import { Octokit } from "@octokit/rest";

export type RepoMetaData = {
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    htmlUrl: string;
}

let octokit: Octokit | null = null;

export function getGhClient(): Octokit {
    if (!process.env.GITHUB_TOKEN) throw new Error("github token is missing");
    if (octokit) return octokit;
    octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    return octokit;
}

export async function fetchRepoMetaData(client: Octokit, id: bigint | number): Promise<RepoMetaData | null> {
    try {
        const { data: metadata } = await client.request("GET /repositories/{id}", {id: Number(id)});
        return {
            fullName: metadata.full_name,
            description: metadata.description,
            language: metadata.language,
            stars: metadata.stargazers_count ?? 0,
            htmlUrl: metadata.html_url,
        };
    } catch (err: any) { if (err.status && (err.status === 404)) return null; else throw err; }
}

export async function fetchOwnerUsername(client: Octokit, id: bigint | number): Promise<string | null> {
    const accountId = Number(id);
    try {
        const { data } = await client.request("GET /user/{account_id}", { account_id: accountId }); return data.login;
    } catch (err: any) { if (!err.status || err.status !== 404) throw err; }

    try {
        const { data } = await client.request("GET /organizations/{org_id}", { org_id: accountId }); return data.login;
    } catch (err: any) { if (err.status && (err.status === 404)) return null; else throw err; }
}
