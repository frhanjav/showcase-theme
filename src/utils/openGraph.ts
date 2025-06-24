import { OpenGraphData } from "../types";

export async function extractOpenGraph(url: string): Promise<OpenGraphData> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; YouTube-Showcase-Bot/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const ogData: OpenGraphData = {};

    // Extract Open Graph meta tags
    const metaTags =
      html.match(/<meta[^>]*property=["']og:[^"']*["'][^>]*>/gi) || [];

    metaTags.forEach((tag) => {
      const propertyMatch = tag.match(/property=["']og:([^"']*)["']/i);
      const contentMatch = tag.match(/content=["']([^"']*)["']/i);

      if (propertyMatch && contentMatch) {
        const property = propertyMatch[1].toLowerCase();
        const content = contentMatch[1];

        switch (property) {
          case "title":
            ogData.title = content;
            break;
          case "description":
            ogData.description = content;
            break;
          case "image":
            ogData.image = content;
            break;
          case "url":
            ogData.url = content;
            break;
        }
      }
    });

    // Fallback to regular meta tags if OG tags not found
    if (!ogData.title) {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch) {
        ogData.title = titleMatch[1].trim();
      }
    }

    if (!ogData.description) {
      const descMatch = html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
      );
      if (descMatch) {
        ogData.description = descMatch[1];
      }
    }

    // YouTube specific extraction
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        // Use YouTube thumbnail if no OG image found
        if (!ogData.image) {
          ogData.image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
      }
    }

    return ogData;
  } catch (error) {
    console.error("Error extracting Open Graph data:", error);
    return {};
  }
}

export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}
