import { Loader2 } from "lucide-react";

export default function DiaryLoading() {
  return (
    <div className="flex h-screen">
      <div className="w-full border-r md:w-[300px] md:shrink-0 p-4 space-y-3">
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="hidden md:flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
