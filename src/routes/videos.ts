import { Hono } from "hono";
import { Env } from "../types";
import { DatabaseService } from "../utils/database";
import { uploadImageToR2, uploadImageFromUrl } from "../utils/images";
import { extractOpenGraph, isValidUrl } from "../utils/openGraph";

const videos = new Hono<{ Bindings: Env }>();

// Get all videos
videos.get("/", async (c) => {
  try {
    const db = new DatabaseService(c.env.DB);
    const allVideos = await db.getAllVideos();
    return c.json({ videos: allVideos });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return c.json({ error: "Failed to fetch videos" }, 500);
  }
});

// Get single video
videos.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid video ID" }, 400);
    }

    const db = new DatabaseService(c.env.DB);
    const video = await db.getVideoById(id);

    if (!video) {
      return c.json({ error: "Video not found" }, 404);
    }

    return c.json({ video });
  } catch (error) {
    console.error("Error fetching video:", error);
    return c.json({ error: "Failed to fetch video" }, 500);
  }
});

// Create new video
videos.post("/", async (c) => {
  try {
    const formData = await c.req.formData();
    const title = formData.get("title")?.toString();
    const description = formData.get("description")?.toString();
    const url = formData.get("url")?.toString();
    const customThumbnail = formData.get("custom_thumbnail") as File | null;

    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }

    if (!isValidUrl(url)) {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    const db = new DatabaseService(c.env.DB);

    // Check if video with this URL already exists
    const existingVideo = await db.getVideoByUrl(url);
    if (existingVideo) {
      return c.json({ error: "Video with this URL already exists" }, 409);
    }

    let videoTitle = title;
    let videoDescription = description;
    let thumbnailUrl: string | null = null;
    let isCustomThumbnail = false;

    // Handle custom thumbnail first
    if (customThumbnail && customThumbnail.size > 0) {
      const uploadResult = await uploadImageToR2(
        c.env.IMAGES_BUCKET,
        customThumbnail,
        "videos"
      );
      if (uploadResult.success) {
        thumbnailUrl = uploadResult.url || null;
        isCustomThumbnail = true;
      } else {
        return c.json({ error: uploadResult.error }, 400);
      }
    }

    // Extract Open Graph data if no custom thumbnail or missing title/description
    if (!isCustomThumbnail || !videoTitle || !videoDescription) {
      const ogData = await extractOpenGraph(url);

      if (!videoTitle && ogData.title) {
        videoTitle = ogData.title;
      }

      if (!videoDescription && ogData.description) {
        videoDescription = ogData.description;
      }

      // Use OG image if no custom thumbnail
      if (!isCustomThumbnail && ogData.image) {
        const uploadResult = await uploadImageFromUrl(
          c.env.IMAGES_BUCKET,
          ogData.image,
          "videos"
        );
        if (uploadResult.success) {
          thumbnailUrl = uploadResult.url || null;
        }
      }
    }

    // Default title if still not provided
    if (!videoTitle) {
      videoTitle = "Untitled Video";
    }

    const video = await db.createVideo({
      title: videoTitle,
      description: videoDescription || null,
      url,
      thumbnail_url: thumbnailUrl,
      is_custom_thumbnail: isCustomThumbnail,
    });

    return c.json({ video }, 201);
  } catch (error) {
    console.error("Error creating video:", error);
    return c.json({ error: "Failed to create video" }, 500);
  }
});

// Update video
videos.put("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid video ID" }, 400);
    }

    const formData = await c.req.formData();
    const title = formData.get("title")?.toString();
    const description = formData.get("description")?.toString();
    const url = formData.get("url")?.toString();
    const customThumbnail = formData.get("custom_thumbnail") as File | null;

    const db = new DatabaseService(c.env.DB);

    // Check if video exists
    const existingVideo = await db.getVideoById(id);
    if (!existingVideo) {
      return c.json({ error: "Video not found" }, 404);
    }

    const updateData: any = {};

    if (title) {
      updateData.title = title;
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    // Handle URL change
    if (url && url !== existingVideo.url) {
      if (!isValidUrl(url)) {
        return c.json({ error: "Invalid URL format" }, 400);
      }

      // Check if another video with this URL already exists
      const duplicateVideo = await db.getVideoByUrl(url);
      if (duplicateVideo && duplicateVideo.video_id !== id) {
        return c.json(
          { error: "Another video with this URL already exists" },
          409
        );
      }

      updateData.url = url;
    }

    // Handle custom thumbnail
    if (customThumbnail && customThumbnail.size > 0) {
      const uploadResult = await uploadImageToR2(
        c.env.IMAGES_BUCKET,
        customThumbnail,
        "videos"
      );
      if (uploadResult.success) {
        updateData.thumbnail_url = uploadResult.url;
        updateData.is_custom_thumbnail = true;
      } else {
        return c.json({ error: uploadResult.error }, 400);
      }
    }

    // If URL changed and no custom thumbnail, extract new OG data
    if (updateData.url && !customThumbnail) {
      const ogData = await extractOpenGraph(updateData.url);
      if (ogData.image) {
        const uploadResult = await uploadImageFromUrl(
          c.env.IMAGES_BUCKET,
          ogData.image,
          "videos"
        );
        if (uploadResult.success) {
          updateData.thumbnail_url = uploadResult.url;
          updateData.is_custom_thumbnail = false;
        }
      }
    }

    const updatedVideo = await db.updateVideo(id, updateData);

    if (!updatedVideo) {
      return c.json({ error: "Failed to update video" }, 500);
    }

    return c.json({ video: updatedVideo });
  } catch (error) {
    console.error("Error updating video:", error);
    return c.json({ error: "Failed to update video" }, 500);
  }
});

// Delete video
videos.delete("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid video ID" }, 400);
    }

    const db = new DatabaseService(c.env.DB);
    const success = await db.deleteVideo(id);

    if (!success) {
      return c.json({ error: "Video not found" }, 404);
    }

    return c.json({ success: true, message: "Video deleted successfully" });
  } catch (error) {
    console.error("Error deleting video:", error);
    return c.json({ error: "Failed to delete video" }, 500);
  }
});

export default videos;
