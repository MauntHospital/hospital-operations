// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ followUpInputs: [] as any[], invalidations: [] as string[] }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    operations: {
      modules: { useQuery: () => ({ isLoading: false, data: { equipment: [], expiry: [], inventory: [{ inventory: { id: 41, name: "Emergency medicines", quantity: 0, reorderLevel: 20, unit: "packs" }, departmentName: "Emergency", lowStock: true }] } }) },
      operationalFollowUpCreate: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { state.followUpInputs.push(input); options.onSuccess(); } }) },
    },
    useUtils: () => ({ operations: { dashboard: { invalidate: () => state.invalidations.push("dashboard") }, modules: { invalidate: () => state.invalidations.push("modules") }, whatsappTaskRegister: { invalidate: () => state.invalidations.push("register") } } }),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OperationalFollowUps from "./OperationalFollowUps";

describe("OperationalFollowUps", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.followUpInputs = [];
    state.invalidations = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("requires an explicit manager action before creating a linked inventory follow-up task", () => {
    act(() => root.render(<OperationalFollowUps />));
    expect(container.textContent).toContain("Emergency medicines");
    expect(state.followUpInputs).toEqual([]);

    const createButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Create follow-up task")) as HTMLButtonElement;
    act(() => createButton.click());

    expect(state.followUpInputs).toEqual([{ sourceType: "inventory", sourceId: 41 }]);
    expect(state.invalidations).toEqual(expect.arrayContaining(["dashboard", "modules", "register"]));
  });
});
