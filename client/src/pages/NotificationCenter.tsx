import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bell } from "lucide-react";
import React from "react";

export default function NotificationCenter() {
  const dashboard = trpc.operations.dashboard.useQuery();
  if (dashboard.isLoading || !dashboard.data) return <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div className="h-32 animate-pulse rounded-2xl bg-slate-100" key={i} />)}</div>;
  return <><section className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Manager notification center</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Operational alerts</h1><p className="mt-1 text-sm text-slate-500">Review the latest system-generated alerts for issues, task escalation, maintenance, expiry, and roster coverage.</p></section><Card><CardHeader><CardTitle className="text-base">Recent alerts</CardTitle><CardDescription>Newest items across hospital operations.</CardDescription></CardHeader><CardContent className="space-y-3">{dashboard.data.notifications.map(item => <div className="flex gap-3 rounded-xl bg-slate-50 p-3.5" key={item.id}><div className="h-8 rounded-lg bg-teal-100 p-2 text-teal-700"><Bell className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.body}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p></div></div>)}{!dashboard.data.notifications.length && <p className="p-6 text-center text-sm text-slate-500">No current operational alerts.</p>}</CardContent></Card></>;
}
