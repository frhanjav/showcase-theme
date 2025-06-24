import { YouTuber, Video, ExportData } from "../types";

export class DatabaseService {
  constructor(private db: D1Database) {}

  // YouTubers methods
  async getAllYouTubers(): Promise<YouTuber[]> {
    const result = await this.db
      .prepare("SELECT * FROM youtubers ORDER BY created_at DESC")
      .all();
    return result.results.map((row) => ({
      ...row,
      tags: JSON.parse(row.tags as string),
    })) as YouTuber[];
  }

  async getYouTuberById(id: number): Promise<YouTuber | null> {
    const result = await this.db
      .prepare("SELECT * FROM youtubers WHERE youtuber_id = ?")
      .bind(id)
      .first();
    if (!result) return null;

    return {
      ...result,
      tags: JSON.parse(result.tags as string),
    } as YouTuber;
  }

  async createYouTuber(
    data: Omit<YouTuber, "youtuber_id" | "created_at" | "updated_at">
  ): Promise<YouTuber> {
    const result = await this.db
      .prepare(
        `
      INSERT INTO youtubers (name, tags, image_url)
      VALUES (?, ?, ?)
      RETURNING *
    `
      )
      .bind(data.name, JSON.stringify(data.tags), data.image_url)
      .first();

    if (!result) {
      throw new Error("Failed to create YouTuber");
    }

    return {
      ...result,
      tags: JSON.parse(result.tags as string),
    } as YouTuber;
  }

  async updateYouTuber(
    id: number,
    data: Partial<Pick<YouTuber, "name" | "tags" | "image_url">>
  ): Promise<YouTuber | null> {
    const updates: string[] = [];
    const bindings: any[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      bindings.push(data.name);
    }
    if (data.tags !== undefined) {
      updates.push("tags = ?");
      bindings.push(JSON.stringify(data.tags));
    }
    if (data.image_url !== undefined) {
      updates.push("image_url = ?");
      bindings.push(data.image_url);
    }

    if (updates.length === 0) {
      return this.getYouTuberById(id);
    }

    updates.push('updated_at = datetime("now")');
    bindings.push(id);

    const query = `UPDATE youtubers SET ${updates.join(", ")} WHERE youtuber_id = ? RETURNING *`;
    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .first();

    if (!result) return null;

    return {
      ...result,
      tags: JSON.parse(result.tags as string),
    } as YouTuber;
  }

  async deleteYouTuber(id: number): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM youtubers WHERE youtuber_id = ?")
      .bind(id)
      .run();
    return result.success && (result.meta?.changes || 0) > 0;
  }

  // Videos methods
  async getAllVideos(): Promise<Video[]> {
    const result = await this.db
      .prepare("SELECT * FROM videos ORDER BY created_at DESC")
      .all();
    return result.results.map((row) => ({
      ...row,
      is_custom_thumbnail: Boolean(row.is_custom_thumbnail),
    })) as Video[];
  }

  async getVideoById(id: number): Promise<Video | null> {
    const result = await this.db
      .prepare("SELECT * FROM videos WHERE video_id = ?")
      .bind(id)
      .first();
    if (!result) return null;

    return {
      ...result,
      is_custom_thumbnail: Boolean(result.is_custom_thumbnail),
    } as Video;
  }

  async getVideoByUrl(url: string): Promise<Video | null> {
    const result = await this.db
      .prepare("SELECT * FROM videos WHERE url = ?")
      .bind(url)
      .first();
    if (!result) return null;

    return {
      ...result,
      is_custom_thumbnail: Boolean(result.is_custom_thumbnail),
    } as Video;
  }

  async createVideo(
    data: Omit<Video, "video_id" | "created_at" | "updated_at">
  ): Promise<Video> {
    const result = await this.db
      .prepare(
        `
      INSERT INTO videos (title, description, url, thumbnail_url, is_custom_thumbnail)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `
      )
      .bind(
        data.title,
        data.description,
        data.url,
        data.thumbnail_url,
        data.is_custom_thumbnail ? 1 : 0
      )
      .first();

    if (!result) {
      throw new Error("Failed to create video");
    }

    return {
      ...result,
      is_custom_thumbnail: Boolean(result.is_custom_thumbnail),
    } as Video;
  }

  async updateVideo(
    id: number,
    data: Partial<
      Pick<
        Video,
        | "title"
        | "description"
        | "url"
        | "thumbnail_url"
        | "is_custom_thumbnail"
      >
    >
  ): Promise<Video | null> {
    const updates: string[] = [];
    const bindings: any[] = [];

    if (data.title !== undefined) {
      updates.push("title = ?");
      bindings.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      bindings.push(data.description);
    }
    if (data.url !== undefined) {
      updates.push("url = ?");
      bindings.push(data.url);
    }
    if (data.thumbnail_url !== undefined) {
      updates.push("thumbnail_url = ?");
      bindings.push(data.thumbnail_url);
    }
    if (data.is_custom_thumbnail !== undefined) {
      updates.push("is_custom_thumbnail = ?");
      bindings.push(data.is_custom_thumbnail ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.getVideoById(id);
    }

    updates.push('updated_at = datetime("now")');
    bindings.push(id);

    const query = `UPDATE videos SET ${updates.join(", ")} WHERE video_id = ? RETURNING *`;
    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .first();

    if (!result) return null;

    return {
      ...result,
      is_custom_thumbnail: Boolean(result.is_custom_thumbnail),
    } as Video;
  }

  async deleteVideo(id: number): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM videos WHERE video_id = ?")
      .bind(id)
      .run();
    return result.success && (result.meta?.changes || 0) > 0;
  }

  // Export functionality
  async exportAllData(): Promise<ExportData> {
    const youtubers = await this.getAllYouTubers();
    const videos = await this.getAllVideos();

    return {
      youtubers,
      videos,
      exported_at: new Date().toISOString(),
      version: "1.0.0",
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.prepare("SELECT 1").first();
      return true;
    } catch {
      return false;
    }
  }
}
