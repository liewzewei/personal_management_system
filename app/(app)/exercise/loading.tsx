import { Loader2 } from "lucide-react";

export default function ExerciseLoading() {
  return (
    <div className="flex h-screen flex-col">
      <header className="border-b bg-card px-6 py-4">
        <div className="h-7 w-28 animate-pulse rounded bg-muted" />
      </header>
      <div className="border-b bg-card px-6">
        <div className="flex gap-2 py-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
