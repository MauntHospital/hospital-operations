/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  registerData: null as any,
  dispatchInputs: [] as any[],
  outcomeInputs: [] as any[],
  invalidations: [] as string[],
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, name: "Operations Manager", role: "hospital_admin" } }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    operations: {
      whatsappTaskRegister: { useQuery: () => ({ isLoading: false, data: state.registerData }) },
      whatsappTaskDispatch: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { state.dispatchInputs.push(input); options.onSuccess({ dispatchId: 501, messageText: input.messageText, alreadyDispatched: false }); } }) },
      whatsappTaskOutcome: { useMutation: (options: any) => ({ isPending: false, mutate: (input: any) => { state.outcomeInputs.push(input); options.onSuccess({ status: input.outcome, penaltyApplied: false }); } }) },
    },
    useUtils: () => ({ operations: { whatsappTaskRegister: { invalidate: () => state.invalidations.push("register") }, dashboard: { invalidate: () => state.invalidations.push("dashboard") } } }),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import WhatsAppTaskRegister from "./WhatsAppTaskRegister";

const makeRow = (dispatch: any = null, frequency = "daily") => ({
  assignment: { id: 77, dueAt: new Date("2026-08-20T09:00:00.000Z") },
  task: { id: 5, name: "Lead apron safety check", category: "Safety", frequency },
  department: { id: 4, name: "Radiology" },
  dispatch,
  suggestedMessage: "Radiology daily task: Lead apron safety check. Reply by end of day.",
});

const makeRegisterData = (dispatch: any = null) => ({
  summary: { sent: dispatch?.status === "sent" ? 1 : 0, completed: dispatch?.status === "completed" ? 1 : 0, pending: 0, notSent: dispatch ? 0 : 1 },
  scorecards: [{ departmentId: 4, departmentName: "Radiology", score: 100, pointsLost: 0 }],
  tasks: [makeRow(dispatch)],
});

describe("WhatsAppTaskRegister manager workflow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.registerData = makeRegisterData();
    state.dispatchInputs = [];
    state.outcomeInputs = [];
    state.invalidations = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.querySelectorAll("[data-radix-portal]").forEach(node => node.remove());
  });

  it("requires a manager confirmation after reviewing the visible WhatsApp message before recording a task as sent", () => {
    act(() => root.render(<WhatsAppTaskRegister />));
    const prepareButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Prepare message")) as HTMLButtonElement;
    act(() => prepareButton.click());

    const preview = document.querySelector("#whatsappMessagePreview") as HTMLTextAreaElement;
    const recordButton = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Record as sent") as HTMLButtonElement;
    expect(preview.value).toContain("Lead apron safety check");
    expect(recordButton.disabled).toBe(true);

    const confirmation = document.querySelector('[role="checkbox"]') as HTMLButtonElement;
    act(() => confirmation.click());
    expect(recordButton.disabled).toBe(false);
    act(() => recordButton.click());

    expect(state.dispatchInputs).toEqual([{ assignmentId: 77, messageText: "Radiology daily task: Lead apron safety check. Reply by end of day." }]);
    expect(state.invalidations).toEqual(expect.arrayContaining(["register", "dashboard"]));
  });

  it("records an end-of-day department reply from the task register", () => {
    state.registerData = makeRegisterData({ id: 501, status: "sent", messageText: "Radiology daily task" });
    act(() => root.render(<WhatsAppTaskRegister />));
    const replyButton = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Record EOD reply") as HTMLButtonElement;
    act(() => replyButton.click());
    const saveButton = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Save end-of-day outcome") as HTMLButtonElement;
    act(() => saveButton.click());

    expect(state.outcomeInputs).toEqual([{ dispatchId: 501, outcome: "completed", note: undefined }]);
    expect(state.invalidations).toEqual(expect.arrayContaining(["register", "dashboard"]));
  });

  it("labels daily, weekly, and monthly WhatsApp tasks by cadence", () => {
    state.registerData = { ...makeRegisterData(), tasks: [makeRow(null, "daily"), { ...makeRow(null, "weekly"), assignment: { id: 78, dueAt: new Date("2026-08-20T10:00:00.000Z") } }, { ...makeRow(null, "monthly"), assignment: { id: 79, dueAt: new Date("2026-08-20T11:00:00.000Z") } }] };
    act(() => root.render(<WhatsAppTaskRegister />));

    expect(container.textContent).toContain("Daily");
    expect(container.textContent).toContain("Weekly");
    expect(container.textContent).toContain("Monthly");
  });
});
