import { Loader2 } from "lucide-react";

export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b bg-background/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="h-7 w-28 animate-pulse rounded bg-muted" />
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
