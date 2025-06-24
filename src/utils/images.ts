import { Context } from "hono";
import { Env } from "../types";

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadImageToR2(
  bucket: R2Bucket,
  file: File,
  path: string
): Promise<ImageUploadResult> {
  try {
    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.",
      };
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        success: false,
        error: "File too large. Maximum size is 10MB.",
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${path}/${timestamp}_${randomId}.${extension}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Return the URL (you'll need to configure your R2 bucket to be publicly accessible)
    const url = `https://your-r2-domain.com/${filename}`;

    return {
      success: true,
      url,
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    return {
      success: false,
      error: "Failed to upload image",
    };
  }
}

export async function downloadImageFromUrl(
  url: string
): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error downloading image:", error);
    return null;
  }
}

export async function uploadImageFromUrl(
  bucket: R2Bucket,
  imageUrl: string,
  path: string
): Promise<ImageUploadResult> {
  try {
    const imageData = await downloadImageFromUrl(imageUrl);
    if (!imageData) {
      return {
        success: false,
        error: "Failed to download image from URL",
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = getExtensionFromUrl(imageUrl) || "jpg";
    const filename = `${path}/${timestamp}_${randomId}.${extension}`;

    // Upload to R2
    await bucket.put(filename, imageData, {
      httpMetadata: {
        contentType: getContentTypeFromExtension(extension),
      },
    });

    const url = `https://your-r2-domain.com/${filename}`;

    return {
      success: true,
      url,
    };
  } catch (error) {
    console.error("Error uploading image from URL:", error);
    return {
      success: false,
      error: "Failed to upload image from URL",
    };
  }
}

export function getExtensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop();
    return extension &&
      ["jpg", "jpeg", "png", "webp", "gif"].includes(extension.toLowerCase())
      ? extension.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

export function getContentTypeFromExtension(extension: string): string {
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return types[extension.toLowerCase()] || "image/jpeg";
}

export async function deleteImageFromR2(
  bucket: R2Bucket,
  url: string
): Promise<boolean> {
  try {
    // Extract the key from the URL
    const key = url.split("/").pop();
    if (!key) return false;

    await bucket.delete(key);
    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
}
