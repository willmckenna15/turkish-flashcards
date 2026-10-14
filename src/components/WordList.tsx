import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { DuplicateWordError, useWords } from "../lib/WordsContext";
import { normalizeTerm } from "../lib/normalizeTerm";
import type { Word } from "../types";

// How long the "word already exists" pop-up stays before dismissing itself.
const DUPLICATE_NOTICE_MS = 3500;

export function WordList() {
  const { words, findEntry, addWord, removeWord } = useWords();
  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Term matching uses the same Turkish-aware folding as duplicate checks;
  // meanings are English, where plain lowercasing is the right call.
  const queryTerm = normalizeTerm(query);
  const queryMeaning = query.trim().toLowerCase();
  const visible = queryTerm
    ? words.filter(
        (w) =>
          normalizeTerm(w.term).includes(queryTerm) ||
          w.meaning.toLowerCase().includes(queryMeaning)
      )
    : words;
  // The existing entry that blocked the last submit, shown as a pop-up
  // under the Turkish field until it times out or the term is edited.
  const [duplicate, setDuplicate] = useState<Word | null>(null);

  useEffect(() => {
    if (!duplicate) return;
    const timer = setTimeout(() => setDuplicate(null), DUPLICATE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [duplicate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!term.trim() || !meaning.trim()) return;

    // Same term with a *different* meaning is a legitimate new card
    // (yüz = "face" / "hundred" / "swim"), so both halves have to match.
    const existing = findEntry(term, meaning);
    if (existing) {
      setDuplicate(existing);
      return;
    }

    setSubmitting(true);
    try {
      await addWord(term.trim(), meaning.trim());
      setTerm("");
      setMeaning("");
    } catch (err) {
      // Belt and braces — addWord re-checks, so this only fires if the list
      // changed between the check above and the add.
      if (err instanceof DuplicateWordError) setDuplicate(err.existing);
      else throw err;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-900/5"
      >
        <div className="relative flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Turkish</label>
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setDuplicate(null);
            }}
            placeholder="e.g. ev"
            aria-invalid={duplicate ? true : undefined}
            aria-describedby={duplicate ? "word-duplicate-note" : undefined}
            className={`rounded-md border px-3 py-2 text-base outline-none transition focus:ring-2 ${
              duplicate
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
                : "border-neutral-300 focus:border-red-600 focus:ring-red-600/20"
            }`}
          />
          {duplicate && (
            <div
              id="word-duplicate-note"
              role="alert"
              className="absolute left-0 top-full z-10 mt-1.5 animate-pop-in rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 shadow-sm shadow-rose-900/10"
            >
              <span className="font-medium">Word already exists</span> — {duplicate.term} ·{" "}
              {duplicate.meaning}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Meaning</label>
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="e.g. house"
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {words.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white/60 p-8 text-center text-sm text-neutral-500">
          No words yet — add your first one above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-900/5">
          <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
            <div className="relative flex-1">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Turkish or meaning…"
                aria-label="Search words"
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-600/20"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-neutral-400 transition hover:text-neutral-600"
                >
                  ×
                </button>
              )}
            </div>
            <span className="shrink-0 text-xs text-neutral-400">
              {query ? `${visible.length} of ${words.length}` : `${words.length} words`}
            </span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Turkish</th>
                <th className="px-4 py-2 font-medium">Meaning</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral-500">
                    No words match “{query.trim()}”.
                  </td>
                </tr>
              ) : (
                visible.map((w) =>
                  w.id === editingId ? (
                    <EditRow key={w.id} word={w} onDone={() => setEditingId(null)} />
                  ) : (
                    <tr key={w.id} className="border-t border-neutral-100 transition hover:bg-red-50/40">
                      <td className="px-4 py-2 font-medium text-neutral-800">{w.term}</td>
                      <td className="px-4 py-2 text-neutral-600">{w.meaning}</td>
                      <td className="px-4 py-2">
                        {w.needsReview && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Needs review
                          </span>
                        )}
                      </td>
                      <td className="space-x-3 whitespace-nowrap px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(w.id)}
                          className="text-xs text-neutral-400 transition hover:text-red-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWord(w.id)}
                          className="text-xs text-neutral-400 transition hover:text-rose-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// A word row swapped into edit mode: term and meaning become inputs, Enter
// saves, Escape cancels. Owns its draft so typing doesn't re-render the
// whole list.
function EditRow({ word, onDone }: { word: Word; onDone: () => void }) {
  const { updateWord } = useWords();
  const [draftTerm, setDraftTerm] = useState(word.term);
  const [draftMeaning, setDraftMeaning] = useState(word.meaning);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = draftTerm.trim() !== "" && draftMeaning.trim() !== "";
  const unchanged = draftTerm.trim() === word.term && draftMeaning.trim() === word.meaning;

  async function save() {
    if (!canSave || saving) return;
    if (unchanged) {
      onDone();
      return;
    }
    setSaving(true);
    try {
      await updateWord(word.id, { term: draftTerm, meaning: draftMeaning });
      onDone();
    } catch (err) {
      if (err instanceof DuplicateWordError) {
        setError(`Word already exists — ${err.existing.term} · ${err.existing.meaning}`);
      } else {
        throw err;
      }
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onDone();
    }
  }

  const editInputClass =
    "w-full rounded-md border px-2 py-1 text-sm outline-none transition focus:ring-2 " +
    (error
      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
      : "border-neutral-300 focus:border-red-600 focus:ring-red-600/20");

  return (
    <tr className="border-t border-neutral-100 bg-red-50/30">
      <td className="px-4 py-2 align-top">
        <input
          autoFocus
          value={draftTerm}
          onChange={(e) => {
            setDraftTerm(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Turkish"
          className={editInputClass}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-rose-700">
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-2 align-top">
        <input
          value={draftMeaning}
          onChange={(e) => setDraftMeaning(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Meaning"
          className={editInputClass}
        />
      </td>
      <td className="px-4 py-2 align-top">
        {word.needsReview && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Needs review
          </span>
        )}
      </td>
      <td className="space-x-3 whitespace-nowrap px-4 py-2 text-right align-top">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave || saving}
          className="text-xs font-medium text-red-700 transition hover:text-red-800 disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-neutral-400 transition hover:text-neutral-600"
        >
          Cancel
        </button>
      </td>
    </tr>
  );
}
