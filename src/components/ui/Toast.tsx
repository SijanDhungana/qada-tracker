"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastAction = { label: string; run: () => void | Promise<void> };

type ToastInput = {
  message: string;
  action?: ToastAction;
  /** Repeat toasts with the same key coalesce into one with a count. */
  coalesceKey?: string;
  tone?: "neutral" | "danger";
};

type ActiveToast = ToastInput & { id: number; repeats: number };

const DURATION_MS = 6000;

const ToastContext = createContext<(input: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/**
 * One toast at a time, six seconds, with an undo action. A rapid sequence of
 * the same kind of write collapses into a single toast carrying a count rather
 * than stacking — logging five prayers quickly should not produce five toasts.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const push = useCallback((input: ToastInput) => {
    setToast((current) => {
      const coalesces =
        current && input.coalesceKey && current.coalesceKey === input.coalesceKey;
      return {
        ...input,
        id: coalesces ? current.id : nextId.current++,
        repeats: coalesces ? current.repeats + 1 : 1,
      };
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-6"
        aria-live="polite"
        role="status"
      >
        {toast ? (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-[var(--elev-float)]"
            style={{ animation: "toast-in var(--base) var(--ease)" }}
          >
            <p
              className={`flex-1 text-meta ${
                toast.tone === "danger" ? "text-danger" : "text-ink-2"
              }`}
            >
              {toast.repeats > 1 ? (
                <>
                  <span className="num text-ink">{toast.repeats}</span> ·{" "}
                </>
              ) : null}
              {toast.message}
            </p>

            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  void toast.action?.run();
                  dismiss();
                }}
                className="shrink-0 rounded-sm px-2 py-1 text-meta font-semibold text-brand hover:bg-brand-wash"
              >
                {toast.action.label}
              </button>
            ) : null}

            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded-sm px-1 text-ink-3 hover:text-ink"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>

      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </ToastContext.Provider>
  );
}
