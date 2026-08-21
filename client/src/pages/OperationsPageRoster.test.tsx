/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, name: "Operations Manager", role: "hospital_admin" } }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    operations: {
      modules: { useQuery: () => ({ isLoading: false, data: { rosters: [], handovers: [], departments: [] } }) },
      handoverCreate: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      dutyAttendanceUpdate: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    useUtils: () => ({ operations: { modules: { invalidate: vi.fn() }, dashboard: { invalidate: vi.fn() } } }),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OperationsPage from "./OperationsPage";

describe("Duty roster empty state", () => {
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

  it("shows a readable no-coverage card instead of an empty wide table", () => {
    act(() => root.render(<OperationsPage view="roster" />));

    expect(container.textContent).toContain("No duty coverage is recorded for today");
    expect(container.textContent).toContain("Add or import the current shift roster");
    expect(container.querySelector("table")).toBeNull();
  });
});
