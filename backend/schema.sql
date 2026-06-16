-- Pulse database schema.
-- Every table uses "IF NOT EXISTS" so running multiple times doesn't lead to duplicated tables

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    weights_json    TEXT,           -- relevance weights the user can tune
    source_prefs_json TEXT,         -- how much news/video/discussion they want
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    name            TEXT NOT NULL,
    keywords_json   TEXT,
    weight          REAL NOT NULL DEFAULT 1.0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT,
    item_count      INTEGER NOT NULL DEFAULT 0,
    first_seen_at   TEXT,
    last_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id     TEXT UNIQUE,
    source_type     TEXT NOT NULL CHECK (source_type IN ('news', 'video', 'discussion')),
    source_name     TEXT,
    url             TEXT,
    title           TEXT,
    summary         TEXT,
    author          TEXT,
    published_at    TEXT,
    metrics_json    TEXT,
    read_time_min   INTEGER,
    sentiment_score REAL,
    sentiment_label TEXT,
    keywords_json   TEXT,
    credibility_tier TEXT,
    relevance_score REAL,            -- pipeline relevance score in [0, 1]
    story_id        INTEGER,
    fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (story_id) REFERENCES stories (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS collections (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collection_items (
    collection_id   INTEGER NOT NULL,
    item_id         INTEGER NOT NULL,
    added_at        TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (collection_id, item_id),
    FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    item_id         INTEGER NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('more', 'less', 'hide')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_cache (
    cache_key       TEXT PRIMARY KEY,
    payload_json    TEXT NOT NULL,
    fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
    ttl_seconds     INTEGER NOT NULL
);
