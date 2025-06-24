import { Hono } from "hono";
import { Env } from "../types";
import { DatabaseService } from "../utils/database";
import { getCSRFToken } from "../utils/csrf";
import { verifyPassword } from "../utils/auth";
import { recordFailedAttempt, resetRateLimit } from "../utils/rateLimit";

const auth = new Hono<{ Bindings: Env }>();

// Get CSRF token
auth.get("/csrf", async (c) => {
  try {
    const token = await getCSRFToken(c);
    return c.json({ csrfToken: token });
  } catch (error) {
    console.error("Error generating CSRF token:", error);
    return c.json({ error: "Failed to generate CSRF token" }, 500);
  }
});

// Authenticate with password
auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { password, csrf_token } = body;

    if (!password || !csrf_token) {
      return c.json({ error: "Password and CSRF token are required" }, 400);
    }

    // Verify CSRF token
    const { validateCSRFToken } = await import("../utils/csrf");
    const isValidCSRF = await validateCSRFToken(c, csrf_token);
    if (!isValidCSRF) {
      return c.json({ error: "Invalid CSRF token" }, 403);
    }

    // Verify password
    const isValidPassword = await verifyPassword(
      password,
      c.env.ADMIN_PASSWORD_HASH
    );

    if (!isValidPassword) {
      // Record failed attempt for rate limiting
      await recordFailedAttempt(c);
      return c.json({ error: "Invalid password" }, 401);
    }

    // Reset rate limit on successful auth
    await resetRateLimit(c);

    // Generate new token for authenticated requests
    const authToken = await getCSRFToken(c);

    return c.json({
      success: true,
      token: authToken,
      message: "Authentication successful",
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return c.json({ error: "Authentication failed" }, 500);
  }
});

export default auth;
