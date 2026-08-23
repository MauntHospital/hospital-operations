import { Button } from "@/components/ui/button";
import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";

export function WorkspaceLoading({
  title = "Loading operations workspace",
  description = "Retrieving the latest operational information.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
    >
      <div className="max-w-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-base font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
    </section>
  );
}

export function WorkspaceError({
  title = "This workspace could not be loaded",
  description = "Check your connection and try again. If the problem continues, contact the operations administrator.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <section
      role="alert"
      className="flex min-h-64 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center shadow-sm"
    >
      <div className="max-w-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-base font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {description}
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="mt-5 bg-white">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        )}
      </div>
    </section>
  );
}
