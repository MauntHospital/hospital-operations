import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, PackageSearch, Wrench } from "lucide-react";
import React from "react";
import { toast } from "sonner";

type FollowUpItem = { key: string; sourceType: "inventory" | "expiry" | "equipment"; sourceId: number; title: string; detail: string; urgency: "Critical" | "Attention" };

export default function OperationalFollowUps() {
  const modules = trpc.operations.modules.useQuery();
  const utils = trpc.useUtils();
  const createFollowUp = trpc.operations.operationalFollowUpCreate.useMutation({
    onSuccess: () => {
      toast.success("Linked follow-up task created for manager distribution.");
      utils.operations.dashboard.invalidate();
      utils.operations.modules.invalidate();
      utils.operations.whatsappTaskRegister.invalidate();
    },
  });

  if (modules.isLoading || !modules.data) return <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div className="h-40 animate-pulse rounded-2xl bg-slate-100" key={index} />)}</div>;
  const data = modules.data;
  const equipmentItems: FollowUpItem[] = data.equipment.filter(row => row.equipment.status !== "working").map(row => ({ key: `equipment-${row.equipment.id}`, sourceType: "equipment", sourceId: row.equipment.id, title: row.equipment.name, detail: `${row.departmentName} · ${row.equipment.status.replaceAll("_", " ")}`, urgency: ["out_of_service", "damaged"].includes(row.equipment.status) ? "Critical" : "Attention" }));
  const expiryItems: FollowUpItem[] = data.expiry.filter(row => ["expired", "within_30_days"].includes(row.health)).map(row => ({ key: `expiry-${row.expiry.id}`, sourceType: "expiry", sourceId: row.expiry.id, title: row.expiry.name, detail: `${row.departmentName} · ${row.health.replaceAll("_", " ")}`, urgency: row.health === "expired" ? "Critical" : "Attention" }));
  const inventoryItems: FollowUpItem[] = data.inventory.filter(row => row.lowStock).map(row => ({ key: `inventory-${row.inventory.id}`, sourceType: "inventory", sourceId: row.inventory.id, title: row.inventory.name, detail: `${row.departmentName} · ${row.inventory.quantity} ${row.inventory.unit} available`, urgency: row.inventory.quantity === 0 ? "Critical" : "Attention" }));
  const items = [...equipmentItems, ...expiryItems, ...inventoryItems].sort((a, b) => a.urgency === b.urgency ? a.title.localeCompare(b.title) : a.urgency === "Critical" ? -1 : 1);

  return <><section className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Cross-module workflow</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Operational follow-up queue</h1><p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">Review attention-worthy equipment, inventory, and expiry records. Confirming an item creates a linked high-priority operational task, ready for the manual WhatsApp workflow.</p></section><Card className="border-sky-200 bg-sky-50/60 shadow-sm"><CardContent className="flex gap-3 p-4 text-sm text-sky-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>Follow-up tasks are never created automatically. This queue supports a manager review before an operational responsibility is assigned or distributed.</p></CardContent></Card><div className="mt-6 grid gap-4 lg:grid-cols-2">{items.map(item => <Card className="border-slate-200 shadow-sm" key={item.key}><CardHeader className="flex flex-row items-start justify-between space-y-0"><div><CardTitle className="text-base">{item.title}</CardTitle><CardDescription className="mt-1 capitalize">{item.sourceType} · {item.detail}</CardDescription></div><span className={item.urgency === "Critical" ? "rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700" : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"}>{item.urgency}</span></CardHeader><CardContent><Button disabled={createFollowUp.isPending} onClick={() => createFollowUp.mutate({ sourceType: item.sourceType, sourceId: item.sourceId })} className="bg-teal-700 hover:bg-teal-800">{item.sourceType === "equipment" ? <Wrench className="mr-2 h-4 w-4" /> : <PackageSearch className="mr-2 h-4 w-4" />}Create follow-up task</Button></CardContent></Card>)}{items.length === 0 && <Card className="border-emerald-200 bg-emerald-50/60 lg:col-span-2"><CardContent className="p-8 text-center text-sm text-emerald-800">No equipment, inventory, or expiry records currently require a manager-confirmed follow-up task.</CardContent></Card>}</div></>;
}
