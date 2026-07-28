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
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        Your checked-off prayers are safe. Try loading the page again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-accent px-4 py-3 text-base font-semibold text-white"
      >
        Try again
      </button>

      <p className="mt-8 text-xs text-muted">
        If this keeps happening, open{" "}
        <a href="/api/health" className="font-semibold underline underline-offset-2">
          /api/health
        </a>{" "}
        — it says which setup step is missing.
      </p>

      {/* Matches the digest in the server logs, so a failure can be traced. */}
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted">Ref: {error.digest}</p>
      ) : null}
    </main>
  );
}
