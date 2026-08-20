// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: { operations: { reports: { useQuery: () => ({ isLoading: false, data: {
    complianceSummary: { hospitalRate: 85 }, whatsappSummary: { pendingOrNoReply: 2, pointsLost: 3 },
    responseTimeAnalytics: { averageAcknowledgementMinutes: 12, averageResponseMinutes: 95 },
    departmentPerformance: [{ name: "Emergency", completionRate: 80, overdue: 1, openIssues: 2 }],
    repeatedProblemTrends: [{ category: "Equipment", count: 4 }],
  } }) } } },
}));

import ReportsInsights from "./ReportsInsights";

describe("ReportsInsights", () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it("renders compliance, response-time, department, and repeated-problem insights", () => {
    act(() => root.render(<ReportsInsights />));
    expect(container.textContent).toContain("85%");
    expect(container.textContent).toContain("12 min");
    expect(container.textContent).toContain("95 min");
    expect(container.textContent).toContain("Emergency");
    expect(container.textContent).toContain("Equipment");
  });
});
