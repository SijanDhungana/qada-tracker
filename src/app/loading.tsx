export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-5">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-40 rounded-md bg-surface-2" />
        <div className="h-28 rounded-md bg-surface-2" />
        <div className="h-12 rounded-md bg-surface-2" />
        <div className="h-32 rounded-md bg-surface-2" />
        <div className="h-32 rounded-md bg-surface-2" />
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  );
}
