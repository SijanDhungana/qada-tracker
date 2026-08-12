"use client";

/** A radiogroup styled as a segmented track — Grid/List, theme, add-days mode. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full gap-1 rounded-md bg-surface-2 p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-sm px-3 font-medium transition-colors ${
              size === "sm" ? "py-2 text-meta" : "min-h-11 py-2.5 text-body"
            } ${
              selected
                ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
