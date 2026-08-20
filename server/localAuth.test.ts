import { describe, expect, it } from "vitest";
import { hashPassword, normalizeUsername, passwordPolicyError, verifyPassword } from "./localAuth";

describe("local staff credentials", () => {
  it("normalizes account names and rejects weak temporary passwords", () => {
    expect(normalizeUsername(" Priya.Nair ")).toBe("priya.nair");
    expect(passwordPolicyError("short")).toMatch(/12 characters/i);
    expect(passwordPolicyError("alllowercase123")).toMatch(/upper-case/i);
    expect(passwordPolicyError("AValidPassword2026")).toBeNull();
  });

  it("stores a salted password hash and verifies only the correct password", async () => {
    const hash = await hashPassword("AValidPassword2026");
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("AValidPassword2026");
    await expect(verifyPassword("AValidPassword2026", hash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", hash)).resolves.toBe(false);
  });
});
