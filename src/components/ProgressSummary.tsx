export function ProgressSummary({
  completedPrayers,
  totalPrayers,
  remainingDays,
  totalDays,
}: {
  completedPrayers: number;
  totalPrayers: number;
  remainingDays: number;
  totalDays: number;
}) {
  const percent =
    totalPrayers === 0 ? 0 : Math.round((completedPrayers / totalPrayers) * 100);

  return (
    <section
      aria-label="Your progress"
      className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-lg font-semibold tabular-nums">
          {completedPrayers.toLocaleString()} / {totalPrayers.toLocaleString()}
          <span className="ml-1.5 text-sm font-normal text-muted">
            prayers completed
          </span>
        </p>
        <p className="text-lg font-semibold tabular-nums text-accent">{percent}%</p>
      </div>

      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-accent-soft"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percent}% of prayers completed`}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          // Show a sliver as soon as anything is done, so early progress on a
          // very long list doesn't look like no progress at all.
          style={{
            width: `${completedPrayers > 0 ? Math.max(percent, 2) : 0}%`,
          }}
        />
      </div>

      <p className="mt-3 text-sm text-muted">
        {remainingDays === 0
          ? `All ${totalDays.toLocaleString()} days complete.`
          : `${remainingDays.toLocaleString()} of ${totalDays.toLocaleString()} ${
              totalDays === 1 ? "day" : "days"
            } still to go.`}
      </p>
    </section>
  );
}
