"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LedgerMark } from "./ui/LedgerMark";
import { ToastProvider } from "./ui/Toast";
import { logout } from "@/lib/actions/auth";

type Destination = { href: string; label: string; icon: React.ReactNode };

function IconToday() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 8v8M8 12h8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLedger() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={4 + c * 5.6}
            y={4 + r * 5.6}
            width={4.2}
            height={4.2}
            rx={1}
            fill="currentColor"
            opacity={r === 2 || (r === 1 && c < 2) ? 1 : 0.35}
          />
        )),
      )}
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Three destinations, per the brief. Masjid logging lives on Today because it
 * is today's activity; /masjid is a detail screen reached from that section,
 * the same way the ledger grid links through to the full ledger.
 */
const DESTINATIONS: Destination[] = [
  { href: "/", label: "Today", icon: <IconToday /> },
  { href: "/ledger", label: "Ledger", icon: <IconLedger /> },
  { href: "/settings", label: "Settings", icon: <IconSettings /> },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({
  username,
  theme,
  children,
}: {
  username: string;
  theme: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // The server row is the source of truth; mirror it locally so the pre-paint
  // script in the document head can apply it on the next visit without a flash.
  useEffect(() => {
    try {
      localStorage.setItem("qada-theme", theme);
      if (theme === "dark" || theme === "light") {
        document.documentElement.setAttribute("data-theme", theme);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    } catch {
      /* storage unavailable — the media query still gives a sane default */
    }
  }, [theme]);

  return (
    <ToastProvider>
      <div className="lg:flex">
        <DesktopSidebar pathname={pathname} username={username} />

        <div className="min-w-0 flex-1">
          <MobileHeader username={username} />
          <div className="pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:pb-10">
            {children}
          </div>
        </div>
      </div>

      <TabBar pathname={pathname} />
    </ToastProvider>
  );
}

function MobileHeader({ username }: { username: string }) {
  return (
    <header className="flex items-center justify-between px-4 pt-5 pb-1 lg:hidden">
      <Link href="/" className="flex items-center gap-2.5 rounded-md">
        <LedgerMark size={22} />
        <span className="display text-name text-ink">Qada Tracker</span>
      </Link>
      <AccountMenu username={username} />
    </header>
  );
}

function AccountMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const initial = username.slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${username}`}
        className="grid size-11 place-items-center rounded-full border border-line bg-surface text-body font-semibold text-ink-2"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-md border border-line bg-surface shadow-[var(--elev-float)]"
        >
          <p className="border-b border-line px-4 py-3 text-meta text-ink-3">
            Signed in as <span className="text-ink">{username}</span>
          </p>
          <Link
            href="/settings"
            role="menuitem"
            className="block px-4 py-3 text-body text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            Settings
          </Link>
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="w-full px-4 py-3 text-left text-body text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function DesktopSidebar({
  pathname,
  username,
}: {
  pathname: string;
  username: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 rounded-md px-3">
        <LedgerMark size={24} />
        <span className="display text-name text-ink">Qada Tracker</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {DESTINATIONS.map((destination) => {
          const active = isActive(pathname, destination.href);
          return (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-body transition-colors ${
                active
                  ? "bg-brand-wash font-semibold text-brand"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {destination.icon}
              {destination.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line pt-4">
        <p className="px-3 text-meta text-ink-3">
          Signed in as <span className="text-ink-2">{username}</span>
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="mt-2 flex min-h-11 w-full items-center rounded-md px-3 text-body text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch gap-1 rounded-full border border-line bg-surface/85 p-1.5 shadow-[var(--elev-float)] backdrop-blur-xl">
        {DESTINATIONS.map((destination) => {
          const active = isActive(pathname, destination.href);
          return (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${
                active ? "bg-brand-wash text-brand" : "text-ink-3"
              }`}
            >
              {destination.icon}
              <span className="text-[0.6875rem] font-medium">{destination.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
