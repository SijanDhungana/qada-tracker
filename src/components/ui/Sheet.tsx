"use client";

import { useEffect, useRef } from "react";

/**
 * Bottom sheet on mobile, centred dialog on desktop. Uses a native <dialog>
 * so focus trapping, Esc, and inertness come from the platform rather than
 * from hand-rolled key handling.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) dismisses.
        if (event.target === ref.current) onClose();
      }}
      aria-label={title}
      className="m-0 max-h-[92dvh] w-full max-w-lg bg-transparent p-0 backdrop:bg-black/60 sm:m-auto
                 mt-auto open:flex open:flex-col"
    >
      <div
        className="flex max-h-[92dvh] flex-col overflow-hidden rounded-t-xl border border-line bg-surface
                   shadow-[var(--elev-sheet)] sm:rounded-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="display text-section text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-meta text-ink-3">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 grid size-11 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </dialog>
  );
}
