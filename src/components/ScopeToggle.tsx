import type { StudyScope } from "../types";

interface ScopeToggleProps {
  scope: StudyScope;
  onChange: (scope: StudyScope) => void;
  missedCount: number;
}

export function ScopeToggle({ scope, onChange, missedCount }: ScopeToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-sm shadow-sm shadow-neutral-900/5">
      <button
        type="button"
        className={`rounded px-3 py-1.5 font-medium transition ${
          scope === "all" ? "bg-red-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-50"
        }`}
        onClick={() => onChange("all")}
      >
        All words
      </button>
      <button
        type="button"
        className={`rounded px-3 py-1.5 font-medium transition ${
          scope === "missed" ? "bg-red-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-50"
        }`}
        onClick={() => onChange("missed")}
      >
        Words I've gotten wrong ({missedCount})
      </button>
    </div>
  );
}
