import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  CalendarClock,
  ClipboardPlus,
  Clock3,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const frequencies = ["daily", "weekly", "monthly"] as const;

function formatRun(value: Date | string) {
  return new Intl.DateTimeFormat("en-NP", {
    timeZone: "Asia/Kathmandu",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export default function DepartmentSchedules() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const schedules = trpc.operations.departmentSchedules.useQuery(undefined, {
    enabled: user?.role === "super_admin",
  });
  const [department, setDepartment] = useState("all");
  const [frequency, setFrequency] = useState("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    dueTime: "17:00",
    gracePeriodMinutes: 30,
    escalationDelayMinutes: 60,
    evidenceRequired: false,
    verificationRequired: false,
    responsibleRole: "",
    responseFields: "",
  });
  const update = trpc.operations.departmentScheduleUpdate.useMutation({
    onSuccess: () => {
      toast.success("Task timing and accountability configuration saved.");
      setEditing(null);
      utils.operations.departmentSchedules.invalidate();
      utils.operations.whatsappTaskRegister.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const rows = useMemo(
    () =>
      (schedules.data ?? []).filter(
        row =>
          (department === "all" || String(row.departmentId) === department) &&
          (frequency === "all" || row.task.frequency === frequency)
      ),
    [schedules.data, department, frequency]
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        frequencies.map(item => [
          item,
          (schedules.data ?? []).filter(row => row.task.frequency === item)
            .length,
        ])
      ),
    [schedules.data]
  );
  const configure = (row: any) => {
    setEditing(row);
    setForm({
      dueTime: row.task.dueTime,
      gracePeriodMinutes: row.task.gracePeriodMinutes,
      escalationDelayMinutes: row.task.escalationDelayMinutes,
      evidenceRequired: row.task.evidenceRequired,
      verificationRequired: row.task.verificationRequired,
      responsibleRole: row.task.responsibleRole ?? "",
      responseFields: Array.isArray(row.task.responseSchema)
        ? row.task.responseSchema.join(", ")
        : "",
    });
  };
  if (user && user.role !== "super_admin") return <AccessRequired />;
  if (schedules.isLoading || !schedules.data) return <LoadingCards />;
  const departments = Array.from(
    new Map(
      schedules.data.map(row => [row.departmentId, row.departmentName])
    ).entries()
  );
  return (
    <>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
            Super-admin planning
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Department task schedules
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Configure hospital-local timing, grace, automatic escalation,
            evidence, verification, and response prompts per task. Housekeeping
            and Housekeeping/Infection Control remain separate departments.
          </p>
        </div>
        <Link href="/department-schedules/new">
          <Button className="bg-teal-700 hover:bg-teal-800">
            <ClipboardPlus className="mr-2 h-4 w-4" />Add WhatsApp task
          </Button>
        </Link>
      </header>
      <Card className="mt-5 border-amber-200 bg-amber-50/70">
        <CardContent className="flex gap-3 p-4 text-sm text-amber-950">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>Configuration required before go-live.</strong> The imported
            CSV did not specify per-task times, so existing 17:00 schedules are
            retained until an administrator explicitly changes each task. All
            times use Asia/Kathmandu (UTC+5:45).
          </p>
        </CardContent>
      </Card>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {frequencies.map(item => (
          <Card key={item} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm font-medium capitalize text-slate-600">
                  {item} schedules
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                  {counts[item]}
                </p>
              </div>
              <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700">
                <CalendarClock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Department task plan</CardTitle>
            <CardDescription>
              Changes affect future scheduling and accountability evaluation;
              historical assignments and audit records are preserved.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map(([id, name]) => (
                  <SelectItem key={id} value={String(id)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {frequencies.map(item => (
                  <SelectItem key={item} value={item} className="capitalize">
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {rows.map(row => (
              <div key={row.task.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-slate-900">{row.task.name}</p><p className="mt-1 text-xs text-slate-500">{row.departmentName} · {row.task.category}</p></div>
                  <Badge variant="outline" className="capitalize">{row.task.frequency}</Badge>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><p>{row.task.dueTime} Asia/Kathmandu</p><p className="mt-1 text-xs text-slate-500">{row.task.gracePeriodMinutes}m grace · {row.task.escalationDelayMinutes}m escalation</p></div>
                <div className="mt-3 flex items-center justify-between gap-3"><div className="flex flex-wrap gap-1">{row.task.evidenceRequired && <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">Evidence</Badge>}{row.task.verificationRequired && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">Verify</Badge>}{!row.task.evidenceRequired && !row.task.verificationRequired && <span className="text-xs text-slate-500">Standard response</span>}</div><Button size="sm" variant="outline" onClick={() => configure(row)}><Settings2 className="mr-1.5 h-3.5 w-3.5" />Configure</Button></div>
              </div>
            ))}
            {!rows.length && <p className="py-8 text-center text-sm text-slate-500">No matching department task schedules.</p>}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[1120px]">
              <TableHeader><TableRow>
                <TableHead>Department</TableHead><TableHead>Task</TableHead>
                <TableHead>Cadence</TableHead><TableHead>Timing / escalation</TableHead>
                <TableHead>Response controls</TableHead><TableHead>Next run</TableHead>
                <TableHead className="text-right">Configure</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.task.id}>
                    <TableCell className="font-medium">{row.departmentName}</TableCell>
                    <TableCell><p className="font-medium">{row.task.name}</p><p className="mt-0.5 text-xs text-slate-500">{row.task.category}</p></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{row.task.frequency}{row.task.recurrenceRule?.startsWith("weekly:") ? ` · ${row.task.recurrenceRule.split(":")[1]}` : ""}</Badge></TableCell>
                    <TableCell className="text-sm text-slate-600"><p>{row.task.dueTime} Asia/Kathmandu</p><p className="mt-1 text-xs">{row.task.gracePeriodMinutes}m grace · {row.task.escalationDelayMinutes}m escalation</p></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{row.task.evidenceRequired && <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">Evidence</Badge>}{row.task.verificationRequired && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">Verify</Badge>}{!row.task.evidenceRequired && !row.task.verificationRequired && <span className="text-sm text-slate-500">Standard response</span>}</div></TableCell>
                    <TableCell className="text-slate-600">{row.nextRunAt ? formatRun(row.nextRunAt) : "One-time assignment"}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => configure(row)}><Settings2 className="mr-1.5 h-3.5 w-3.5" />Configure</Button></TableCell>
                  </TableRow>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">No matching department task schedules.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={Boolean(editing)} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Configure task accountability</DialogTitle><DialogDescription>{editing ? `${editing.departmentName} · ${editing.task.name}` : "Task timing and response requirements."}</DialogDescription></DialogHeader>
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Due time (Asia/Kathmandu)"><Input type="time" value={form.dueTime} onChange={event => setForm(current => ({ ...current, dueTime: event.target.value }))} /></Field>
              <Field label="Responsible role"><Input value={form.responsibleRole} onChange={event => setForm(current => ({ ...current, responsibleRole: event.target.value }))} placeholder="e.g., Department in-charge" /></Field>
              <Field label="Grace period (minutes)"><Input type="number" min={0} max={1440} value={form.gracePeriodMinutes} onChange={event => setForm(current => ({ ...current, gracePeriodMinutes: Number(event.target.value) }))} /></Field>
              <Field label="Escalate after due (minutes)"><Input type="number" min={0} max={10080} value={form.escalationDelayMinutes} onChange={event => setForm(current => ({ ...current, escalationDelayMinutes: Number(event.target.value) }))} /></Field>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <ToggleRow label="Require evidence before review" hint="An image or PDF must be attached before a reply can be submitted for review." checked={form.evidenceRequired} onCheckedChange={value => setForm(current => ({ ...current, evidenceRequired: value }))} />
              <ToggleRow label="Require verification before completion" hint="The manager must accept the reply before final completion." checked={form.verificationRequired} onCheckedChange={value => setForm(current => ({ ...current, verificationRequired: value }))} />
            </div>
            <Field label="Optional response prompts"><Textarea value={form.responseFields} onChange={event => setForm(current => ({ ...current, responseFields: event.target.value }))} placeholder="Comma-separated prompts, e.g. temperature recorded, stock quantity" /><p className="mt-1 text-xs text-slate-500">Prompts guide the manager when transcribing a reply; they never fabricate a department response.</p></Field>
            {form.escalationDelayMinutes < form.gracePeriodMinutes && <p className="text-sm text-rose-700">Escalation must be at or after the grace period.</p>}
            <Button disabled={update.isPending || form.escalationDelayMinutes < form.gracePeriodMinutes} onClick={() => editing && update.mutate({ taskId: editing.task.id, dueTime: form.dueTime, gracePeriodMinutes: form.gracePeriodMinutes, escalationDelayMinutes: form.escalationDelayMinutes, evidenceRequired: form.evidenceRequired, verificationRequired: form.verificationRequired, responsibleRole: form.responsibleRole || undefined, responseFields: form.responseFields.split(",").map(item => item.trim()).filter(Boolean) })} className="bg-teal-700 hover:bg-teal-800">{update.isPending ? "Saving…" : "Save task configuration"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label><div className="mt-2">{children}</div></div>;
}
function ToggleRow({ label, hint, checked, onCheckedChange }: { label: string; hint: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <div className="flex items-start justify-between gap-4"><div><Label>{label}</Label><p className="mt-1 text-xs text-slate-500">{hint}</p></div><Checkbox checked={checked} onCheckedChange={value => onCheckedChange(value === true)} /></div>;
}
function AccessRequired() { return <Card className="mx-auto max-w-xl border-rose-200"><CardContent className="p-6 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-3 text-xl font-semibold text-slate-900">Super-admin access required</h1><p className="mt-2 text-sm text-slate-500">Department task schedules can only be configured by the super administrator.</p></CardContent></Card>; }
function LoadingCards() { return <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map(item => <div className="h-28 animate-pulse rounded-2xl bg-slate-100" key={item} />)}</div>; }
