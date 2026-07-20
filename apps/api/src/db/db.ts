import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const BASE_CHAIN_ID = 8453;
const configuredChainId = Number(process.env.CHAIN_ID ?? BASE_CHAIN_ID);
const DEFAULT_CHAIN_ID = Number.isFinite(configuredChainId) && configuredChainId > 0 ? configuredChainId : BASE_CHAIN_ID;

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
  block_number INTEGER NOT NULL,
  transaction_hash TEXT,
  chain_id INTEGER NOT NULL DEFAULT ${DEFAULT_CHAIN_ID}
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
CREATE TABLE IF NOT EXISTS markets (
  repo_id TEXT PRIMARY KEY,
  asset TEXT NOT NULL,
  hook TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  currency0 TEXT,
  currency1 TEXT,
  fee INTEGER,
  tick_spacing INTEGER,
  launched_at INTEGER NOT NULL,
  launcher TEXT NOT NULL,
  UNIQUE (asset)
);
CREATE TABLE IF NOT EXISTS trades (
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  pool_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  amount0 TEXT NOT NULL, -- signed, int128
  amount1 TEXT NOT NULL,
  sqrtPriceX96 TEXT NOT NULL, -- post-swap price
  block_number INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS trades_by_pool ON trades (pool_id, block_number);
CREATE TABLE IF NOT EXISTS indexer_state (
  key TEXT PRIMARY KEY, value TEXT
);
`);

const repoColumns = new Set((db.prepare("PRAGMA table_info(repos)").all() as { name: string }[]).map((column) => column.name));
if (!repoColumns.has("transaction_hash")) db.exec("ALTER TABLE repos ADD COLUMN transaction_hash TEXT");
if (!repoColumns.has("chain_id")) db.exec(`ALTER TABLE repos ADD COLUMN chain_id INTEGER NOT NULL DEFAULT ${DEFAULT_CHAIN_ID}`);

const marketColumns = new Set((db.prepare("PRAGMA table_info(markets)").all() as { name: string }[]).map((column) => column.name));
if (!marketColumns.has("currency0")) db.exec("ALTER TABLE markets ADD COLUMN currency0 TEXT");
if (!marketColumns.has("currency1")) db.exec("ALTER TABLE markets ADD COLUMN currency1 TEXT");
if (!marketColumns.has("fee")) db.exec("ALTER TABLE markets ADD COLUMN fee INTEGER");
if (!marketColumns.has("tick_spacing")) db.exec("ALTER TABLE markets ADD COLUMN tick_spacing INTEGER");

export type RepoRow = {
  repo_id: string;
  registrant: string;
  github_owner_id: number;
  registered_at: number;
  block_number: number;
  transaction_hash: string | null;
  chain_id: number;
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

export type MarketRow = {
  repo_id: string;
  asset: string;
  hook: string;
  pool_id: string;
  currency0: string | null;
  currency1: string | null;
  fee: number | null;
  tick_spacing: number | null;
  launched_at: number;
  launcher: string;
};

export const insertRepo = db.prepare(`
INSERT INTO repos
  (repo_id, registrant, github_owner_id, registered_at, block_number, transaction_hash, chain_id)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(repo_id) DO UPDATE SET
  registrant=excluded.registrant,
  github_owner_id=excluded.github_owner_id,
  registered_at=excluded.registered_at,
  block_number=excluded.block_number,
  transaction_hash=COALESCE(excluded.transaction_hash, repos.transaction_hash),
  chain_id=excluded.chain_id
`);

export const insertMarket = db.prepare(`
INSERT INTO markets
  (repo_id, asset, hook, pool_id, currency0, currency1, fee, tick_spacing, launched_at, launcher)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(repo_id) DO UPDATE SET
  asset=excluded.asset,
  hook=excluded.hook,
  pool_id=excluded.pool_id,
  currency0=COALESCE(excluded.currency0, markets.currency0),
  currency1=COALESCE(excluded.currency1, markets.currency1),
  fee=COALESCE(excluded.fee, markets.fee),
  tick_spacing=COALESCE(excluded.tick_spacing, markets.tick_spacing),
  launched_at=excluded.launched_at,
  launcher=excluded.launcher
`);

export const insertTrade = db.prepare(`
INSERT OR IGNORE INTO trades
  (tx_hash, log_index, pool_id, repo_id, sender, amount0, amount1, sqrtPriceX96, block_number, ts)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const listRepos = db.prepare(`
SELECT repo_id, registrant, github_owner_id, registered_at, block_number, transaction_hash, chain_id
FROM repos
WHERE chain_id = ?
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
