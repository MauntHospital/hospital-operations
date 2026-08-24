import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const operationsData = readFileSync(
  resolve(process.cwd(), "server/operationsData.ts"),
  "utf8"
);
const operationsRouter = readFileSync(
  resolve(process.cwd(), "server/routers/operations.ts"),
  "utf8"
);
const operationsPage = readFileSync(
  resolve(process.cwd(), "client/src/pages/OperationsPage.tsx"),
  "utf8"
);

describe("expiry item resolution", () => {
  it("deactivates handled expiry items and excludes inactive records from active dashboard modules", () => {
    expect(operationsData).toContain("export async function resolveExpiryItem");
    expect(operationsData).toContain(".set({ active: false })");
    expect(operationsData).toContain('"expiry_item_handled"');
    expect(operationsData).toContain("eq(expiryItems.active, true)");
  });

  it("exposes the protected resolution action and manager-facing handled control", () => {
    expect(operationsRouter).toMatch(/^\s*expiryResolve\s*:/m);
    expect(operationsRouter).toContain("resolveExpiryItem(ctx.user, input)");
    expect(operationsPage).toContain("operations.expiryResolve.useMutation");
    expect(operationsPage).toContain("Mark handled");
  });
});
