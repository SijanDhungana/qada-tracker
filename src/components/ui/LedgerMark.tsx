/**
 * The app mark: a 3×3 block of ledger cells with three lit, echoing the grid
 * that is the app's signature element. Themeable, crisp at 16px, scalable —
 * everything an emoji isn't.
 */
export function LedgerMark({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => {
          // Lit cells trace a descending diagonal — progress moving through.
          const lit = (row === 0 && col === 0) || (row === 1 && col <= 1) || row === 2;
          return (
            <rect
              key={`${row}-${col}`}
              x={1 + col * 7.7}
              y={1 + row * 7.7}
              width={6.2}
              height={6.2}
              rx={1.6}
              fill={lit ? "var(--done)" : "var(--surface-3)"}
            />
          );
        }),
      )}
    </svg>
  );
}
