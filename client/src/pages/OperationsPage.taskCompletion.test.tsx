/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  taskDetails: new Map<number, any>(),
  myDayData: null as any,
  completionInputs: [] as any[],
  completeOptions: null as any,
  invalidations: [] as string[],
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 7, name: "Test Staff" } }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    operations: {
      myDay: { useQuery: () => ({ isLoading: false, data: state.myDayData }) },
      taskDetail: { useQuery: ({ assignmentId }: { assignmentId: number }) => ({ isLoading: false, data: state.taskDetails.get(assignmentId) }) },
      checklistSave: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      taskComplete: { useMutation: (options: any) => { state.completeOptions = options; return { isPending: false, mutate: (input: any) => { state.completionInputs.push(input); options.onSuccess({ status: "completed" }); } }; } },
    },
    useUtils: () => ({ operations: { taskDetail: { invalidate: ({ assignmentId }: { assignmentId: number }) => state.invalidations.push(`detail:${assignmentId}`) }, myDay: { invalidate: () => state.invalidations.push("my-day") }, dashboard: { invalidate: () => state.invalidations.push("dashboard") }, issues: { invalidate: vi.fn() } } }),
  },
}));
vi.mock("wouter", () => ({ Link: ({ children }: { children: React.ReactNode }) => children, useLocation: () => ["/my-day", vi.fn()], useRoute: () => [false, {}] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MyDay, TaskDetail } from "./OperationsPage";

const checklist = (id: number, taskId: number) => ({ id, taskId, label: "Required safety check", required: true, active: true, position: 0, result: { id: id + 100, assignmentId: taskId, checklistId: id, status: "available" } });
const detail = (assignmentId: number, requiresEvidence: boolean) => ({
  assignment: { id: assignmentId, taskId: assignmentId + 10, departmentId: 4, assignedUserId: 7, dueAt: new Date(Date.now() + 60_000), status: "in_progress" },
  task: { id: assignmentId + 10, name: `Safety task ${assignmentId}`, frequency: "daily", priority: "high", category: "Safety", description: null, instructions: null, approvalRequired: false, evidenceRequired: requiresEvidence, photoRequired: requiresEvidence },
  department: { id: 4, name: "Radiology" },
  effectiveStatus: "in_progress",
  checklist: [checklist(assignmentId + 20, assignmentId + 10)],
});

describe("TaskDetail sequential completion flow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.taskDetails = new Map([[77, detail(77, false)], [78, detail(78, true)]]);
    state.myDayData = {
      tasks: Array.from(state.taskDetails.values()).map(item => ({ assignment: item.assignment, task: item.task, departmentName: "Radiology", effectiveStatus: "in_progress" })),
      counts: { total: 2, overdue: 0, pending: 2, completed: 0 },
    };
    state.completionInputs = [];
    state.invalidations = [];
    state.completeOptions = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("allows a staff member to submit a second evidence-required task after completing the first task", () => {
    act(() => root.render(<MyDay />));
    expect(container.textContent).toContain("Safety task 77");
    expect(container.textContent).toContain("Safety task 78");

    act(() => root.render(<TaskDetail key="77" assignmentId={77} />));
    const firstSubmit = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Mark task completed") as HTMLButtonElement;
    expect(firstSubmit.disabled).toBe(false);
    act(() => firstSubmit.click());
    expect(state.completionInputs).toEqual([{ assignmentId: 77, notes: "", evidenceUrl: undefined }]);

    state.myDayData = {
      tasks: [
        { assignment: { ...state.taskDetails.get(77).assignment, status: "completed", completedAt: new Date() }, task: state.taskDetails.get(77).task, departmentName: "Radiology", effectiveStatus: "completed" },
        { assignment: state.taskDetails.get(78).assignment, task: state.taskDetails.get(78).task, departmentName: "Radiology", effectiveStatus: "in_progress" },
      ],
      counts: { total: 2, overdue: 0, pending: 1, completed: 1 },
    };
    act(() => root.render(<MyDay />));
    expect(container.textContent).toContain("Completed tasks");
    expect(container.textContent).toContain("Safety task 78");

    act(() => root.render(<TaskDetail key="78" assignmentId={78} />));
    const evidenceInput = container.querySelector("#taskEvidence") as HTMLInputElement;
    const secondSubmit = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Mark task completed") as HTMLButtonElement;
    expect(evidenceInput).toBeTruthy();
    expect(secondSubmit.disabled).toBe(true);

    act(() => {
      const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      nativeValueSetter?.call(evidenceInput, "https://evidence.example/radiation-barrier.jpg");
      evidenceInput.dispatchEvent(new Event("input", { bubbles: true }));
      evidenceInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(secondSubmit.disabled).toBe(false);
    act(() => secondSubmit.click());

    expect(state.completionInputs[1]).toEqual({ assignmentId: 78, notes: "", evidenceUrl: "https://evidence.example/radiation-barrier.jpg" });
    expect(state.invalidations).toEqual(expect.arrayContaining(["detail:77", "detail:78", "my-day", "dashboard"]));
  });
});
