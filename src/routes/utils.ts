import { Hono } from "hono";
import { Env } from "../types";
import { DatabaseService } from "../utils/database";
import { extractOpenGraph, isValidUrl } from "../utils/openGraph";
import { uploadImageToR2 } from "../utils/images";
import { hashPassword } from "../utils/auth";

const utils = new Hono<{ Bindings: Env }>();

// Generate password hash (for development only)
utils.get("/hash-password/:password", async (c) => {
  const password = c.req.param("password");
  const hash = await hashPassword(password);
  return c.json({ password, hash });
});

// Extract Open Graph data from URL
utils.post("/extract-og", async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }

    if (!isValidUrl(url)) {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    const ogData = await extractOpenGraph(url);
    return c.json({ ogData });
  } catch (error) {
    console.error("Error extracting Open Graph data:", error);
    return c.json({ error: "Failed to extract Open Graph data" }, 500);
  }
});

// Upload image
utils.post("/upload-image", async (c) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get("image") as File | null;
    const path = formData.get("path")?.toString() || "general";

    if (!imageFile || imageFile.size === 0) {
      return c.json({ error: "Image file is required" }, 400);
    }

    const uploadResult = await uploadImageToR2(
      c.env.IMAGES_BUCKET,
      imageFile,
      path
    );

    if (!uploadResult.success) {
      return c.json({ error: uploadResult.error }, 400);
    }

    return c.json({
      success: true,
      url: uploadResult.url,
      message: "Image uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return c.json({ error: "Failed to upload image" }, 500);
  }
});

// Export all data
utils.get("/export", async (c) => {
  try {
    const db = new DatabaseService(c.env.DB);
    const exportData = await db.exportAllData();

    // Store export in R2 for backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `exports/export-${timestamp}.json`;

    await c.env.IMAGES_BUCKET.put(
      filename,
      JSON.stringify(exportData, null, 2),
      {
        httpMetadata: {
          contentType: "application/json",
        },
      }
    );

    return c.json(exportData);
  } catch (error) {
    console.error("Error exporting data:", error);
    return c.json({ error: "Failed to export data" }, 500);
  }
});

// Health check
utils.get("/health", async (c) => {
  try {
    const db = new DatabaseService(c.env.DB);
    const dbHealthy = await db.healthCheck();

    // Check KV
    let kvHealthy = false;
    try {
      await c.env.RATE_LIMIT_KV.put("health-check", "ok", {
        expirationTtl: 60,
      });
      const kvResult = await c.env.RATE_LIMIT_KV.get("health-check");
      kvHealthy = kvResult === "ok";
    } catch {
      kvHealthy = false;
    }

    // Check R2
    let r2Healthy = false;
    try {
      await c.env.IMAGES_BUCKET.put("health-check.txt", "ok");
      const r2Result = await c.env.IMAGES_BUCKET.get("health-check.txt");
      r2Healthy = r2Result !== null;
    } catch {
      r2Healthy = false;
    }

    const overall = dbHealthy && kvHealthy && r2Healthy;

    return c.json(
      {
        status: overall ? "healthy" : "unhealthy",
        services: {
          database: dbHealthy ? "healthy" : "unhealthy",
          kv: kvHealthy ? "healthy" : "unhealthy",
          r2: r2Healthy ? "healthy" : "unhealthy",
        },
        timestamp: new Date().toISOString(),
      },
      overall ? 200 : 503
    );
  } catch (error) {
    console.error("Health check error:", error);
    return c.json(
      {
        status: "unhealthy",
        error: "Health check failed",
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

// Fix image URLs in database (migration endpoint)
utils.get("/fix-image-urls", async (c) => {
  try {
    const db = new DatabaseService(c.env.DB);

    // Get all youtubers with old URLs
    const youtubers = await db.getAllYouTubers();
    const updates = [];

    for (const youtuber of youtubers) {
      if (
        youtuber.image_url &&
        youtuber.image_url.includes("your-r2-domain.com")
      ) {
        // Extract the path from the old URL (e.g., "youtubers/1750768269282_yfq9jknmoah.png")
        const urlParts = youtuber.image_url.split("/");
        const pathParts = urlParts.slice(3); // Remove https, empty, your-r2-domain.com
        const filePath = pathParts.join("/");
        const newUrl = `/images/${filePath}`;

        await c.env.DB.prepare(
          "UPDATE youtubers SET image_url = ? WHERE youtuber_id = ?"
        )
          .bind(newUrl, youtuber.youtuber_id)
          .run();

        updates.push({
          id: youtuber.youtuber_id,
          name: youtuber.name,
          oldUrl: youtuber.image_url,
          newUrl: newUrl,
        });
      }
    }

    // Also fix videos if they have thumbnail URLs
    const videos = await db.getAllVideos();
    for (const video of videos) {
      if (
        video.thumbnail_url &&
        video.thumbnail_url.includes("your-r2-domain.com")
      ) {
        const urlParts = video.thumbnail_url.split("/");
        const pathParts = urlParts.slice(3); // Remove https, empty, your-r2-domain.com
        const filePath = pathParts.join("/");
        const newUrl = `/images/${filePath}`;

        await c.env.DB.prepare(
          "UPDATE videos SET thumbnail_url = ? WHERE video_id = ?"
        )
          .bind(newUrl, video.video_id)
          .run();

        updates.push({
          id: video.video_id,
          title: video.title,
          oldUrl: video.thumbnail_url,
          newUrl: newUrl,
        });
      }
    }

    return c.json({
      message: "Image URLs updated successfully",
      updates: updates,
      count: updates.length,
    });
  } catch (error) {
    console.error("Error fixing image URLs:", error);
    return c.json({ error: "Failed to fix image URLs" }, 500);
  }
});

// Debug: List R2 bucket contents
utils.get("/debug-r2", async (c) => {
  try {
    const objects = await c.env.IMAGES_BUCKET.list();
    return c.json({
      objects: objects.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
      })),
    });
  } catch (error) {
    console.error("Error listing R2 objects:", error);
    return c.json({ error: "Failed to list R2 objects" }, 500);
  }
});

export default utils;
