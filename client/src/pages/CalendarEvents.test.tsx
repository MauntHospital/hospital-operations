// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    operations: {
      calendar: {
        useQuery: () => ({
          isLoading: false,
          data: {
            tasks: [],
            maintenance: [],
            expiry: [],
            duties: [],
            risks: [
              {
                id: 1,
                title: "Review oxygen-risk mitigation",
                date: new Date("2026-08-21"),
                departmentName: "Emergency",
                status: "open",
              },
            ],
            managementActions: [
              {
                id: 2,
                title: "Verify crash-cart seal",
                date: new Date("2026-08-22"),
                departmentName: "Emergency",
                status: "open",
              },
            ],
          },
        }),
      },
    },
  },
}));

import CalendarEvents from "./CalendarEvents";

describe("CalendarEvents", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  it("includes risk-review and management-action deadlines", () => {
    act(() => root.render(<CalendarEvents />));
    expect(container.textContent).toContain("Review oxygen-risk mitigation");
    expect(container.textContent).toContain("Verify crash-cart seal");
  });
});
