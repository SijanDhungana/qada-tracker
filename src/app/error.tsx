"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 text-center">
      <h1 className="display text-section text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-2">
        Your checked-off prayers are safe. Try loading the page again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 min-h-12 rounded-md bg-brand px-4 py-3 text-base font-semibold text-done-ink"
      >
        Try again
      </button>

      <p className="mt-8 text-xs text-ink-2">
        If this keeps happening, open{" "}
        <a href="/api/health" className="font-semibold text-brand underline underline-offset-2">
          /api/health
        </a>{" "}
        — it says which setup step is missing.
      </p>

      {/* Matches the digest in the server logs, so a failure can be traced. */}
      {error.digest ? (
        <p className="num mt-2 text-meta text-ink-3">Ref: {error.digest}</p>
      ) : null}
    </main>
  );
}
