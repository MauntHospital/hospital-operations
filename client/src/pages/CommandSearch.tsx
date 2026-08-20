import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Search } from "lucide-react";
import React, { useMemo, useState } from "react";

export default function CommandSearch() {
  const [term, setTerm] = useState("");
  const modules = trpc.operations.modules.useQuery();
  const risks = trpc.operations.risks.useQuery();
  const actions = trpc.operations.managementActions.useQuery();
  const rows = useMemo(() => {
    const query = term.trim().toLowerCase();
    const all = [
      ...(modules.data?.equipment ?? []).map(row => ({ type: "Equipment", title: row.equipment.name, detail: `${row.departmentName} · ${row.equipment.status}` })),
      ...(modules.data?.inventory ?? []).map(row => ({ type: "Inventory", title: row.inventory.name, detail: `${row.departmentName} · ${row.inventory.quantity} ${row.inventory.unit}` })),
      ...(modules.data?.expiry ?? []).map(row => ({ type: "Expiry", title: row.expiry.name, detail: `${row.departmentName} · ${row.health.replaceAll("_", " ")}` })),
      ...(risks.data ?? []).map(row => ({ type: "Risk", title: row.risk.description, detail: `${row.departmentName} · ${row.risk.severity}` })),
      ...(actions.data ?? []).map(row => ({ type: "Management action", title: row.action.title, detail: `${row.departmentName} · ${row.effectiveStatus}` })),
    ];
    return query ? all.filter(row => `${row.type} ${row.title} ${row.detail}`.toLowerCase().includes(query)).slice(0, 50) : all.slice(0, 50);
  }, [actions.data, modules.data, risks.data, term]);
  if (modules.isLoading || risks.isLoading || actions.isLoading) return <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div className="h-32 animate-pulse rounded-2xl bg-slate-100" key={i} />)}</div>;
  return <><section className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Command-center discovery</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Cross-module search</h1><p className="mt-1 text-sm text-slate-500">Search operational equipment, inventory, expiry monitoring, risks, and management actions in one manager workspace.</p></section><div className="relative"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><Input value={term} onChange={event => setTerm(event.target.value)} className="h-11 pl-10" placeholder="Search by item, department, status, risk, or action" /></div><div className="mt-5 grid gap-3">{rows.map((row, index) => <Card className="border-slate-200 shadow-sm" key={`${row.type}-${row.title}-${index}`}><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">{row.type}</p><CardTitle className="mt-1 text-base">{row.title}</CardTitle><CardDescription className="mt-1 capitalize">{row.detail}</CardDescription></div></CardContent></Card>)}{!rows.length && <Card><CardContent className="p-8 text-center text-sm text-slate-500">No records match this search.</CardContent></Card>}</div></>;
}
