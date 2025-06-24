import { Context, Next } from "hono";
import { cors } from "hono/cors";
import { Env } from "../types";
import { checkRateLimit } from "../utils/rateLimit";
import { validateCSRFToken } from "../utils/csrf";

export function corsMiddleware(origins: string) {
  const allowedOrigins = origins.split(",").map((origin) => origin.trim());

  return cors({
    origin: allowedOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
  });
}

export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    // Security headers
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("X-Frame-Options", "DENY");
    c.res.headers.set("X-XSS-Protection", "1; mode=block");
    c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    c.res.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );

    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");

    c.res.headers.set("Content-Security-Policy", csp);
  };
}

export function rateLimitMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const { allowed, timeoutUntil } = await checkRateLimit(c);

    if (!allowed) {
      const remainingTime = timeoutUntil
        ? Math.ceil((timeoutUntil - Date.now()) / 1000)
        : 0;
      return c.json(
        {
          error: "Too many requests",
          retryAfter: remainingTime,
        },
        429
      );
    }

    await next();
  };
}

export function authMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const path = c.req.path;

    // Skip auth for public routes
    if (
      path === "/" ||
      path === "/youtubers" ||
      path === "/videos" ||
      path.startsWith("/static/")
    ) {
      await next();
      return;
    }

    // Skip auth for CSRF token endpoint
    if (path === "/api/csrf-token") {
      await next();
      return;
    }

    // Check for API routes that need authentication
    if (path.startsWith("/api/")) {
      const method = c.req.method;

      // Allow GET requests to some endpoints without auth
      if (
        method === "GET" &&
        (path === "/api/youtubers" || path === "/api/videos")
      ) {
        await next();
        return;
      }

      // For all other API routes, require authentication
      const authHeader = c.req.header("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const token = authHeader.substring(7);
      const isValid = await validateCSRFToken(c, token);

      if (!isValid) {
        return c.json({ error: "Invalid or expired token" }, 401);
      }
    }

    await next();
  };
}

export function csrfMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const method = c.req.method;

    // Only check CSRF for state-changing operations
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const path = c.req.path;

      // Skip CSRF check for auth endpoint (it has its own CSRF handling)
      if (path === "/api/auth") {
        await next();
        return;
      }

      // Check CSRF token for API routes
      if (path.startsWith("/api/")) {
        const csrfToken = c.req.header("X-CSRF-Token");

        if (!csrfToken) {
          return c.json({ error: "CSRF token required" }, 403);
        }

        const isValid = await validateCSRFToken(c, csrfToken);

        if (!isValid) {
          return c.json({ error: "Invalid CSRF token" }, 403);
        }
      }
    }

    await next();
  };
}

export function errorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error) {
      console.error("Unhandled error:", error);

      return c.json(
        {
          error: "Internal server error",
          message:
            c.env?.ENVIRONMENT === "development" ? String(error) : undefined,
        },
        500
      );
    }
  };
}
