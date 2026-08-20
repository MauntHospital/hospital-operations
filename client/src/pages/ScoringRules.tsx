import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Settings2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const roleOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function ScoringRules() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const rules = trpc.operations.scoringRules.useQuery(undefined, { enabled: Boolean(user) });
  const updateRule = trpc.operations.scoringRuleUpdate.useMutation({
    onSuccess: () => {
      toast.success("Priority deduction saved for future end-of-day outcomes.");
      utils.operations.scoringRules.invalidate();
      utils.operations.dashboard.invalidate();
      utils.operations.reports.invalidate();
    },
  });
  const canEdit = ["super_admin", "hospital_admin"].includes(user?.role ?? "");

  if (rules.isLoading || !rules.data) return <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div className="h-40 animate-pulse rounded-2xl bg-slate-100" key={index} />)}</div>;
  const orderedRules = [...rules.data].sort((a, b) => (roleOrder[a.priority] ?? 99) - (roleOrder[b.priority] ?? 99));

  return <><section className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Accountability configuration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Weighted task scoring</h1><p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">Set the point deduction used when a manually distributed WhatsApp task remains pending or receives no reply. Values are displayed as points on the 100-point department scorecard.</p></section><Card className="border-amber-200 bg-amber-50/60 shadow-sm"><CardContent className="flex gap-3 p-4 text-sm text-amber-900"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Applies only to future outcomes.</strong> An excused task needs a recorded reason and does not receive a deduction. Historical point events remain unchanged for meeting traceability.</p></CardContent></Card><div className="mt-6 grid gap-4 lg:grid-cols-2">{orderedRules.map(rule => <Card className="border-slate-200 shadow-sm" key={rule.id}><CardHeader className="flex flex-row items-start justify-between space-y-0"><div><CardTitle className="capitalize">{rule.priority} priority</CardTitle><CardDescription className="mt-1">Deduction when the task is unresolved at end of day.</CardDescription></div><Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">{rule.weightTenths / 10} points</Badge></CardHeader><CardContent><Label htmlFor={`score-${rule.id}`}>Deduction (points)</Label><div className="mt-2 flex gap-2"><Input id={`score-${rule.id}`} type="number" min="0" max="100" step="0.5" defaultValue={rule.weightTenths / 10} disabled={!canEdit} /><Button className="bg-teal-700 hover:bg-teal-800" disabled={!canEdit || updateRule.isPending} onClick={() => { const value = Number((document.getElementById(`score-${rule.id}`) as HTMLInputElement).value); if (!Number.isFinite(value) || value < 0 || value > 100) return toast.error("Enter a deduction between 0 and 100 points."); updateRule.mutate({ ruleId: rule.id, weightTenths: Math.round(value * 10) }); }}><Settings2 className="mr-2 h-4 w-4" />Save</Button></div>{!canEdit && <p className="mt-2 text-xs text-slate-500">Only hospital administrators can change deductions.</p>}</CardContent></Card>)}</div></>;
}
