import React, { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
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
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  FileText,
  History,
  MessageCircleMore,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  TimerReset,
  Trophy,
  Upload,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

const managers = [
  "super_admin",
  "hospital_admin",
  "department_head",
  "supervisor",
];
const PAGE_SIZE = 12;
const priorityRank: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function formatDue(value: Date | string) {
  return new Intl.DateTimeFormat("en-NP", {
    timeZone: "Asia/Kathmandu",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function cadenceLabel(frequency: string) {
  if (frequency === "monthly") return "Monthly";
  if (frequency === "weekly") return "Weekly";
  return "Daily";
}

function priorityLabel(priority: string) {
  return priority === "medium" ? "Normal" : priority;
}

function statusTone(status: string) {
  if (["completed", "verified", "valid_exception", "manager_completed"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["overdue", "escalated", "rework_required"].includes(status))
    return "border-rose-200 bg-rose-50 text-rose-800";
  if (["under_review", "replied", "replied_again"].includes(status))
    return "border-violet-200 bg-violet-50 text-violet-800";
  if (["cancelled", "rescheduled", "closed"].includes(status))
    return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function statusLabel(status: string) {
  if (status === "scheduled") return "Scheduled";
  if (status === "awaiting_reply") return "Awaiting Reply";
  return status.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
}

async function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The evidence file could not be read."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function WhatsAppTaskRegister() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const search = useSearch();
  const isOverdueView = new URLSearchParams(search).get("scope") === "overdue";
  const register = trpc.operations.whatsappTaskRegister.useQuery(
    { scope: isOverdueView ? "overdue" : "today" },
    { enabled: Boolean(user && managers.includes(user.role)) }
  );
  const [messageDialog, setMessageDialog] = useState<any | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [responseDialog, setResponseDialog] = useState<any | null>(null);
  const [responseStatus, setResponseStatus] = useState<
    "completed" | "partially_completed" | "not_completed" | "unable_to_complete" | "valid_exception"
  >("completed");
  const [responseFields, setResponseFields] = useState({
    findings: "",
    actionTaken: "",
    responsibleStaff: "",
    nonCompletionReason: "",
    additionalNotes: "",
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [decisionDialog, setDecisionDialog] = useState<any | null>(null);
  const [decision, setDecision] = useState<
    "verify" | "rework" | "valid_exception" | "department_failure"
  >("verify");
  const [decisionNote, setDecisionNote] = useState("");
  const [directDialog, setDirectDialog] = useState<any | null>(null);
  const [directNote, setDirectNote] = useState("");
  const [changeDialog, setChangeDialog] = useState<
    { row: any; type: "escalate" | "cancel" | "reschedule" } | null
  >(null);
  const [manageDialog, setManageDialog] = useState<any | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [historyAssignmentId, setHistoryAssignmentId] = useState<number | null>(null);
  const history = trpc.operations.whatsappTaskHistory.useQuery(
    { assignmentId: historyAssignmentId ?? 0 },
    { enabled: Boolean(historyAssignmentId) }
  );
  const [filters, setFilters] = useState({
    search: "",
    department: "all",
    priority: "all",
    status: isOverdueView ? "overdue" : "action_required",
    cadence: "all",
    sort: "priority",
  });
  const [page, setPage] = useState(1);

  const refresh = () => {
    utils.operations.whatsappTaskRegister.invalidate();
    utils.operations.dashboard.invalidate();
    utils.operations.reports.invalidate();
  };
  const prepare = trpc.operations.whatsappTaskPrepare.useMutation({
    onSuccess: result => {
      toast.success(result.alreadyPrepared ? "Message is already prepared." : "Message prepared. Copy or open WhatsApp, then confirm the manual send.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const copied = trpc.operations.whatsappTaskCopied.useMutation({
    onSuccess: () => {
      toast.success("Copy action recorded in the audit timeline.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const opened = trpc.operations.whatsappTaskOpened.useMutation({
    onError: error => toast.error(error.message),
  });
  const dispatch = trpc.operations.whatsappTaskDispatch.useMutation({
    onSuccess: () => {
      toast.success("Manual WhatsApp send confirmed. The task is now awaiting a recorded reply.");
      setMessageDialog(null);
      setSendConfirmed(false);
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const response = trpc.operations.whatsappTaskResponse.useMutation({
    onSuccess: async result => {
      if (evidenceFile && responseDialog?.dispatch?.id) {
        try {
          const base64Data = await fileAsDataUrl(evidenceFile);
          evidence.mutate({
            dispatchId: responseDialog.dispatch.id,
            fileName: evidenceFile.name,
            mimeType: evidenceFile.type,
            base64Data,
          });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Evidence could not be attached.");
        }
      }
      toast.success("Department reply recorded. Submit it for manager review when complete.");
      setResponseDialog(null);
      setEvidenceFile(null);
      setResponseFields({ findings: "", actionTaken: "", responsibleStaff: "", nonCompletionReason: "", additionalNotes: "" });
      refresh();
      return result;
    },
    onError: error => toast.error(error.message),
  });
  const evidence = trpc.operations.whatsappTaskEvidence.useMutation({
    onSuccess: () => {
      toast.success("Evidence attached securely to the response record.");
      utils.operations.whatsappTaskHistory.invalidate();
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const submitReview = trpc.operations.whatsappTaskSubmitReview.useMutation({
    onSuccess: () => {
      toast.success("Response moved to the manager review queue.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const reviewDecision = trpc.operations.whatsappTaskDecision.useMutation({
    onSuccess: result => {
      toast.success(result.pointDeltaTenths ? "Manager decision recorded with the configured department accountability decision." : "Manager decision recorded without a score deduction.");
      setDecisionDialog(null);
      setDecisionNote("");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const verifiedComplete = trpc.operations.whatsappTaskVerifiedComplete.useMutation({
    onSuccess: () => {
      toast.success("Verified department task completed.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const directComplete = trpc.operations.taskManagerDirectComplete.useMutation({
    onSuccess: () => {
      toast.success("Manager completion recorded. No WhatsApp dispatch or department score change was created.");
      setDirectDialog(null);
      setDirectNote("");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const escalate = trpc.operations.whatsappTaskEscalate.useMutation({
    onSuccess: () => {
      toast.success("Task escalation recorded in the timeline.");
      setChangeDialog(null);
      setChangeReason("");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const cancel = trpc.operations.whatsappTaskCancel.useMutation({
    onSuccess: () => {
      toast.success("Task cancelled with no department penalty.");
      setChangeDialog(null);
      setChangeReason("");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const reschedule = trpc.operations.whatsappTaskReschedule.useMutation({
    onSuccess: () => {
      toast.success("Task rescheduled. The original lifecycle remains in the audit history.");
      setChangeDialog(null);
      setChangeReason("");
      setNewDueAt("");
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  const tasks = register.data?.tasks ?? [];
  const departments = useMemo(
    () => Array.from(new Set(tasks.map(row => row.department.name))).sort(),
    [tasks]
  );
  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const visible = tasks.filter(row => {
      const status = row.effectiveStatus as string;
      return (
        (!query || [row.task.name, row.task.category, row.department.name].join(" ").toLowerCase().includes(query)) &&
        (filters.department === "all" || row.department.name === filters.department) &&
        (filters.priority === "all" || row.task.priority === filters.priority) &&
        (filters.cadence === "all" || row.task.frequency === filters.cadence) &&
        (filters.status === "all" ||
          (filters.status === "action_required" ? row.actionRequired : status === filters.status))
      );
    });
    return visible.sort((a, b) => {
      if (filters.sort === "due") return new Date(a.assignment.dueAt).getTime() - new Date(b.assignment.dueAt).getTime();
      if (filters.sort === "department") return a.department.name.localeCompare(b.department.name);
      return (priorityRank[a.task.priority] ?? 9) - (priorityRank[b.task.priority] ?? 9) || new Date(a.assignment.dueAt).getTime() - new Date(b.assignment.dueAt).getTime();
    });
  }, [tasks, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageTasks = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const actionQueue = filtered.filter(row => row.actionRequired).slice(0, 6);
  const busy = prepare.isPending || dispatch.isPending || response.isPending || reviewDecision.isPending || submitReview.isPending || verifiedComplete.isPending || directComplete.isPending || escalate.isPending || cancel.isPending || reschedule.isPending;
  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
    setPage(1);
  };
  const openMessage = (row: any) => {
    setMessageDialog(row);
    setMessageText(row.dispatch?.messageText ?? row.suggestedMessage);
    setSendConfirmed(Boolean(row.dispatch?.sentAt));
    if (!row.dispatch) prepare.mutate({ assignmentId: row.assignment.id, messageText: row.suggestedMessage });
  };
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      toast.success("Message copied. The system has not marked it as sent.");
      if (messageDialog?.dispatch?.id) copied.mutate({ dispatchId: messageDialog.dispatch.id });
    } catch {
      toast.error("Clipboard is unavailable. Copy the message manually before confirming a send.");
    }
  };
  const openWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(messageText)}`, "_blank", "noopener,noreferrer");
    if (messageDialog?.dispatch?.id) opened.mutate({ dispatchId: messageDialog.dispatch.id });
    toast.message("WhatsApp opened in a separate tab. Confirm only after you send the message yourself.");
  };
  const submitChange = () => {
    if (!changeDialog?.row?.dispatch?.id) return;
    if (changeDialog.type === "escalate") escalate.mutate({ dispatchId: changeDialog.row.dispatch.id, reason: changeReason });
    if (changeDialog.type === "cancel") cancel.mutate({ dispatchId: changeDialog.row.dispatch.id, reason: changeReason });
    if (changeDialog.type === "reschedule") {
      if (!newDueAt) return toast.error("Choose a future Asia/Kathmandu deadline.");
      reschedule.mutate({ dispatchId: changeDialog.row.dispatch.id, reason: changeReason, rescheduledDueAt: new Date(newDueAt) });
    }
  };

  if (!user || !managers.includes(user.role)) return <AccessRequired />;
  if (register.isLoading) return <WorkspaceLoading title="Loading WhatsApp command center" description="Retrieving department accountability work and manager actions." />;
  if (register.error || !register.data) return <WorkspaceError title="WhatsApp command center unavailable" description={register.error?.message || "The department accountability workflow could not be retrieved."} onRetry={() => register.refetch()} />;
  const { summary, scorecards, cadenceSummary } = register.data;

  return (
    <>
      <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Manager-led accountability · Asia/Kathmandu</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{isOverdueView ? "Exact overdue assignments — command queue" : "WhatsApp Tasks Command Center"}</h1>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600">Manual WhatsApp only: the system records a send only after your confirmation, and it never claims delivery, read receipt, or a department reply. Score deductions require a manager accountability decision.</p>
        </div>
        {isOverdueView ? <Link href="/whatsapp-tasks"><Button variant="outline"><ChevronLeft className="mr-1 h-4 w-4" />Today’s command center</Button></Link> : <Link href="/department-schedules"><Button variant="outline"><CalendarClock className="mr-2 h-4 w-4" />Configure task timing</Button></Link>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Action required" value={summary.actionRequired} hint="Prepare, reply, review, or resolve" icon={AlertTriangle} tone="rose" onClick={() => setFilter("status", "action_required")} />
        <Metric label="Awaiting reply" value={summary.awaitingReply} hint="Manual send is confirmed" icon={MessageCircleMore} tone="amber" onClick={() => setFilter("status", "awaiting_reply")} />
        <Metric label="Under review" value={summary.underReview} hint="Manager decision needed" icon={ShieldCheck} tone="violet" onClick={() => setFilter("status", "under_review")} />
        <Metric label="Overdue / escalated" value={summary.overdue + summary.escalated} hint="After task-specific grace" icon={TimerReset} tone="rose" onClick={() => setFilter("status", "overdue")} />
        <Metric label="Completed" value={summary.completed} hint="Verified or manager-completed" icon={CheckCircle2} tone="emerald" onClick={() => setFilter("status", "completed")} />
      </div>

      <Card className="mt-6 border-teal-100 bg-gradient-to-br from-white to-teal-50/50 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Manager Action Required</CardTitle><CardDescription>Priority-sorted work that needs your next accountable action. Select a metric or filter to change this queue.</CardDescription></CardHeader>
        <CardContent>
          {actionQueue.length ? <div className="grid gap-3 lg:grid-cols-2">{actionQueue.map(row => <ActionQueueCard key={row.assignment.id} row={row} onAction={() => performPrimaryAction(row, { openMessage, setResponseDialog, submitReview, setDecisionDialog, verifiedComplete, setChangeDialog, setHistoryAssignmentId, busy })} onDirectComplete={() => { setDirectDialog(row); setDirectNote(""); }} onManage={() => setManageDialog(row)} />)}</div> : <EmptyState title="No manager action is waiting" description="All visible tasks are completed, excepted, cancelled, or filtered out. Change filters to review the wider register." />}
        </CardContent>
      </Card>

      {!isOverdueView && <section className="mt-6 grid gap-4 lg:grid-cols-3">{cadenceSummary.map(cadence => <CadenceCard key={cadence.frequency} cadence={cadence} />)}</section>}

      {!isOverdueView && <Card className="mt-6 border-slate-200 shadow-sm"><CardHeader><div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-600" /><div><CardTitle className="text-base">Department accountability scorecard</CardTitle><CardDescription>Monthly scores begin at 100. Deductions occur only after a recorded manager decision.</CardDescription></div></div></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Department</TableHead><TableHead>Score</TableHead><TableHead>Points lost</TableHead><TableHead>Meeting status</TableHead></TableRow></TableHeader><TableBody>{scorecards.map(scorecard => <TableRow key={scorecard.departmentId}><TableCell className="font-medium">{scorecard.departmentName}</TableCell><TableCell className={scorecard.score < 95 ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>{scorecard.score}/100</TableCell><TableCell>{scorecard.pointsLost || "—"}</TableCell><TableCell><Badge variant="outline" className={scorecard.score < 95 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{scorecard.score < 95 ? "Needs discussion" : "On track"}</Badge></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}

      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-base">Task register</CardTitle><CardDescription>Filter and drill into the lifecycle, while retaining every manager action in the audit timeline.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" value={filters.search} onChange={event => setFilter("search", event.target.value)} placeholder="Search task, category, department" /></div>
            <FilterSelect value={filters.department} onValueChange={value => setFilter("department", value)} placeholder="Department" options={[{ value: "all", label: "All departments" }, ...departments.map(name => ({ value: name, label: name }))]} />
            <FilterSelect value={filters.priority} onValueChange={value => setFilter("priority", value)} placeholder="Priority" options={[{ value: "all", label: "All priorities" }, ...["critical", "high", "medium", "low"].map(value => ({ value, label: priorityLabel(value) }))]} />
            <FilterSelect value={filters.status} onValueChange={value => setFilter("status", value)} placeholder="Lifecycle" options={[{ value: "all", label: "All lifecycle states" }, { value: "action_required", label: "Action required" }, { value: "scheduled", label: "Scheduled" }, { value: "awaiting_reply", label: "Awaiting reply" }, { value: "under_review", label: "Under review" }, { value: "overdue", label: "Overdue" }, { value: "escalated", label: "Escalated" }, { value: "completed", label: "Completed" }]} />
            <FilterSelect value={filters.cadence} onValueChange={value => setFilter("cadence", value)} placeholder="Cadence" options={[{ value: "all", label: "All cadence" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} task{filtered.length === 1 ? "" : "s"}.</p><FilterSelect value={filters.sort} onValueChange={value => setFilter("sort", value)} placeholder="Sort" options={[{ value: "priority", label: "Priority then due" }, { value: "due", label: "Due time" }, { value: "department", label: "Department" }]} /></div>
          <div className="mt-4 space-y-3 md:hidden">{pageTasks.map(row => <MobileTaskCard key={row.assignment.id} row={row} onPrimary={() => performPrimaryAction(row, { openMessage, setResponseDialog, submitReview, setDecisionDialog, verifiedComplete, setChangeDialog, setHistoryAssignmentId, busy })} onHistory={() => setHistoryAssignmentId(row.assignment.id)} onManage={() => setManageDialog(row)} />)}{!pageTasks.length && <EmptyState title="No tasks match these filters" description="Try clearing a lifecycle, department, cadence, or search filter." />}</div>
          <div className="mt-4 hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Priority</TableHead><TableHead>Cadence</TableHead><TableHead>Department</TableHead><TableHead>Due</TableHead><TableHead>Lifecycle</TableHead><TableHead className="text-right">Manager action</TableHead></TableRow></TableHeader><TableBody>{pageTasks.map(row => <TableRow key={row.assignment.id}><TableCell className="min-w-64"><p className="font-medium text-slate-900">{row.task.name}</p><p className="mt-0.5 text-xs text-slate-500">{row.task.category}</p></TableCell><TableCell><PriorityBadge priority={row.task.priority} /></TableCell><TableCell><Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">{cadenceLabel(row.task.frequency)}</Badge></TableCell><TableCell>{row.department.name}</TableCell><TableCell className="whitespace-nowrap text-sm text-slate-600">{formatDue(row.assignment.dueAt)}</TableCell><TableCell><Badge variant="outline" className={statusTone(row.effectiveStatus)}>{statusLabel(row.effectiveStatus)}</Badge></TableCell><TableCell className="min-w-56 text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setHistoryAssignmentId(row.assignment.id)}><History className="mr-1 h-3.5 w-3.5" />History</Button><PrimaryActionButton row={row} busy={busy} onClick={() => performPrimaryAction(row, { openMessage, setResponseDialog, submitReview, setDecisionDialog, verifiedComplete, setChangeDialog, setHistoryAssignmentId, busy })} /></div></TableCell></TableRow>)}{!pageTasks.length && <TableRow><TableCell colSpan={7}><EmptyState title="No tasks match these filters" description="Try clearing a lifecycle, department, cadence, or search filter." /></TableCell></TableRow>}</TableBody></Table></div>
          <div className="mt-4 flex items-center justify-end gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" />Previous</Button><span className="text-sm text-slate-600">Page {page} of {pageCount}</span><Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))}>Next<ChevronRight className="h-4 w-4" /></Button></div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(messageDialog)} onOpenChange={open => !open && setMessageDialog(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Manual WhatsApp message</DialogTitle><DialogDescription>{messageDialog ? `${messageDialog.department.name} · ${messageDialog.task.name}` : "Prepare the task message."}</DialogDescription></DialogHeader><div className="grid gap-4"><Textarea value={messageText} onChange={event => setMessageText(event.target.value)} className="min-h-72 font-mono text-xs leading-relaxed" /><p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Copying or opening WhatsApp does not record delivery. Confirm the manual send only after you have sent it to the correct department group.</p><div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={copyMessage}><ClipboardCopy className="mr-2 h-4 w-4" />Copy message</Button><Button variant="outline" onClick={openWhatsApp}><MessageCircleMore className="mr-2 h-4 w-4" />Open WhatsApp</Button></div><label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm"><Checkbox checked={sendConfirmed} onCheckedChange={value => setSendConfirmed(value === true)} /><span>I personally sent this message to the correct department WhatsApp group.</span></label><Button disabled={!sendConfirmed || dispatch.isPending || !messageDialog} onClick={() => messageDialog && dispatch.mutate({ assignmentId: messageDialog.assignment.id, messageText })} className="bg-teal-700 hover:bg-teal-800"><Send className="mr-2 h-4 w-4" />{dispatch.isPending ? "Recording manual send…" : "Confirm manual send"}</Button></div></DialogContent></Dialog>

      <Dialog open={Boolean(responseDialog)} onOpenChange={open => !open && setResponseDialog(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Record department WhatsApp reply</DialogTitle><DialogDescription>Transcribe the reply received by the manager. Do not invent or infer a department response.</DialogDescription></DialogHeader><div className="grid gap-4"><div><Label>Reported status</Label><Select value={responseStatus} onValueChange={value => setResponseStatus(value as typeof responseStatus)}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="completed">Completed</SelectItem><SelectItem value="partially_completed">Partially completed</SelectItem><SelectItem value="not_completed">Not completed</SelectItem><SelectItem value="unable_to_complete">Unable to complete</SelectItem><SelectItem value="valid_exception">Possible valid exception</SelectItem></SelectContent></Select></div><ResponseField label="Findings / result" value={responseFields.findings} onChange={value => setResponseFields(current => ({ ...current, findings: value }))} /><ResponseField label="Action taken" value={responseFields.actionTaken} onChange={value => setResponseFields(current => ({ ...current, actionTaken: value }))} /><div><Label htmlFor="responsibleStaff">Responsible staff member</Label><Input id="responsibleStaff" className="mt-2" value={responseFields.responsibleStaff} onChange={event => setResponseFields(current => ({ ...current, responsibleStaff: event.target.value }))} /></div>{["not_completed", "unable_to_complete"].includes(responseStatus) && <ResponseField label="Reason for non-completion" required value={responseFields.nonCompletionReason} onChange={value => setResponseFields(current => ({ ...current, nonCompletionReason: value }))} />}<ResponseField label="Manager notes" value={responseFields.additionalNotes} onChange={value => setResponseFields(current => ({ ...current, additionalNotes: value }))} /><div><Label htmlFor="evidence">Optional evidence{responseDialog?.task?.evidenceRequired ? " (required before review)" : ""}</Label><Input id="evidence" className="mt-2" type="file" accept="image/*,application/pdf" onChange={event => setEvidenceFile(event.target.files?.[0] ?? null)} /><p className="mt-1 text-xs text-slate-500">Images or PDFs up to 8 MB are stored securely with the response.</p></div><Button disabled={response.isPending || (["not_completed", "unable_to_complete"].includes(responseStatus) && !responseFields.nonCompletionReason.trim())} onClick={() => responseDialog && response.mutate({ dispatchId: responseDialog.dispatch.id, responseStatus, findings: responseFields.findings || undefined, actionTaken: responseFields.actionTaken || undefined, responsibleStaff: responseFields.responsibleStaff || undefined, nonCompletionReason: responseFields.nonCompletionReason || undefined, additionalNotes: responseFields.additionalNotes || undefined })} className="bg-teal-700 hover:bg-teal-800">{response.isPending ? "Recording reply…" : "Record reply"}</Button></div></DialogContent></Dialog>

      <Dialog open={Boolean(decisionDialog)} onOpenChange={open => !open && setDecisionDialog(null)}><DialogContent><DialogHeader><DialogTitle>Manager review decision</DialogTitle><DialogDescription>Choose the accountable decision after reviewing the documented reply and any required evidence.</DialogDescription></DialogHeader><div className="grid gap-4"><Select value={decision} onValueChange={value => setDecision(value as typeof decision)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="verify">Verify response</SelectItem><SelectItem value="rework">Request rework</SelectItem><SelectItem value="valid_exception">Accept valid exception — no penalty</SelectItem><SelectItem value="department_failure">Department failure — apply configured decision</SelectItem></SelectContent></Select><ResponseField label="Decision note" required value={decisionNote} onChange={setDecisionNote} /><p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">A score change is created only for a confirmed department-failure decision. Manager completion, valid exceptions, cancellations, and reschedules do not deduct points.</p><Button disabled={!decisionNote.trim() || reviewDecision.isPending} onClick={() => decisionDialog && reviewDecision.mutate({ dispatchId: decisionDialog.dispatch.id, decision, note: decisionNote })} className="bg-teal-700 hover:bg-teal-800">{reviewDecision.isPending ? "Saving decision…" : "Save manager decision"}</Button></div></DialogContent></Dialog>

      <Dialog open={Boolean(directDialog)} onOpenChange={open => !open && setDirectDialog(null)}><DialogContent><DialogHeader><DialogTitle>Complete task yourself</DialogTitle><DialogDescription>Direct manager work creates no WhatsApp dispatch and no department score effect.</DialogDescription></DialogHeader><div className="grid gap-4"><ResponseField label="Manager completion note" value={directNote} onChange={setDirectNote} /><Button disabled={directComplete.isPending} onClick={() => directDialog && directComplete.mutate({ assignmentId: directDialog.assignment.id, notes: directNote || undefined })} className="bg-teal-700 hover:bg-teal-800"><UserCheck className="mr-2 h-4 w-4" />Confirm manager completion</Button></div></DialogContent></Dialog>

      <Dialog open={Boolean(manageDialog)} onOpenChange={open => !open && setManageDialog(null)}><DialogContent><DialogHeader><DialogTitle>Manage task lifecycle</DialogTitle><DialogDescription>{manageDialog ? `${manageDialog.task.name} · ${manageDialog.department.name}` : "Choose an accountable manager action."}</DialogDescription></DialogHeader><div className="grid gap-3"><p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Each action requires a reason and remains in the immutable timeline. Cancellation and rescheduling do not deduct department points.</p><Button variant="outline" onClick={() => { setChangeDialog({ row: manageDialog, type: "escalate" }); setManageDialog(null); }}>Escalate task</Button><Button variant="outline" onClick={() => { setChangeDialog({ row: manageDialog, type: "reschedule" }); setManageDialog(null); }}>Reschedule task</Button><Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => { setChangeDialog({ row: manageDialog, type: "cancel" }); setManageDialog(null); }}>Cancel task</Button></div></DialogContent></Dialog>

      <Dialog open={Boolean(changeDialog)} onOpenChange={open => !open && setChangeDialog(null)}><DialogContent><DialogHeader><DialogTitle>{changeDialog?.type === "escalate" ? "Escalate task" : changeDialog?.type === "cancel" ? "Cancel task" : "Reschedule task"}</DialogTitle><DialogDescription>The original task record remains in the immutable audit history.</DialogDescription></DialogHeader><div className="grid gap-4">{changeDialog?.type === "reschedule" && <div><Label htmlFor="newDue">New due date and time</Label><Input id="newDue" className="mt-2" type="datetime-local" value={newDueAt} onChange={event => setNewDueAt(event.target.value)} /></div>}<ResponseField label={changeDialog?.type === "cancel" ? "Cancellation reason" : changeDialog?.type === "reschedule" ? "Reschedule reason" : "Escalation reason"} required value={changeReason} onChange={setChangeReason} /><Button disabled={!changeReason.trim() || busy} onClick={submitChange} className="bg-teal-700 hover:bg-teal-800">Confirm {changeDialog?.type}</Button></div></DialogContent></Dialog>

      <Dialog open={Boolean(historyAssignmentId)} onOpenChange={open => !open && setHistoryAssignmentId(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Task timeline and audit history</DialogTitle><DialogDescription>Append-only lifecycle events, recorded responses, evidence, escalations, and reschedules.</DialogDescription></DialogHeader>{history.isLoading ? <p className="py-8 text-sm text-slate-500">Loading timeline…</p> : history.error ? <p className="py-8 text-sm text-rose-700">{history.error.message}</p> : <div className="space-y-4"><div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">{history.data?.context.task.name}</p><p className="mt-1 text-slate-600">{history.data?.context.department.name} · Due {history.data && formatDue(history.data.context.assignment.dueAt)}</p></div><TimelineSection title="Lifecycle events" items={history.data?.events.map(event => ({ id: event.id, title: statusLabel(event.eventType), note: event.note, at: event.createdAt })) ?? []} /><TimelineSection title="Recorded responses" items={history.data?.responses.map(item => ({ id: item.id, title: `${statusLabel(item.responseStatus)} · version ${item.version}`, note: item.additionalNotes || item.findings || item.nonCompletionReason, at: item.submittedAt })) ?? []} /><TimelineSection title="Evidence" items={history.data?.evidence.map(item => ({ id: item.id, title: item.fileName, note: item.url, at: item.createdAt })) ?? []} /><TimelineSection title="Escalations" items={history.data?.escalations.map(item => ({ id: item.id, title: item.escalationLevel, note: item.reason, at: item.createdAt })) ?? []} /></div>}</DialogContent></Dialog>
    </>
  );
}

function performPrimaryAction(row: any, actions: any) {
  const status = row.effectiveStatus as string;
  if (!row.dispatch && row.assignment.status !== "completed") return actions.openMessage(row);
  if (["prepared", "copied"].includes(status)) return actions.openMessage(row);
  if (["awaiting_reply", "sent", "acknowledged", "overdue", "escalated", "rework_required"].includes(status)) return actions.setResponseDialog(row);
  if (["replied", "replied_again"].includes(status)) return actions.submitReview.mutate({ dispatchId: row.dispatch.id });
  if (status === "under_review") return actions.setDecisionDialog(row);
  if (status === "verified") return actions.verifiedComplete.mutate({ dispatchId: row.dispatch.id });
  return actions.setHistoryAssignmentId(row.assignment.id);
}

function PrimaryActionButton({ row, onClick, busy }: { row: any; onClick: () => void; busy: boolean }) {
  const status = row.effectiveStatus as string;
  const label = !row.dispatch ? "Prepare message" : ["prepared", "copied"].includes(status) ? "Confirm send" : ["awaiting_reply", "sent", "acknowledged", "overdue", "escalated", "rework_required"].includes(status) ? "Record reply" : ["replied", "replied_again"].includes(status) ? "Submit review" : status === "under_review" ? "Review" : status === "verified" ? "Complete" : "View history";
  return <Button size="sm" disabled={busy} onClick={onClick} className={status === "overdue" || status === "escalated" ? "bg-rose-700 hover:bg-rose-800" : "bg-teal-700 hover:bg-teal-800"}>{label}</Button>;
}

function ActionQueueCard({ row, onAction, onDirectComplete, onManage }: { row: any; onAction: () => void; onDirectComplete: () => void; onManage: () => void }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{row.task.name}</p><p className="mt-1 text-sm text-slate-500">{row.department.name} · Due {formatDue(row.assignment.dueAt)}</p></div><PriorityBadge priority={row.task.priority} /></div><div className="mt-3 flex items-center justify-between gap-3"><Badge variant="outline" className={statusTone(row.effectiveStatus)}>{statusLabel(row.effectiveStatus)}</Badge><div className="flex gap-2">{!row.dispatch && <Button size="sm" variant="outline" onClick={onDirectComplete}><UserCheck className="mr-1 h-3.5 w-3.5" />Complete myself</Button>}{row.dispatch && <Button size="sm" variant="outline" onClick={onManage}>Manage</Button>}<PrimaryActionButton row={row} onClick={onAction} busy={false} /></div></div></div>;
}

function MobileTaskCard({ row, onPrimary, onHistory, onManage }: { row: any; onPrimary: () => void; onHistory: () => void; onManage: () => void }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{row.task.name}</p><p className="mt-1 text-xs text-slate-500">{row.department.name} · {cadenceLabel(row.task.frequency)} · {formatDue(row.assignment.dueAt)}</p></div><PriorityBadge priority={row.task.priority} /></div><div className="mt-3 flex items-center justify-between gap-2"><Badge variant="outline" className={statusTone(row.effectiveStatus)}>{statusLabel(row.effectiveStatus)}</Badge><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={onHistory}><History className="h-4 w-4" /></Button>{row.dispatch && <Button size="sm" variant="outline" onClick={onManage}>Manage</Button>}<PrimaryActionButton row={row} onClick={onPrimary} busy={false} /></div></div></div>;
}

function Metric({ label, value, hint, icon: Icon, tone, onClick }: { label: string; value: number; hint: string; icon: typeof Send; tone: "rose" | "amber" | "violet" | "emerald"; onClick: () => void }) {
  const colors = { rose: "bg-rose-50 text-rose-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700", emerald: "bg-emerald-50 text-emerald-700" };
  return <button type="button" onClick={onClick} className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><Card className="h-full border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div><div className={`rounded-xl p-2.5 ${colors[tone]}`}><Icon className="h-5 w-5" /></div></div></CardContent></Card></button>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone = priority === "critical" ? "border-rose-200 bg-rose-50 text-rose-700" : priority === "high" ? "border-amber-200 bg-amber-50 text-amber-800" : priority === "medium" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-700";
  return <Badge variant="outline" className={tone}>{priorityLabel(priority)}</Badge>;
}

function FilterSelect({ value, onValueChange, placeholder, options }: { value: string; onValueChange: (value: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return <Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

function ResponseField({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <div><Label>{label}{required ? " *" : ""}</Label><Textarea className="mt-2" value={value} onChange={event => onChange(event.target.value)} /></div>;
}

function CadenceCard({ cadence }: { cadence: any }) {
  return <Card className="border-slate-200 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{cadenceLabel(cadence.frequency)} tasks</CardTitle><CardDescription>{cadence.dueTodayCount} due in this view · {cadence.scheduledPlanCount} active plan{cadence.scheduledPlanCount === 1 ? "" : "s"}</CardDescription></CardHeader><CardContent><div className="max-h-72 space-y-2 overflow-y-auto pr-1 [scrollbar-gutter:stable]" aria-label={`${cadenceLabel(cadence.frequency)} task plan. Scroll to view all active tasks.`}>{cadence.scheduledPlans.map((task: any) => <div key={task.taskId} className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-sm font-medium text-slate-800">{task.taskName}</p><p className="mt-0.5 text-xs text-slate-500">{task.departmentName} · {task.dueTime} Asia/Kathmandu</p></div>)}</div></CardContent></Card>;
}

function TimelineSection({ title, items }: { title: string; items: { id: number; title: string; note?: string | null; at: Date | string }[] }) {
  if (!items.length) return null;
  return <section><h3 className="text-sm font-semibold text-slate-900">{title}</h3><div className="mt-2 space-y-2">{items.map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-slate-800">{item.title}</p><p className="text-xs text-slate-500">{formatDue(item.at)}</p></div>{item.note && <p className="mt-1 text-sm text-slate-600 break-words">{item.note}</p>}</div>)}</div></section>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><FileText className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 font-medium text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-500">{description}</p></div>;
}

function AccessRequired() {
  return <Card className="mx-auto max-w-xl border-rose-200"><CardContent className="p-6 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-3 text-xl font-semibold text-slate-900">Manager access required</h1><p className="mt-2 text-sm text-slate-500">Only operational managers can record manual WhatsApp accountability activity.</p></CardContent></Card>;
}
