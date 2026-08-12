import { LedgerMark } from "./ui/LedgerMark";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <LedgerMark size={44} className="mx-auto" />
          <h1 className="display mt-5 text-title text-ink">{title}</h1>
          <p className="mt-2 text-body text-ink-2">{subtitle}</p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-6">{children}</div>

        {footer ? (
          <div className="mt-6 text-center text-meta text-ink-3">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-md border border-line bg-surface-2 px-3.5 text-body text-ink " +
  "outline-none placeholder:text-ink-3 transition-colors focus:border-brand";

export const labelClass = "mb-1.5 block text-meta font-medium text-ink-2";

export const primaryButtonClass =
  "min-h-12 w-full rounded-md bg-brand text-body font-semibold text-done-ink " +
  "transition-transform active:scale-[0.99] disabled:opacity-60";

export const errorClass =
  "rounded-md border border-danger/50 bg-danger-wash px-3.5 py-3 text-meta text-ink";
