import { Loader2 } from "lucide-react";

export default function TasksLoading() {
  return (
    <div className="flex h-screen">
      <aside className="w-[220px] shrink-0 border-r bg-card p-4 space-y-2">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
        ))}
      </aside>
      <main className="flex-1 flex flex-col">
        <div className="border-b bg-card px-6 py-4">
          <div className="h-7 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </main>
    </div>
  );
}
