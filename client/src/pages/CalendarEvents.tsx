import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import React, { useMemo, useState } from "react";

export default function CalendarEvents() {
  const calendar = trpc.operations.calendar.useQuery();
  const [filter, setFilter] = useState("all");
  const events = useMemo(() => {
    if (!calendar.data) return [];
    const rows = [
      ...calendar.data.tasks.map(row => ({ ...row, group: "Task" })),
      ...calendar.data.maintenance.map(row => ({
        ...row,
        group: "Maintenance",
      })),
      ...calendar.data.expiry.map(row => ({ ...row, group: "Expiry" })),
      ...calendar.data.duties.map(row => ({ ...row, group: "Duty" })),
      ...calendar.data.risks.map(row => ({
        ...row,
        date: row.date!,
        group: "Risk review",
      })),
      ...calendar.data.managementActions.map(row => ({
        ...row,
        date: row.date!,
        group: "Management action",
      })),
    ];
    return rows
      .filter(row => filter === "all" || row.group === filter)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [calendar.data, filter]);
  if (calendar.isLoading || !calendar.data)
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            className="h-32 animate-pulse rounded-2xl bg-slate-100"
            key={i}
          />
        ))}
      </div>
    );
  return (
    <>
      <section className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
          Hospital-wide schedule
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          Operations calendar
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Filter scheduled operational work, risk reviews, and management-action
          deadlines by activity type.
        </p>
      </section>
      <div className="mb-5 max-w-xs">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              "all",
              "Task",
              "Maintenance",
              "Expiry",
              "Duty",
              "Risk review",
              "Management action",
            ].map(value => (
              <SelectItem value={value} key={value}>
                {value === "all" ? "All activity types" : value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {events.length} scheduled items
          </CardTitle>
          <CardDescription>
            Dates are shown in your local timezone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.map((event, index) => (
            <div
              className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-3"
              key={`${event.group}-${event.id}-${index}`}
            >
              <div>
                <p className="font-medium text-slate-800">{event.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {event.departmentName} ·{" "}
                  {new Date(event.date).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {event.group}
              </Badge>
            </div>
          ))}
          {!events.length && (
            <p className="p-6 text-center text-sm text-slate-500">
              No calendar events match this filter.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
