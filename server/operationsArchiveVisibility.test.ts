import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "server/operationsData.ts"),
  "utf8"
);

function section(start: string, end: string) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe("archived task visibility", () => {
  it("keeps archived task definitions out of active dashboard, register, and schedule queries", () => {
    expect(
      section(
        "export async function getDashboard",
        "export async function getReports"
      )
    ).toContain(".where(eq(tasks.active, true))");
    expect(
      section(
        "export async function getWhatsAppTaskRegister",
        "export async function whatsappTaskPrepare"
      )
    ).toContain("and(eq(tasks.active, true), taskRegisterScope)");
    expect(
      section(
        "export async function getDepartmentTaskSchedules",
        "export async function listIssues"
      )
    ).toContain("eq(tasks.active, true)");
  });
});
