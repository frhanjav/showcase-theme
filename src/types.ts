export interface YouTuber {
  youtuber_id: number;
  name: string;
  tags: string[];
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Video {
  video_id: number;
  title: string;
  description: string | null;
  url: string;
  thumbnail_url: string | null;
  is_custom_thumbnail: boolean;
  created_at: string;
  updated_at: string;
}

export interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  IMAGES_BUCKET: R2Bucket;
  ADMIN_PASSWORD_HASH: string;
  CSRF_SECRET_KEY: string;
  ENVIRONMENT: string;
  CORS_ORIGINS: string;
  RATE_LIMIT_MAX_ATTEMPTS: string;
  RATE_LIMIT_WINDOW_MS: string;
  AUTO_EXPORT_INTERVAL_DAYS: string;
}

export interface AuthRequest {
  password: string;
  csrf_token: string;
}

export interface CreateYouTuberRequest {
  name: string;
  tags: string[];
  image?: File;
  csrf_token: string;
}

export interface UpdateYouTuberRequest {
  name?: string;
  tags?: string[];
  image?: File;
  csrf_token: string;
}

export interface CreateVideoRequest {
  title: string;
  description?: string;
  url: string;
  custom_thumbnail?: File;
  csrf_token: string;
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  url?: string;
  custom_thumbnail?: File;
  csrf_token: string;
}

export interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export interface RateLimitData {
  attempts: number;
  lastAttempt: number;
  timeoutUntil?: number;
}

export interface ExportData {
  youtubers: YouTuber[];
  videos: Video[];
  exported_at: string;
  version: string;
}
