import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

function initDbPath(dbPath: string): string {
  mkdirSync(dirname(dbPath), { recursive: true }); return dbPath;
}

export const db = new Database(initDbPath(process.env.DB_PATH ?? "./data/registry.db"));

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS repos (
  repo_id TEXT PRIMARY KEY,
  registrant TEXT NOT NULL,
  github_owner_id INTEGER NOT NULL,
  registered_at INTEGER NOT NULL,
  block_number INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS repos_by_registered_at ON repos (registered_at);
CREATE TABLE IF NOT EXISTS github_meta (
  repo_id TEXT PRIMARY KEY,
  full_name TEXT,
  description TEXT,
  language TEXT,
  stars INTEGER,
  html_url TEXT,
  owner_name TEXT,
  fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS indexer_state (
  key TEXT PRIMARY KEY, value TEXT
);
`);

export type RepoRow = {
  repo_id: string;
  registrant: string;
  github_owner_id: number;
  registered_at: number;
  block_number: number;
};

export type GithubMetaRow = {
  repo_id: string;
  full_name: string | null;
  description: string | null;
  language: string | null;
  stars: number | null;
  html_url: string | null;
  owner_name: string | null;
  fetched_at: number;
};

export const insertRepo = db.prepare(`
INSERT OR IGNORE INTO repos
  (repo_id, registrant, github_owner_id, registered_at, block_number)
VALUES (?, ?, ?, ?, ?)
`);

export const listRepos = db.prepare(`
SELECT repo_id, registrant, github_owner_id, registered_at, block_number
FROM repos
ORDER BY registered_at DESC
`);

export const getMeta = db.prepare(`
SELECT repo_id, full_name, description, language, stars, html_url, owner_name, fetched_at
FROM github_meta
WHERE repo_id = ?
`);

export const upsertMeta = db.prepare(`
INSERT INTO github_meta (repo_id, full_name, description, language, stars, html_url, owner_name, fetched_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(repo_id) DO UPDATE SET
  full_name=excluded.full_name, description=excluded.description,
  language=excluded.language, stars=excluded.stars,
  html_url=excluded.html_url, owner_name=excluded.owner_name,
  fetched_at=excluded.fetched_at
`);
