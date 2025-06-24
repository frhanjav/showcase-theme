// Simple script to generate password hash for testing
// Run with: node test-hash.js

const crypto = require("crypto");

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // Generate salt
  const salt = crypto.randomBytes(16);

  // Use PBKDF2 with Node.js crypto
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");

  // Combine salt and hash
  const combined = Buffer.concat([salt, hash]);

  // Convert to base64
  return combined.toString("base64");
}

const testPassword = "admin123456789";
const hash = hashPassword(testPassword);
console.log("Password:", testPassword);
console.log("Hash:", hash);

// Also create a simpler test hash for development
const simpleHash = crypto
  .pbkdf2Sync("admin123", crypto.randomBytes(16), 10000, 32, "sha256")
  .toString("base64");
console.log('Simple test hash for "admin123":', simpleHash);
