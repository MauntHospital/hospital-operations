// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: { operations: {
    modules: { useQuery: () => ({ isLoading: false, data: { equipment: [{ equipment: { id: 2, name: "Emergency Defibrillator", status: "under_maintenance" }, departmentName: "Emergency" }], inventory: [], expiry: [] } }) },
    risks: { useQuery: () => ({ isLoading: false, data: [{ risk: { id: 3, description: "Generator outage", severity: "high" }, departmentName: "Maintenance" }] }) },
    managementActions: { useQuery: () => ({ isLoading: false, data: [{ action: { id: 4, title: "Test backup generator" }, departmentName: "Maintenance", effectiveStatus: "open" }] }) },
  } },
}));

import CommandSearch from "./CommandSearch";

describe("CommandSearch", () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it("consolidates equipment, risks, and management actions", () => {
    act(() => root.render(<CommandSearch />));
    expect(container.textContent).toContain("Emergency Defibrillator");
    expect(container.textContent).toContain("Generator outage");
    expect(container.textContent).toContain("Test backup generator");
  });
});
