import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Version 2 data-preservation migration", () => {
  it("adds command-center structures without destructive table or data statements", () => {
    const sql = readFileSync(resolve(process.cwd(), "drizzle/0005_cold_korath.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE `risks`/);
    expect(sql).toMatch(/CREATE TABLE `managementActions`/);
    expect(sql).toMatch(/ALTER TABLE `whatsappTaskDispatches` MODIFY COLUMN `status`/);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
  });
});
