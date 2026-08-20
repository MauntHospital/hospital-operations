// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: { operations: { dashboard: { useQuery: () => ({ isLoading: false, data: { notifications: [{ id: 1, title: "Task overdue", body: "Department review required.", createdAt: new Date("2026-08-20T08:00:00Z") }] } }) } } },
}));

import NotificationCenter from "./NotificationCenter";

describe("NotificationCenter", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it("renders current system-generated operational alerts", () => {
    act(() => root.render(<NotificationCenter />));
    expect(container.textContent).toContain("Task overdue");
    expect(container.textContent).toContain("Department review required.");
  });
});
