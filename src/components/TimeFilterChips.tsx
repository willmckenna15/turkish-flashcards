import { timeFilterOptions } from "../lib/statsFilter";
import type { StatsTimeFilter } from "../types";

interface TimeFilterChipsProps {
  value: StatsTimeFilter;
  onChange: (value: StatsTimeFilter) => void;
  // Defaults to every window; pass a subset to hide some.
  options?: StatsTimeFilter[];
}

export function TimeFilterChips({ value, onChange, options }: TimeFilterChipsProps) {
  const shown = options
    ? timeFilterOptions.filter((opt) => options.includes(opt.value))
    : timeFilterOptions;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            value === opt.value
              ? "bg-red-700 text-white shadow-sm shadow-red-900/20"
              : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
