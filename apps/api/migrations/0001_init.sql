-- App-owned data only; identity and rank data are never copied here.
CREATE TABLE IF NOT EXISTS videos (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 access_mode TEXT NOT NULL CHECK(access_mode IN ('public','members','rank')),
 min_rank_code TEXT,
 source_type TEXT NOT NULL CHECK(source_type IN ('mux','youtube')),
 source_id TEXT NOT NULL DEFAULT '',
 mux_asset_id TEXT,
 mux_playback_policy TEXT,
 youtube_visibility TEXT CHECK(youtube_visibility IN ('public','unlisted')),
 accepted_unlisted_risk INTEGER NOT NULL DEFAULT 0,
 category TEXT NOT NULL DEFAULT '一般',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','unlisted')),
 duration_seconds INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_videos_catalog ON videos(status,created_at);
CREATE TABLE IF NOT EXISTS comments (
 id TEXT PRIMARY KEY,
 video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
 author_sub TEXT NOT NULL,
 parent_comment_id TEXT REFERENCES comments(id),
 body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden','deleted')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id,created_at);
CREATE TABLE IF NOT EXISTS comment_reports (
 id TEXT PRIMARY KEY,
 comment_id TEXT NOT NULL REFERENCES comments(id),
 reporter_sub TEXT NOT NULL,
 reason_code TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open',
 handled_by_sub TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS moderation_actions (
 id TEXT PRIMARY KEY,actor_sub TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,
 action TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_grants (
 member_sub TEXT NOT NULL,permission TEXT NOT NULL,granted_by_sub TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(member_sub,permission)
);
CREATE TABLE IF NOT EXISTS comment_bans (
 member_sub TEXT PRIMARY KEY,banned_by_sub TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS video_progress (
 member_sub TEXT NOT NULL,video_id TEXT NOT NULL REFERENCES videos(id),position_seconds INTEGER NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(member_sub,video_id)
);
CREATE TABLE IF NOT EXISTS uploads (
 id TEXT PRIMARY KEY,video_id TEXT NOT NULL REFERENCES videos(id),initiator_sub TEXT NOT NULL,
 mux_upload_id TEXT,mux_asset_id TEXT,status TEXT NOT NULL DEFAULT 'waiting',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
