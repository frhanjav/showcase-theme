-- Migration to remove youtuber_id column that was incorrectly added
-- This column is not needed based on the application requirements

-- Since SQLite doesn't support DROP COLUMN, we need to recreate the table
-- First backup the data
CREATE TABLE videos_backup AS SELECT 
    video_id,
    title,
    description,
    url,
    thumbnail_url,
    is_custom_thumbnail,
    created_at,
    updated_at
FROM videos;

-- Drop the original table
DROP TABLE videos;

-- Recreate the table with the correct schema
CREATE TABLE videos (
    video_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL UNIQUE,
    thumbnail_url TEXT,
    is_custom_thumbnail BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Restore the data
INSERT INTO videos SELECT * FROM videos_backup;

-- Drop the backup table
DROP TABLE videos_backup;

-- Recreate the indexes
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_url ON videos(url);

-- Recreate the trigger
CREATE TRIGGER IF NOT EXISTS trigger_videos_updated_at
    AFTER UPDATE ON videos
    FOR EACH ROW
BEGIN
    UPDATE videos SET updated_at = datetime('now') WHERE video_id = NEW.video_id;
END;