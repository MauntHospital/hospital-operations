import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  WorkspaceError,
  WorkspaceLoading,
} from "@/components/WorkspaceFeedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCopy,
  MessageCircleMore,
  MinusCircle,
  Send,
  Trophy,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const managers = [
  "super_admin",
  "hospital_admin",
  "department_head",
  "supervisor",
];

function statusTone(status: string) {
  if (
    ["completed", "acknowledged", "reviewed", "closed", "excused"].includes(
      status
    )
  )
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["pending", "no_reply"].includes(status))
    return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function formatDue(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function cadenceLabel(frequency: string) {
  if (frequency === "monthly") return "Monthly";
  if (frequency === "weekly") return "Weekly";
  return "Daily";
}

export default function WhatsAppTaskRegister() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const register = trpc.operations.whatsappTaskRegister.useQuery(undefined, {
    enabled: Boolean(user && managers.includes(user.role)),
  });
  const [dispatchDialog, setDispatchDialog] = useState<any | null>(null);
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [sentConfirmed, setSentConfirmed] = useState(false);
  const [outcomeDialog, setOutcomeDialog] = useState<any | null>(null);
  const [outcome, setOutcome] = useState<
    "completed" | "pending" | "no_reply" | "excused"
  >("completed");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [excusedReason, setExcusedReason] = useState("");
  const [directCompletionDialog, setDirectCompletionDialog] = useState<
    any | null
  >(null);
  const [directCompletionNote, setDirectCompletionNote] = useState("");
  const prepare = trpc.operations.whatsappTaskPrepare.useMutation({
    onSuccess: result => {
      toast.success(
        result.alreadyPrepared
          ? "This task message is already prepared."
          : "Task message prepared. Copy it, send it manually, then confirm the send."
      );
      utils.operations.whatsappTaskRegister.invalidate();
    },
    onError: error =>
      toast.error(error.message || "The task message could not be prepared."),
  });
  const copied = trpc.operations.whatsappTaskCopied.useMutation({
    onSuccess: () => {
      toast.success("Message copy recorded in the task timeline.");
      utils.operations.whatsappTaskRegister.invalidate();
    },
    onError: error =>
      toast.error(error.message || "The copy action could not be recorded."),
  });
  const dispatch = trpc.operations.whatsappTaskDispatch.useMutation({
    onSuccess: result => {
      toast.success(
        result.alreadyDispatched
          ? "This WhatsApp task was already recorded as sent."
          : "Task distribution recorded as sent."
      );
      setDispatchDialog(null);
      setDispatchMessage("");
      setSentConfirmed(false);
      utils.operations.whatsappTaskRegister.invalidate();
      utils.operations.dashboard.invalidate();
    },
    onError: error =>
      toast.error(error.message || "The WhatsApp task could not be recorded."),
  });
  const recordOutcome = trpc.operations.whatsappTaskOutcome.useMutation({
    onSuccess: result => {
      toast.success(
        result.penaltyApplied
          ? "Outcome recorded; one department point was deducted."
          : "End-of-day response recorded."
      );
      setOutcomeDialog(null);
      setOutcomeNote("");
      utils.operations.whatsappTaskRegister.invalidate();
      utils.operations.dashboard.invalidate();
    },
    onError: error =>
      toast.error(error.message || "The response could not be recorded."),
  });
  const acknowledge = trpc.operations.whatsappTaskAcknowledge.useMutation({
    onSuccess: () => {
      toast.success("Department acknowledgement recorded.");
      utils.operations.whatsappTaskRegister.invalidate();
      utils.operations.dashboard.invalidate();
    },
    onError: error =>
      toast.error(
        error.message || "The acknowledgement could not be recorded."
      ),
  });
  const review = trpc.operations.whatsappTaskReview.useMutation({
    onSuccess: result => {
      toast.success(
        result.status === "closed"
          ? "Task lifecycle closed."
          : "Task outcome reviewed."
      );
      utils.operations.whatsappTaskRegister.invalidate();
      utils.operations.dashboard.invalidate();
    },
    onError: error =>
      toast.error(error.message || "The review could not be recorded."),
  });
  const directComplete = trpc.operations.taskManagerDirectComplete.useMutation({
    onSuccess: result => {
      toast.success(
        result.alreadyCompleted
          ? "This task was already completed directly."
          : "Task recorded as completed by the operations manager. It was not sent to WhatsApp and did not affect the department score."
      );
      setDirectCompletionDialog(null);
      setDirectCompletionNote("");
      utils.operations.whatsappTaskRegister.invalidate();
      utils.operations.dashboard.invalidate();
      utils.operations.reports.invalidate();
    },
    onError: error =>
      toast.error(
        error.message || "The direct manager completion could not be recorded."
      ),
  });

  if (!user || !managers.includes(user.role))
    return (
      <Card className="mx-auto max-w-xl border-rose-200">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-600" />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">
            Manager access required
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Only operational managers can distribute department WhatsApp tasks
            and maintain the accountability scorecard.
          </p>
        </CardContent>
      </Card>
    );
  if (register.isLoading)
    return (
      <WorkspaceLoading
        title="Loading WhatsApp task register"
        description="Retrieving today’s department accountability workflow."
      />
    );
  if (register.error || !register.data)
    return (
      <WorkspaceError
        title="WhatsApp task register unavailable"
        description={
          register.error?.message ||
          "The department accountability workflow could not be retrieved."
        }
        onRetry={() => register.refetch()}
      />
    );

  const { summary, scorecards, tasks, cadenceSummary } = register.data;
  const openDispatchMessage = (row: any) => {
    if (!row.dispatch) {
      prepare.mutate(
        { assignmentId: row.assignment.id, messageText: row.suggestedMessage },
        {
          onSuccess: result =>
            setDispatchDialog({
              ...row,
              dispatch: {
                id: result.dispatchId,
                status: result.status,
                messageText: result.messageText,
              },
            }),
        }
      );
      setDispatchDialog({
        ...row,
        dispatch: {
          id: null,
          status: "prepared",
          messageText: row.suggestedMessage,
        },
      });
    } else {
      setDispatchDialog(row);
    }
    setDispatchMessage(row.dispatch?.messageText ?? row.suggestedMessage);
    setSentConfirmed(
      row.dispatch?.status === "sent" || row.dispatch?.status === "acknowledged"
    );
  };
  const copyDispatchMessage = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard is unavailable.");
      await navigator.clipboard.writeText(dispatchMessage);
      toast.success(
        "Message copied. Send it in the department WhatsApp group, then confirm below."
      );
      if (dispatchDialog?.dispatch?.id)
        copied.mutate({ dispatchId: dispatchDialog.dispatch.id });
    } catch {
      toast.error(
        "Clipboard is unavailable. Manually select the message below, copy it, send it, then confirm."
      );
    }
  };
  return (
    <>
      <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
            Manager-led accountability
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            WhatsApp task register
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
            Distribute department work manually through WhatsApp when needed, or
            use <strong>Complete myself</strong> for work you perform directly
            as operations manager. Directly completed work is not sent to
            WhatsApp and does not affect department scoring.
          </p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
          <p className="font-semibold">Scoring rule</p>
          <p className="mt-0.5 text-xs leading-relaxed text-teal-800">
            A pending or no-reply WhatsApp outcome deducts one point once from
            the department score.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Send}
          label="Distributed task records"
          value={summary.sent}
          hint={`${summary.awaitingAcknowledgement} awaiting acknowledgement`}
          tone="teal"
        />
        <Metric
          icon={CheckCircle2}
          label="Completed replies"
          value={summary.completed}
          hint="Confirmed at end of day"
          tone="emerald"
        />
        <Metric
          icon={AlertTriangle}
          label="Pending / no reply"
          value={summary.pending}
          hint="Point deduction applies once"
          tone="rose"
        />
        <Metric
          icon={MessageCircleMore}
          label="Still to distribute"
          value={summary.notSent}
          hint="Copy message and send manually"
          tone="sky"
        />
      </div>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Task cadence at a glance
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              See every active Daily, Weekly, and Monthly department plan—even
              when a weekly or monthly task is not due today.
            </p>
          </div>
          <Link
            href="/department-schedules"
            className="text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            Manage task schedules
          </Link>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {cadenceSummary.map(cadence => (
            <CadenceCard key={cadence.frequency} cadence={cadence} />
          ))}
        </div>
      </section>

      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-600" />
            <div>
              <CardTitle className="text-base">
                Department accountability scorecard
              </CardTitle>
              <CardDescription>
                Scores begin at 100 each month. This view is ready to review in
                departmental meetings.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Points lost</TableHead>
                  <TableHead>Meeting status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scorecards.map(scorecard => (
                  <TableRow key={scorecard.departmentId}>
                    <TableCell className="font-medium text-slate-800">
                      {scorecard.departmentName}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          scorecard.score < 95
                            ? "font-semibold text-rose-700"
                            : "font-semibold text-emerald-700"
                        }
                      >
                        {scorecard.score}/100
                      </span>
                    </TableCell>
                    <TableCell>
                      {scorecard.pointsLost ? (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <MinusCircle className="h-3.5 w-3.5" />
                          {scorecard.pointsLost}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          scorecard.score < 95
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }
                      >
                        {scorecard.score < 95 ? "Needs discussion" : "On track"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {scorecards.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-20 text-center text-sm text-slate-500"
                    >
                      No active departments are available for scoring.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            Today’s task distribution and manager work
          </CardTitle>
          <CardDescription>
            Due daily, weekly, and monthly tasks appear here on their scheduled
            date. Prepare a WhatsApp message for department work, or select{" "}
            <strong>Complete myself</strong> when you will personally perform
            the task. Direct completion is recorded in the audit trail without
            creating a WhatsApp dispatch or point deduction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 sm:hidden">
            Swipe left in the task table to reach the distribution and direct
            manager-completion controls.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Workflow status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(row => (
                  <TableRow key={row.assignment.id}>
                    <TableCell className="min-w-60">
                      <p className="font-medium text-slate-800">
                        {row.task.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.task.category}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.task.frequency === "monthly"
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : row.task.frequency === "weekly"
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-teal-200 bg-teal-50 text-teal-700"
                        }
                      >
                        {cadenceLabel(row.task.frequency)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {row.department.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {formatDue(row.assignment.dueAt)}
                    </TableCell>
                    <TableCell>
                      {row.dispatch ? (
                        <Badge
                          variant="outline"
                          className={statusTone(row.dispatch.status)}
                        >
                          {row.dispatch.status.replaceAll("_", " ")}
                        </Badge>
                      ) : row.assignment.status === "completed" ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          Manager completed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-50 text-slate-600"
                        >
                          Scheduled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="min-w-64 text-right">
                      <TaskLifecycleActions
                        row={row}
                        onOpenMessage={openDispatchMessage}
                        onDirectComplete={() => {
                          setDirectCompletionDialog(row);
                          setDirectCompletionNote("");
                        }}
                        onRecordOutcome={() => {
                          setOutcomeDialog(row);
                          setOutcome("completed");
                          setOutcomeNote("");
                          setExcusedReason("");
                        }}
                        onAcknowledge={() => {
                          if (row.dispatch)
                            acknowledge.mutate({ dispatchId: row.dispatch.id });
                        }}
                        onReview={() => {
                          if (row.dispatch)
                            review.mutate({ dispatchId: row.dispatch.id });
                        }}
                        onClose={() => {
                          if (row.dispatch)
                            review.mutate({
                              dispatchId: row.dispatch.id,
                              close: true,
                            });
                        }}
                        busy={
                          prepare.isPending ||
                          dispatch.isPending ||
                          acknowledge.isPending ||
                          review.isPending ||
                          directComplete.isPending
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {tasks.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-28 text-center text-sm text-slate-500"
                    >
                      There are no daily, weekly, or monthly task assignments
                      due today.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(dispatchDialog)}
        onOpenChange={open => !open && setDispatchDialog(null)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Prepare department WhatsApp message</DialogTitle>
            <DialogDescription>
              {dispatchDialog
                ? `${dispatchDialog.department.name} · ${dispatchDialog.task.name}`
                : "Copy the task message before sending it manually."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div>
              <Label htmlFor="whatsappMessagePreview">Message to send</Label>
              <Textarea
                id="whatsappMessagePreview"
                className="mt-2 min-h-64 font-mono text-xs leading-relaxed"
                value={dispatchMessage}
                onChange={event => setDispatchMessage(event.target.value)}
                readOnly={Boolean(dispatchDialog?.dispatch?.id)}
              />
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                The task is not recorded as sent until you personally confirm
                that it has been sent in the department WhatsApp group.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={copyDispatchMessage}
            >
              <ClipboardCopy className="mr-2 h-4 w-4" />
              Copy message
            </Button>
            {!dispatchDialog?.dispatch ||
            ["prepared", "copied"].includes(dispatchDialog.dispatch.status) ? (
              <>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                  <Checkbox
                    checked={sentConfirmed}
                    onCheckedChange={checked =>
                      setSentConfirmed(checked === true)
                    }
                    className="mt-0.5"
                  />
                  <span>
                    I have sent this message to the department WhatsApp group.
                  </span>
                </label>
                <Button
                  disabled={!sentConfirmed || dispatch.isPending}
                  onClick={() =>
                    dispatch.mutate({
                      assignmentId: dispatchDialog.assignment.id,
                      messageText: dispatchMessage,
                    })
                  }
                  className="bg-teal-700 hover:bg-teal-800"
                >
                  {dispatch.isPending ? "Recording…" : "Confirm manual send"}
                </Button>
              </>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                This message is already recorded as{" "}
                {dispatchDialog.dispatch.status.replaceAll("_", " ")}.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(outcomeDialog)}
        onOpenChange={open => !open && setOutcomeDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record end-of-day WhatsApp reply</DialogTitle>
            <DialogDescription>
              {outcomeDialog
                ? `${outcomeDialog.task.name} · ${outcomeDialog.department.name}`
                : "Record the department outcome."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div>
              <Label>Outcome</Label>
              <Select
                value={outcome}
                onValueChange={value => setOutcome(value as typeof outcome)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">
                    Pending — weighted deduction
                  </SelectItem>
                  <SelectItem value="no_reply">
                    No reply — weighted deduction
                  </SelectItem>
                  <SelectItem value="excused">
                    Excused — no deduction
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {outcome === "excused" && (
              <div>
                <Label htmlFor="whatsappExcusedReason">Excused reason</Label>
                <Select value={excusedReason} onValueChange={setExcusedReason}>
                  <SelectTrigger id="whatsappExcusedReason" className="mt-2">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Emergency situation">
                      Emergency situation
                    </SelectItem>
                    <SelectItem value="Staff shortage">
                      Staff shortage
                    </SelectItem>
                    <SelectItem value="Equipment failure">
                      Equipment failure
                    </SelectItem>
                    <SelectItem value="Power outage">Power outage</SelectItem>
                    <SelectItem value="Stock unavailable">
                      Stock unavailable
                    </SelectItem>
                    <SelectItem value="Task cancelled">
                      Task cancelled
                    </SelectItem>
                    <SelectItem value="Management instruction">
                      Management instruction
                    </SelectItem>
                    <SelectItem value="External dependency">
                      External dependency
                    </SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="whatsappOutcomeNote">Reply or manager note</Label>
              <Textarea
                id="whatsappOutcomeNote"
                className="mt-2"
                value={outcomeNote}
                onChange={event => setOutcomeNote(event.target.value)}
                placeholder="Record the department’s WhatsApp response or reason for the outcome."
              />
            </div>
            {["pending", "no_reply"].includes(outcome) && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800">
                Recording this outcome applies the configured weighted point
                deduction exactly once. The scorecard and audit trail will
                update.
              </p>
            )}
            {outcome === "excused" && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
                An excused outcome requires a reason and does not reduce
                department performance.
              </p>
            )}
            <Button
              disabled={
                recordOutcome.isPending ||
                (outcome === "excused" && !excusedReason)
              }
              onClick={() =>
                outcomeDialog &&
                recordOutcome.mutate({
                  dispatchId: outcomeDialog.dispatch.id,
                  outcome,
                  note: outcomeNote || undefined,
                  excusedReason:
                    outcome === "excused" ? excusedReason : undefined,
                })
              }
              className="bg-teal-700 hover:bg-teal-800"
            >
              {recordOutcome.isPending ? "Saving…" : "Save end-of-day outcome"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(directCompletionDialog)}
        onOpenChange={open => !open && setDirectCompletionDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete task yourself</DialogTitle>
            <DialogDescription>
              {directCompletionDialog
                ? `${directCompletionDialog.task.name} · ${directCompletionDialog.department.name}`
                : "Record work completed directly by the operations manager."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs leading-relaxed text-teal-900">
              This records the task as completed directly by you. It does not
              prepare or send a WhatsApp message, and it does not change the
              department score.
            </p>
            <div>
              <Label htmlFor="directManagerCompletionNote">
                Manager completion note
              </Label>
              <Textarea
                id="directManagerCompletionNote"
                className="mt-2"
                value={directCompletionNote}
                onChange={event => setDirectCompletionNote(event.target.value)}
                placeholder="Optional: record what you completed or any follow-up needed."
              />
            </div>
            <Button
              disabled={directComplete.isPending}
              onClick={() =>
                directCompletionDialog &&
                directComplete.mutate({
                  assignmentId: directCompletionDialog.assignment.id,
                  notes: directCompletionNote || undefined,
                })
              }
              className="bg-teal-700 hover:bg-teal-800"
            >
              <UserCheck className="mr-2 h-4 w-4" />
              {directComplete.isPending
                ? "Recording…"
                : "Confirm manager completion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Send;
  label: string;
  value: number;
  hint: string;
  tone: "teal" | "emerald" | "rose" | "sky";
}) {
  const colors = {
    teal: "bg-teal-50 text-teal-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    sky: "bg-sky-50 text-sky-700",
  };
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${colors[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskLifecycleActions({
  row,
  onOpenMessage,
  onDirectComplete,
  onRecordOutcome,
  onAcknowledge,
  onReview,
  onClose,
  busy,
}: {
  row: any;
  onOpenMessage: (row: any) => void;
  onDirectComplete: () => void;
  onRecordOutcome: () => void;
  onAcknowledge: () => void;
  onReview: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const status = row.dispatch?.status as string | undefined;
  if (!status && row.assignment.status === "completed")
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700"
      >
        Completed directly
      </Badge>
    );
  if (!status)
    return (
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onDirectComplete}
        >
          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
          Complete myself
        </Button>
        <Button
          size="sm"
          disabled={busy}
          className="bg-teal-700 hover:bg-teal-800"
          onClick={() => onOpenMessage(row)}
        >
          <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
          Prepare message
        </Button>
      </div>
    );
  if (["prepared", "copied"].includes(status))
    return (
      <Button
        size="sm"
        disabled={busy}
        className="bg-teal-700 hover:bg-teal-800"
        onClick={() => onOpenMessage(row)}
      >
        Confirm manual send
      </Button>
    );
  if (status === "sent")
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onOpenMessage(row)}>
          Message
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onAcknowledge}
        >
          Acknowledge
        </Button>
        <Button size="sm" variant="outline" onClick={onRecordOutcome}>
          EOD reply
        </Button>
      </div>
    );
  if (status === "acknowledged")
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onOpenMessage(row)}>
          Message
        </Button>
        <Button size="sm" variant="outline" onClick={onRecordOutcome}>
          EOD reply
        </Button>
      </div>
    );
  if (["completed", "pending", "no_reply", "excused"].includes(status))
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onOpenMessage(row)}>
          Message
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onReview}>
          Review
        </Button>
      </div>
    );
  if (status === "reviewed")
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onOpenMessage(row)}>
          Message
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onClose}>
          Close task
        </Button>
      </div>
    );
  return (
    <Button size="sm" variant="ghost" onClick={() => onOpenMessage(row)}>
      View timeline
    </Button>
  );
}

function CadenceCard({
  cadence,
}: {
  cadence: {
    frequency: "daily" | "weekly" | "monthly";
    scheduledPlanCount: number;
    dueTodayCount: number;
    scheduledPlans: Array<{
      taskId: number;
      taskName: string;
      departmentName: string;
      dueTime: string;
      recurrenceRule: string | null;
    }>;
  };
}) {
  const tone =
    cadence.frequency === "monthly"
      ? "border-violet-200 bg-violet-50/70"
      : cadence.frequency === "weekly"
        ? "border-sky-200 bg-sky-50/70"
        : "border-teal-200 bg-teal-50/70";
  const iconTone =
    cadence.frequency === "monthly"
      ? "bg-violet-100 text-violet-700"
      : cadence.frequency === "weekly"
        ? "bg-sky-100 text-sky-700"
        : "bg-teal-100 text-teal-700";
  const label = cadenceLabel(cadence.frequency);
  return (
    <Card className={tone}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-slate-900">
              {label} tasks
            </CardTitle>
            <CardDescription className="mt-1">
              {cadence.scheduledPlanCount} active{" "}
              {cadence.scheduledPlanCount === 1 ? "plan" : "plans"} ·{" "}
              {cadence.dueTodayCount} due today
            </CardDescription>
          </div>
          <div className={`rounded-xl p-2.5 ${iconTone}`}>
            <CalendarClock className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 border-t border-slate-200/80 pt-3">
          {cadence.scheduledPlans.slice(0, 3).map(plan => (
            <div key={plan.taskId} className="rounded-lg bg-white/80 px-3 py-2">
              <p className="line-clamp-1 text-sm font-medium text-slate-800">
                {plan.taskName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {plan.departmentName} · {plan.dueTime}
                {plan.recurrenceRule?.startsWith("weekly:")
                  ? ` · ${plan.recurrenceRule.split(":")[1]}`
                  : ""}
              </p>
            </div>
          ))}
          {cadence.scheduledPlans.length === 0 && (
            <p className="rounded-lg bg-white/70 p-3 text-sm text-slate-500">
              No {label.toLowerCase()} task plan is created yet.
            </p>
          )}
          {cadence.scheduledPlans.length > 3 && (
            <p className="text-xs font-medium text-slate-600">
              +{cadence.scheduledPlans.length - 3} more plans in Task schedules
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
