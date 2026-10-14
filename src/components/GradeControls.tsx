import { useState } from "react";

export interface WrongReason {
  value: string;
  label: string;
}

interface GradeControlsProps {
  disabled: boolean;
  wrongReasons?: WrongReason[];
  onCorrect: () => void;
  onWrong: (reason?: string) => void;
}

export function GradeControls({ disabled, wrongReasons, onCorrect, onWrong }: GradeControlsProps) {
  const [pickingReason, setPickingReason] = useState(false);

  if (pickingReason && wrongReasons) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <p className="text-xs font-medium text-neutral-500">What went wrong?</p>
        <div className="flex flex-wrap gap-2">
          {wrongReasons.map((r) => (
            <button
              key={r.value}
              type="button"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100"
              onClick={() => {
                setPickingReason(false);
                onWrong(r.value);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="self-start text-xs text-neutral-400 hover:text-neutral-600"
          onClick={() => setPickingReason(false)}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        disabled={disabled}
        className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        onClick={() => (wrongReasons ? setPickingReason(true) : onWrong())}
      >
        Wrong
      </button>
      <button
        type="button"
        disabled={disabled}
        className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        onClick={onCorrect}
      >
        Right
      </button>
    </div>
  );
}
