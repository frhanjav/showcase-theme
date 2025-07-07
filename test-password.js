// Quick test to generate a hash for a known password
import { hashPassword } from "./src/utils/auth";

async function testHash() {
  const password = "admin123456789";
  const hash = await hashPassword(password);
  console.log("Password:", password);
  console.log("Hash:", hash);
}

testHash();
