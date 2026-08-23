import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("workspace feedback components", () => {
  const source = readFileSync(
    new URL("./WorkspaceFeedback.tsx", import.meta.url),
    "utf8"
  );

  it("provides an animated and announced loading state for manager workspaces", () => {
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("animate-spin");
    expect(source).toContain("Loading operations workspace");
  });

  it("provides an accessible, retryable error state", () => {
    expect(source).toContain('role="alert"');
    expect(source).toContain("Try again");
    expect(source).toContain("onRetry");
  });
});
