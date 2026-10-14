import type { ReactNode } from "react";
import { useAuth } from "../lib/AuthContext";
import { useWords } from "../lib/WordsContext";

export type Tab = "words" | "vocab" | "grammar" | "stats";

interface LayoutProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

const tabs: { id: Tab; label: string }[] = [
  { id: "words", label: "Words" },
  { id: "vocab", label: "Vocab study" },
  { id: "grammar", label: "Grammar practice" },
  { id: "stats", label: "Vocab stats" },
];

function SyncStatus() {
  const { isOnline, pendingWriteCount, syncBlockedReason } = useWords();

  if (isOnline && pendingWriteCount === 0) return null;

  // A blocked queue isn't slow, it's stuck — saying "Syncing…" forever just
  // leaves you watching a spinner that will never finish.
  const blocked = isOnline && syncBlockedReason !== null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        blocked
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : isOnline
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-neutral-200 bg-neutral-100 text-neutral-500"
      }`}
      title={
        blocked
          ? syncBlockedReason
          : isOnline
            ? `Syncing ${pendingWriteCount} change${pendingWriteCount === 1 ? "" : "s"}…`
            : "Offline — changes are saved on this device and will sync once you're back online."
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          blocked ? "bg-rose-500" : isOnline ? "bg-amber-500" : "bg-neutral-400"
        }`}
      />
      {blocked
        ? `${pendingWriteCount} can't sync`
        : isOnline
          ? `Syncing ${pendingWriteCount}…`
          : pendingWriteCount > 0
            ? `Offline · ${pendingWriteCount} pending`
            : "Offline"}
    </span>
  );
}

export function Layout({ tab, onTabChange, children }: LayoutProps) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200/80 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-700 text-sm font-semibold text-white shadow-sm shadow-red-900/20">
                T
              </span>
              <h1 className="text-base font-semibold tracking-tight text-neutral-900">Türkçe</h1>
              <SyncStatus />
            </div>
            <button
              type="button"
              onClick={signOut}
              className="text-sm text-neutral-400 transition hover:text-neutral-700 sm:hidden"
            >
              Sign out
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <nav className="flex flex-wrap gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabChange(t.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    tab === t.id
                      ? "bg-red-700 text-white shadow-sm shadow-red-900/20"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={signOut}
              className="hidden shrink-0 text-sm text-neutral-400 transition hover:text-neutral-700 sm:block"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
