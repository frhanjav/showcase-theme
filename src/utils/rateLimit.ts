import { Context } from "hono";
import { Env, RateLimitData } from "../types";

export async function createBrowserFingerprint(c: Context): Promise<string> {
  const headers = c.req.header();
  const userAgent = headers["user-agent"] || "";
  const accept = headers["accept"] || "";
  const acceptLanguage = headers["accept-language"] || "";
  const acceptEncoding = headers["accept-encoding"] || "";

  // Get client IP (Cloudflare provides this)
  const clientIP =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    c.req.header("x-real-ip") ||
    "unknown";

  // Create a combined fingerprint
  const fingerprint = `${clientIP}:${userAgent}:${accept}:${acceptLanguage}:${acceptEncoding}`;

  // Hash the fingerprint for storage
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

export async function getRateLimitData(
  kv: KVNamespace,
  fingerprint: string
): Promise<RateLimitData> {
  const data = await kv.get(`ratelimit:${fingerprint}`);
  if (!data) {
    return { attempts: 0, lastAttempt: 0 };
  }

  try {
    return JSON.parse(data);
  } catch {
    return { attempts: 0, lastAttempt: 0 };
  }
}

export async function updateRateLimitData(
  kv: KVNamespace,
  fingerprint: string,
  data: RateLimitData,
  windowMs: number
): Promise<void> {
  const ttl = Math.max(60, Math.floor(windowMs / 1000)); // At least 1 minute TTL
  await kv.put(`ratelimit:${fingerprint}`, JSON.stringify(data), {
    expirationTtl: ttl,
  });
}

export function calculateTimeout(attempts: number): number {
  // Progressive timeouts: 15min → 30min → 1hr → 24hr
  const timeouts = [
    15 * 60 * 1000,
    30 * 60 * 1000,
    60 * 60 * 1000,
    24 * 60 * 60 * 1000,
  ];
  const index = Math.min(attempts - 1, timeouts.length - 1);
  return timeouts[index];
}

export async function checkRateLimit(
  c: Context<{ Bindings: Env }>
): Promise<{ allowed: boolean; timeoutUntil?: number }> {
  const fingerprint = await createBrowserFingerprint(c);
  const maxAttempts = parseInt(c.env.RATE_LIMIT_MAX_ATTEMPTS || "3");
  const windowMs = parseInt(c.env.RATE_LIMIT_WINDOW_MS || "900000"); // 15 minutes

  const rateLimitData = await getRateLimitData(
    c.env.RATE_LIMIT_KV,
    fingerprint
  );
  const now = Date.now();

  // Check if currently in timeout
  if (rateLimitData.timeoutUntil && now < rateLimitData.timeoutUntil) {
    return { allowed: false, timeoutUntil: rateLimitData.timeoutUntil };
  }

  // Reset if window has passed
  if (now - rateLimitData.lastAttempt > windowMs) {
    rateLimitData.attempts = 0;
  }

  // Check if exceeded attempts
  if (rateLimitData.attempts >= maxAttempts) {
    const timeoutDuration = calculateTimeout(rateLimitData.attempts);
    const timeoutUntil = now + timeoutDuration;

    await updateRateLimitData(
      c.env.RATE_LIMIT_KV,
      fingerprint,
      {
        ...rateLimitData,
        timeoutUntil,
      },
      windowMs
    );

    return { allowed: false, timeoutUntil };
  }

  return { allowed: true };
}

export async function recordFailedAttempt(
  c: Context<{ Bindings: Env }>
): Promise<void> {
  const fingerprint = await createBrowserFingerprint(c);
  const windowMs = parseInt(c.env.RATE_LIMIT_WINDOW_MS || "900000");

  const rateLimitData = await getRateLimitData(
    c.env.RATE_LIMIT_KV,
    fingerprint
  );
  const now = Date.now();

  // Reset if window has passed
  if (now - rateLimitData.lastAttempt > windowMs) {
    rateLimitData.attempts = 0;
  }

  rateLimitData.attempts += 1;
  rateLimitData.lastAttempt = now;

  await updateRateLimitData(
    c.env.RATE_LIMIT_KV,
    fingerprint,
    rateLimitData,
    windowMs
  );
}

export async function resetRateLimit(
  c: Context<{ Bindings: Env }>
): Promise<void> {
  const fingerprint = await createBrowserFingerprint(c);
  await c.env.RATE_LIMIT_KV.delete(`ratelimit:${fingerprint}`);
}
