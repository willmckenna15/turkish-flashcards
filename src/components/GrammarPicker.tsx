import { useState } from "react";
import { grammarConcepts, grammarConceptCategories } from "../data/grammarConcepts";
import type { FrontSide, StudyScope } from "../types";
import { ScopeToggle } from "./ScopeToggle";

interface GrammarPickerProps {
  selectedConceptIds: string[];
  onToggleConcept: (id: string) => void;
  focusConceptIds: string[];
  onToggleFocus: (id: string) => void;
  scope: StudyScope;
  onScopeChange: (scope: StudyScope) => void;
  missedCount: number;
  count: number;
  onCountChange: (count: number) => void;
  knownPercentage: number;
  onKnownPercentageChange: (percentage: number) => void;
  frontSide: FrontSide;
  onFrontSideChange: (side: FrontSide) => void;
  onGenerate: () => void;
  generating: boolean;
  error?: string | null;
  isOnline: boolean;
}

export function GrammarPicker({
  selectedConceptIds,
  onToggleConcept,
  focusConceptIds,
  onToggleFocus,
  scope,
  onScopeChange,
  missedCount,
  count,
  onCountChange,
  knownPercentage,
  onKnownPercentageChange,
  frontSide,
  onFrontSideChange,
  onGenerate,
  generating,
  error,
  isOnline,
}: GrammarPickerProps) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScopeToggle scope={scope} missedCount={missedCount} onChange={onScopeChange} />

        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-sm shadow-sm shadow-neutral-900/5">
          <button
            type="button"
            className={`rounded px-3 py-1.5 font-medium transition ${
              frontSide === "turkish" ? "bg-red-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-50"
            }`}
            onClick={() => onFrontSideChange("turkish")}
          >
            Turkish → English
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1.5 font-medium transition ${
              frontSide === "english" ? "bg-red-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-50"
            }`}
            onClick={() => onFrontSideChange("english")}
          >
            English → Turkish
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm shadow-neutral-900/5">
        {grammarConceptCategories.map((category) => {
          const conceptsInCategory = grammarConcepts.filter((c) => c.category === category);
          const selectedCount = conceptsInCategory.filter((c) =>
            selectedConceptIds.includes(c.id)
          ).length;
          const focusCount = conceptsInCategory.filter((c) => focusConceptIds.includes(c.id)).length;
          const isOpen = openCategory === category;

          return (
            <div key={category} className="rounded-xl border border-neutral-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenCategory(isOpen ? null : category)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-neutral-50"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-700">{category}</span>
                  {selectedCount > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {selectedCount}
                    </span>
                  )}
                  {focusCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {focusCount} focus
                    </span>
                  )}
                </span>
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.18l3.71-3.95a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-2 border-t border-neutral-100 px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {conceptsInCategory.map((concept) => {
                      const selected = selectedConceptIds.includes(concept.id);
                      const focused = focusConceptIds.includes(concept.id);
                      return (
                        <div
                          key={concept.id}
                          title={concept.description}
                          className={`flex items-stretch overflow-hidden rounded-md border text-sm shadow-sm transition ${
                            focused
                              ? "border-amber-500 bg-amber-500 text-white shadow-amber-900/20"
                              : selected
                              ? "border-red-700 bg-red-700 text-white shadow-red-900/20"
                              : "border-neutral-200 bg-white text-neutral-600 shadow-neutral-900/5 hover:border-red-300 hover:text-neutral-900"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onToggleConcept(concept.id)}
                            className="px-3 py-1.5"
                          >
                            {concept.name}
                          </button>
                          {selected && (
                            <button
                              type="button"
                              onClick={() => onToggleFocus(concept.id)}
                              title={
                                focused
                                  ? "Focused — every generated sentence will use this concept. Click to unfocus."
                                  : "Make this a focus concept — every generated sentence will be required to use it."
                              }
                              className={`flex items-center border-l px-2 transition ${
                                focused
                                  ? "border-amber-400 text-white"
                                  : "border-red-600 text-red-100 hover:text-white"
                              }`}
                            >
                              <svg
                                viewBox="0 0 20 20"
                                fill={focused ? "currentColor" : "none"}
                                stroke="currentColor"
                                strokeWidth={1.5}
                                className="h-3.5 w-3.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M10 2.5l2.29 4.64 5.12.74-3.7 3.61.87 5.1L10 14.14l-4.58 2.41.87-5.1-3.7-3.61 5.12-.74L10 2.5z"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-neutral-400">
                    Click the star on a selected concept to focus it — every generated sentence
                    will be required to use every focused concept, instead of just being eligible to.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-900/5">
        <div className="flex items-center justify-between gap-3 text-sm text-neutral-600">
          <label htmlFor="known-percentage-slider">Vocabulary mix</label>
          <span className="font-medium text-neutral-800">
            {knownPercentage}% from your list / {100 - knownPercentage}% new
          </span>
        </div>
        <input
          id="known-percentage-slider"
          type="range"
          min={0}
          max={100}
          step={5}
          value={knownPercentage}
          onChange={(e) => onKnownPercentageChange(Number(e.target.value))}
          className="w-full accent-red-700"
        />
        <p className="text-xs text-neutral-400">
          Roughly what share of the words in each generated sentence come from your word list; the
          rest are words you haven't saved yet (marked with a dotted underline).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          Sentences
          <input
            type="number"
            min={1}
            max={15}
            value={count}
            onChange={(e) => onCountChange(Number(e.target.value))}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
          />
        </label>

        <button
          type="button"
          disabled={generating || !isOnline}
          onClick={onGenerate}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800 disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate sentences"}
        </button>
      </div>

      {!isOnline && (
        <p className="text-sm text-neutral-500">
          Grammar Practice needs a connection to generate sentences — you're currently offline.
          Vocab Study still works offline.
        </p>
      )}

      {generating && (
        <p className="text-xs text-neutral-500">Can take up to 2 minutes to generate sentences.</p>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
