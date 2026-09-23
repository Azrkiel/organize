// Next's file convention: shown automatically while a page under the app shell is loading
// (PLAN.md Phase 8 task 5). Generic on purpose — it covers every route in this group.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
      <div className="space-y-2">
        <div className="h-14 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-14 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-14 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
