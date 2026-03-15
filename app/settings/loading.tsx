import { Loader2 } from "lucide-react";

export default function SettingsLoading() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    </main>
  );
}
