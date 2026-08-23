import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DialogTrigger,
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
import { AlertTriangle, Plus, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const riskCategories = [
  "Patient safety",
  "Medication",
  "Staffing",
  "Equipment",
  "Infection prevention",
  "Facility",
  "Supply chain",
  "Documentation",
  "IT",
  "Financial",
  "Other",
];
const statusTone = (status: string) =>
  ["resolved", "closed"].includes(status)
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "accepted"
      ? "border-slate-200 bg-slate-50 text-slate-600"
      : "border-amber-200 bg-amber-50 text-amber-800";
const severityTone = (severity: string) =>
  severity === "critical"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : severity === "high"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : severity === "medium"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

export default function RiskRegister() {
  const risks = trpc.operations.risks.useQuery();
  const modules = trpc.operations.modules.useQuery();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: "",
    category: "Patient safety",
    departmentId: "",
    likelihood: "3",
    impact: "3",
    mitigationPlan: "",
    reviewDate: "",
  });
  const create = trpc.operations.riskCreate.useMutation({
    onSuccess: result => {
      toast.success(`Risk recorded as ${result.severity}.`);
      setOpen(false);
      setForm({
        description: "",
        category: "Patient safety",
        departmentId: "",
        likelihood: "3",
        impact: "3",
        mitigationPlan: "",
        reviewDate: "",
      });
      utils.operations.risks.invalidate();
      utils.operations.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.operations.riskUpdate.useMutation({
    onSuccess: () => {
      toast.success("Risk status updated.");
      utils.operations.risks.invalidate();
      utils.operations.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  if (risks.isLoading || modules.isLoading || !risks.data || !modules.data)
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(item => (
          <div
            className="h-28 animate-pulse rounded-2xl bg-slate-100"
            key={item}
          />
        ))}
      </div>
    );
  const openRisks = risks.data.filter(
    row => !["resolved", "closed"].includes(row.risk.status)
  );
  const critical = openRisks.filter(
    row => row.risk.severity === "critical"
  ).length;
  const high = openRisks.filter(row => row.risk.severity === "high").length;
  return (
    <>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
            Operational risk
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Hospital Risk Register
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Log, score, mitigate, and review non-clinical operational risks.
            Risks feed the Control Tower without automatically creating tasks or
            external messages.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-700 hover:bg-teal-800">
              <Plus className="mr-2 h-4 w-4" />
              Add risk
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Record operational risk</DialogTitle>
              <DialogDescription>
                Use a likelihood and impact score from 1 to 5. The application
                calculates the severity; managers decide any follow-up action.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="riskDescription">Risk description</Label>
                <Textarea
                  id="riskDescription"
                  className="mt-2"
                  value={form.description}
                  onChange={event =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Department</Label>
                  <Select
                    value={form.departmentId}
                    onValueChange={value =>
                      setForm({ ...form, departmentId: value })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.data.departments.map(department => (
                        <SelectItem
                          key={department.id}
                          value={String(department.id)}
                        >
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={value =>
                      setForm({ ...form, category: value })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {riskCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Likelihood (1–5)</Label>
                  <Input
                    className="mt-2"
                    type="number"
                    min="1"
                    max="5"
                    value={form.likelihood}
                    onChange={event =>
                      setForm({ ...form, likelihood: event.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Impact (1–5)</Label>
                  <Input
                    className="mt-2"
                    type="number"
                    min="1"
                    max="5"
                    value={form.impact}
                    onChange={event =>
                      setForm({ ...form, impact: event.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="riskMitigation">Mitigation plan</Label>
                <Textarea
                  id="riskMitigation"
                  className="mt-2"
                  value={form.mitigationPlan}
                  onChange={event =>
                    setForm({ ...form, mitigationPlan: event.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="riskReview">Review date</Label>
                <Input
                  id="riskReview"
                  className="mt-2"
                  type="date"
                  value={form.reviewDate}
                  onChange={event =>
                    setForm({ ...form, reviewDate: event.target.value })
                  }
                />
              </div>
              <Button
                disabled={
                  create.isPending ||
                  !form.description.trim() ||
                  !form.departmentId
                }
                onClick={() =>
                  create.mutate({
                    description: form.description.trim(),
                    category: form.category,
                    departmentId: Number(form.departmentId),
                    likelihood: Number(form.likelihood),
                    impact: Number(form.impact),
                    mitigationPlan: form.mitigationPlan || undefined,
                    reviewDate: form.reviewDate
                      ? new Date(`${form.reviewDate}T12:00:00`)
                      : undefined,
                  })
                }
                className="bg-teal-700 hover:bg-teal-800"
              >
                {create.isPending ? "Saving…" : "Record risk"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Open risks"
          value={openRisks.length}
          detail="Active mitigation or review"
        />
        <Metric
          label="Critical risks"
          value={critical}
          detail="Requires management attention"
          danger
        />
        <Metric
          label="High risks"
          value={high}
          detail="Prioritize mitigation action"
          danger
        />
      </div>
      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Risk register</CardTitle>
          <CardDescription>
            Risk score equals likelihood × impact. Use the status control to
            reflect mitigation progress; each update is audited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.data.map(row => (
                  <TableRow key={row.risk.id}>
                    <TableCell className="min-w-64">
                      <p className="font-medium text-slate-800">
                        {row.risk.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.risk.category}
                        {row.risk.mitigationPlan
                          ? ` · ${row.risk.mitigationPlan}`
                          : ""}
                      </p>
                    </TableCell>
                    <TableCell>{row.departmentName}</TableCell>
                    <TableCell>{row.riskScore}/25</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={severityTone(row.risk.severity)}
                      >
                        {row.risk.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.risk.reviewDate ? (
                        <span
                          className={
                            row.reviewOverdue
                              ? "text-rose-700"
                              : "text-slate-600"
                          }
                        >
                          {new Date(row.risk.reviewDate).toLocaleDateString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusTone(row.risk.status)}
                      >
                        {row.risk.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={row.risk.status}
                        onValueChange={value =>
                          update.mutate({
                            riskId: row.risk.id,
                            status: value as any,
                          })
                        }
                      >
                        <SelectTrigger className="ml-auto h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "open",
                            "mitigating",
                            "accepted",
                            "resolved",
                            "closed",
                          ].map(status => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {risks.data.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-28 text-center text-sm text-slate-500"
                    >
                      No risks have been logged. Add an operational risk when a
                      manager needs a tracked mitigation plan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Metric({
  label,
  value,
  detail,
  danger = false,
}: {
  label: string;
  value: number;
  detail: string;
  danger?: boolean;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </div>
          <div
            className={
              danger
                ? "rounded-xl bg-rose-50 p-2.5 text-rose-700"
                : "rounded-xl bg-teal-50 p-2.5 text-teal-700"
            }
          >
            {danger ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <ShieldAlert className="h-5 w-5" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
