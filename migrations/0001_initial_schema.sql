-- Migration to create initial tables
-- YouTubers table
CREATE TABLE IF NOT EXISTS youtubers (
    youtuber_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array stored as text
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    video_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL UNIQUE,
    thumbnail_url TEXT,
    is_custom_thumbnail BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_youtubers_created_at ON youtubers(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_url ON videos(url);

-- Trigger to update updated_at timestamp for youtubers
CREATE TRIGGER IF NOT EXISTS trigger_youtubers_updated_at
    AFTER UPDATE ON youtubers
    FOR EACH ROW
BEGIN
    UPDATE youtubers SET updated_at = datetime('now') WHERE youtuber_id = NEW.youtuber_id;
END;

-- Trigger to update updated_at timestamp for videos
CREATE TRIGGER IF NOT EXISTS trigger_videos_updated_at
    AFTER UPDATE ON videos
    FOR EACH ROW
BEGIN
    UPDATE videos SET updated_at = datetime('now') WHERE video_id = NEW.video_id;
END;
