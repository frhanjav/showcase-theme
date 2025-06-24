import { Hono } from "hono";
import { Env } from "../types";
import { DatabaseService } from "../utils/database";
import { uploadImageToR2, uploadImageFromUrl } from "../utils/images";
import { extractOpenGraph, isValidUrl } from "../utils/openGraph";

const youtubers = new Hono<{ Bindings: Env }>();

// Get all YouTubers
youtubers.get("/", async (c) => {
  try {
    const db = new DatabaseService(c.env.DB);
    const allYouTubers = await db.getAllYouTubers();
    return c.json({ youtubers: allYouTubers });
  } catch (error) {
    console.error("Error fetching YouTubers:", error);
    return c.json({ error: "Failed to fetch YouTubers" }, 500);
  }
});

// Get single YouTuber
youtubers.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid YouTuber ID" }, 400);
    }

    const db = new DatabaseService(c.env.DB);
    const youtuber = await db.getYouTuberById(id);

    if (!youtuber) {
      return c.json({ error: "YouTuber not found" }, 404);
    }

    return c.json({ youtuber });
  } catch (error) {
    console.error("Error fetching YouTuber:", error);
    return c.json({ error: "Failed to fetch YouTuber" }, 500);
  }
});

// Create new YouTuber
youtubers.post("/", async (c) => {
  try {
    const formData = await c.req.formData();
    const name = formData.get("name")?.toString();
    const tagsString = formData.get("tags")?.toString();
    const imageFile = formData.get("image") as File | null;

    if (!name) {
      return c.json({ error: "Name is required" }, 400);
    }

    // Parse tags
    let tags: string[] = [];
    if (tagsString) {
      try {
        tags = JSON.parse(tagsString);
      } catch {
        tags = tagsString
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
      }
    }

    let imageUrl: string | null = null;

    // Handle image upload
    if (imageFile && imageFile.size > 0) {
      const uploadResult = await uploadImageToR2(
        c.env.IMAGES_BUCKET,
        imageFile,
        "youtubers"
      );
      if (uploadResult.success) {
        imageUrl = uploadResult.url || null;
      } else {
        return c.json({ error: uploadResult.error }, 400);
      }
    }

    const db = new DatabaseService(c.env.DB);
    const youtuber = await db.createYouTuber({
      name,
      tags,
      image_url: imageUrl,
    });

    return c.json({ youtuber }, 201);
  } catch (error) {
    console.error("Error creating YouTuber:", error);
    return c.json({ error: "Failed to create YouTuber" }, 500);
  }
});

// Update YouTuber
youtubers.put("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid YouTuber ID" }, 400);
    }

    const formData = await c.req.formData();
    const name = formData.get("name")?.toString();
    const tagsString = formData.get("tags")?.toString();
    const imageFile = formData.get("image") as File | null;

    const db = new DatabaseService(c.env.DB);

    // Check if YouTuber exists
    const existingYouTuber = await db.getYouTuberById(id);
    if (!existingYouTuber) {
      return c.json({ error: "YouTuber not found" }, 404);
    }

    const updateData: any = {};

    if (name) {
      updateData.name = name;
    }

    // Parse tags if provided
    if (tagsString) {
      try {
        updateData.tags = JSON.parse(tagsString);
      } catch {
        updateData.tags = tagsString
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
      }
    }

    // Handle image upload
    if (imageFile && imageFile.size > 0) {
      const uploadResult = await uploadImageToR2(
        c.env.IMAGES_BUCKET,
        imageFile,
        "youtubers"
      );
      if (uploadResult.success) {
        updateData.image_url = uploadResult.url;
      } else {
        return c.json({ error: uploadResult.error }, 400);
      }
    }

    const updatedYouTuber = await db.updateYouTuber(id, updateData);

    if (!updatedYouTuber) {
      return c.json({ error: "Failed to update YouTuber" }, 500);
    }

    return c.json({ youtuber: updatedYouTuber });
  } catch (error) {
    console.error("Error updating YouTuber:", error);
    return c.json({ error: "Failed to update YouTuber" }, 500);
  }
});

// Delete YouTuber
youtubers.delete("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid YouTuber ID" }, 400);
    }

    const db = new DatabaseService(c.env.DB);
    const success = await db.deleteYouTuber(id);

    if (!success) {
      return c.json({ error: "YouTuber not found" }, 404);
    }

    return c.json({ success: true, message: "YouTuber deleted successfully" });
  } catch (error) {
    console.error("Error deleting YouTuber:", error);
    return c.json({ error: "Failed to delete YouTuber" }, 500);
  }
});

export default youtubers;
