import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const HASH_LENGTH = 64;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function passwordPolicyError(password: string) {
  if (password.length < 12) return "Use at least 12 characters for the temporary password.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return "Use upper-case, lower-case, and numeric characters in the temporary password.";
  return null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, HASH_LENGTH) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, encoded] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const derived = await scrypt(password, salt, HASH_LENGTH) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
