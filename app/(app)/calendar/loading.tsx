import { Loader2 } from "lucide-react";

export default function CalendarLoading() {
  return (
    <div className="flex h-screen">
      <aside className="w-[240px] shrink-0 border-r bg-card p-4 space-y-4">
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 w-full animate-pulse rounded bg-muted" />
        ))}
      </aside>
      <main className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    </div>
  );
}
