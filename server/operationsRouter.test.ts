import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("operations router access surface", () => {
  it("retains legacy route contracts only with the manager-owned completion route available to current UI code", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers/operations.ts"), "utf8");
    expect(source).toMatch(/^\s*myDay\s*:/m);
    expect(source).toMatch(/^\s*taskDetail\s*:/m);
    expect(source).toMatch(/^\s*checklistSave\s*:/m);
    expect(source).toMatch(/^\s*taskComplete\s*:/m);
    expect(source).toMatch(/^\s*taskManagerDirectComplete\s*:/m);
  });
});
