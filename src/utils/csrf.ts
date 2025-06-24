import { Context } from "hono";
import { Env } from "../types";

export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export async function createCSRFToken(
  secret: string,
  timestamp?: number
): Promise<string> {
  const ts = timestamp || Date.now();
  const token = generateCSRFToken();
  const payload = `${token}:${ts}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(payload + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return `${token}:${ts}:${hash}`;
}

export async function verifyCSRFToken(
  secret: string,
  token: string,
  maxAge: number = 3600000
): Promise<boolean> {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return false;

    const [tokenPart, timestampStr, hash] = parts;
    const timestamp = parseInt(timestampStr);

    if (isNaN(timestamp)) return false;

    // Check if token is too old (default 1 hour)
    if (Date.now() - timestamp > maxAge) return false;

    // Recreate the expected token and verify
    const expectedToken = await createCSRFToken(secret, timestamp);
    return expectedToken === token;
  } catch {
    return false;
  }
}

export async function getCSRFToken(
  c: Context<{ Bindings: Env }>
): Promise<string> {
  return await createCSRFToken(c.env.CSRF_SECRET_KEY);
}

export async function validateCSRFToken(
  c: Context<{ Bindings: Env }>,
  token: string
): Promise<boolean> {
  return await verifyCSRFToken(c.env.CSRF_SECRET_KEY, token);
}
