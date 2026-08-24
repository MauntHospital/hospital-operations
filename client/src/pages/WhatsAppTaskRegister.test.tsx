/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  registerData: null as any,
  prepareInputs: [] as any[],
  dispatchInputs: [] as any[],
  responseInputs: [] as any[],
  directCompletionInputs: [] as any[],
  invalidations: [] as string[],
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, name: "Operations Manager", role: "hospital_admin" } }),
}));
vi.mock("@/lib/trpc", () => {
  const mutation = (handler: (input: any) => any) => (options: any) => ({
    isPending: false,
    mutate: (input: any) => options.onSuccess?.(handler(input)),
  });
  return { trpc: {
    operations: {
      whatsappTaskRegister: { useQuery: () => ({ isLoading: false, data: state.registerData }) },
      whatsappTaskHistory: { useQuery: () => ({ isLoading: false, data: null }) },
      whatsappTaskPrepare: { useMutation: mutation(input => { state.prepareInputs.push(input); return { dispatchId: 501, messageText: input.messageText, status: "prepared", alreadyPrepared: false }; }) },
      whatsappTaskCopied: { useMutation: mutation(() => ({ status: "copied" })) },
      whatsappTaskOpened: { useMutation: mutation(() => ({ status: "prepared" })) },
      whatsappTaskDispatch: { useMutation: mutation(input => { state.dispatchInputs.push(input); return { dispatchId: 501, alreadyDispatched: false }; }) },
      whatsappTaskResponse: { useMutation: mutation(input => { state.responseInputs.push(input); return { responseId: 601, status: "replied" }; }) },
      whatsappTaskEvidence: { useMutation: mutation(() => ({ evidenceId: 701, url: "/manus-storage/evidence" })) },
      whatsappTaskSubmitReview: { useMutation: mutation(() => ({ status: "under_review" })) },
      whatsappTaskDecision: { useMutation: mutation(() => ({ status: "verified", pointDeltaTenths: 0 })) },
      whatsappTaskVerifiedComplete: { useMutation: mutation(() => ({ status: "completed" })) },
      whatsappTaskEscalate: { useMutation: mutation(() => ({ status: "escalated" })) },
      whatsappTaskCancel: { useMutation: mutation(() => ({ status: "cancelled" })) },
      whatsappTaskReschedule: { useMutation: mutation(() => ({ status: "rescheduled" })) },
      taskManagerDirectComplete: { useMutation: mutation(input => { state.directCompletionInputs.push(input); return { status: "completed", alreadyCompleted: false }; }) },
    },
    useUtils: () => ({
      operations: {
        whatsappTaskRegister: { invalidate: () => state.invalidations.push("register") },
        whatsappTaskHistory: { invalidate: () => state.invalidations.push("history") },
        dashboard: { invalidate: () => state.invalidations.push("dashboard") },
        reports: { invalidate: () => state.invalidations.push("reports") },
      },
    }),
  }};
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import WhatsAppTaskRegister from "./WhatsAppTaskRegister";

const makeRow = (dispatch: any = null, frequency = "daily") => ({
  assignment: { id: 77, status: "not_started", dueAt: new Date("2026-08-20T09:00:00.000Z") },
  task: { id: 5, name: "Lead apron safety check", category: "Safety", priority: "high", frequency, evidenceRequired: false },
  department: { id: 4, name: "Radiology" },
  dispatch,
  effectiveStatus: dispatch?.status ?? "scheduled",
  actionRequired: true,
  suggestedMessage: "HOSPITAL OPERATIONS TASK\nRadiology — Daily task\nTask: Lead apron safety check",
});

const makeRegisterData = (dispatch: any = null) => ({
  summary: { scheduled: dispatch ? 0 : 1, prepared: 0, sent: dispatch?.sentAt ? 1 : 0, awaitingReply: dispatch ? 1 : 0, replied: 0, underReview: 0, verified: 0, completed: 0, overdue: 0, escalated: 0, actionRequired: 1 },
  scorecards: [{ departmentId: 4, departmentName: "Radiology", score: 100, pointsLost: 0 }],
  tasks: [makeRow(dispatch)],
  cadenceSummary: [
    { frequency: "daily", scheduledPlanCount: 2, dueTodayCount: 1, scheduledPlans: [{ taskId: 5, taskName: "Lead apron safety check", departmentName: "Radiology", dueTime: "09:00", recurrenceRule: null }] },
    { frequency: "weekly", scheduledPlanCount: 1, dueTodayCount: 0, scheduledPlans: [{ taskId: 6, taskName: "Weekend readiness review", departmentName: "Radiology", dueTime: "10:00", recurrenceRule: "weekly:saturday" }] },
    { frequency: "monthly", scheduledPlanCount: 1, dueTodayCount: 0, scheduledPlans: [{ taskId: 7, taskName: "Monthly attendance review", departmentName: "Radiology", dueTime: "11:00", recurrenceRule: null }] },
  ],
});

describe("WhatsAppTaskRegister command center", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    state.registerData = makeRegisterData();
    state.prepareInputs = []; state.dispatchInputs = []; state.responseInputs = []; state.directCompletionInputs = []; state.invalidations = [];
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); document.body.querySelectorAll("[data-radix-portal]").forEach(node => node.remove()); });

  it("requires an explicit manager confirmation before a prepared message is recorded as manually sent", () => {
    act(() => root.render(<WhatsAppTaskRegister />));
    const prepare = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Prepare message")) as HTMLButtonElement;
    act(() => prepare.click());
    const confirm = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Confirm manual send") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const checkbox = document.querySelector('[role="checkbox"]') as HTMLButtonElement;
    act(() => checkbox.click());
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());
    expect(state.prepareInputs).toHaveLength(1);
    expect(state.dispatchInputs).toEqual([{ assignmentId: 77, messageText: expect.stringContaining("Lead apron safety check") }]);
    expect(state.invalidations).toEqual(expect.arrayContaining(["register", "dashboard"]));
  });

  it("records a structured manager-transcribed WhatsApp reply rather than inventing a task outcome", () => {
    state.registerData = makeRegisterData({ id: 501, status: "awaiting_reply", sentAt: new Date(), messageText: "Task" });
    act(() => root.render(<WhatsAppTaskRegister />));
    const reply = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Record reply") as HTMLButtonElement;
    act(() => reply.click());
    const save = Array.from(document.querySelectorAll("button")).filter(button => button.textContent === "Record reply").at(-1) as HTMLButtonElement;
    act(() => save.click());
    expect(state.responseInputs).toEqual([expect.objectContaining({ dispatchId: 501, responseStatus: "completed" })]);
  });

  it("keeps manager-completed work outside WhatsApp dispatch and department scoring", () => {
    act(() => root.render(<WhatsAppTaskRegister />));
    const direct = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Complete myself")) as HTMLButtonElement;
    act(() => direct.click());
    const confirm = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Confirm manager completion") as HTMLButtonElement;
    act(() => confirm.click());
    expect(state.directCompletionInputs).toEqual([{ assignmentId: 77, notes: undefined }]);
    expect(state.prepareInputs).toEqual([]);
    expect(state.dispatchInputs).toEqual([]);
  });

  it("shows lifecycle metrics and daily, weekly, and monthly cadence plans", () => {
    act(() => root.render(<WhatsAppTaskRegister />));
    expect(container.textContent).toContain("Action required");
    expect(container.textContent).toContain("Awaiting reply");
    expect(container.textContent).toContain("Daily tasks");
    expect(container.textContent).toContain("Weekly tasks");
    expect(container.textContent).toContain("Monthly tasks");
    expect(container.textContent).toContain("Weekend readiness review");
  });
});
