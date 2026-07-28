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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-xl">
            🕌
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          {children}
        </div>

        {footer ? (
          <div className="mt-6 text-center text-sm text-muted">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25";

export const labelClass = "mb-1.5 block text-sm font-medium";

export const primaryButtonClass =
  "w-full rounded-xl bg-accent px-4 py-3 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60";
