import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";
import type { ConceptEvent, StudyScope, UserSettings, Word, WordEvent } from "../types";
import { sentenceGradeEffect, vocabGradeEffect, type SentenceGradeOutcome } from "./grading";
import {
  loadCachedSettings,
  loadCachedWordEvents,
  loadCachedWords,
  loadPendingWrites,
  loadSettingsUnsynced,
  makeLocalId,
  saveCachedSettings,
  saveCachedWordEvents,
  saveCachedWords,
  savePendingWrites,
  saveSettingsUnsynced,
  type PendingWrite,
} from "./offlineCache";
import { normalizeTerm, sameWord } from "./normalizeTerm";

interface WordRow {
  id: string;
  term: string;
  meaning: string;
  added_at: string;
  needs_review: boolean;
}

interface SettingsRow {
  user_id: string;
  selected_concept_ids: string[];
  focus_concept_ids: string[] | null;
  front_side: "turkish" | "english";
  study_scope: string;
}

// study_scope is a plain text column, so a value written by a newer build
// (or anything unexpected) falls back rather than breaking the deck.
const studyScopes: StudyScope[] = ["all", "missed"];

function toStudyScope(value: string): StudyScope {
  return (studyScopes as string[]).includes(value) ? (value as StudyScope) : "all";
}

interface ConceptEventRow {
  concept_id: string;
  correct: boolean;
  created_at: string;
}

interface WordEventRow {
  word_id: string;
  correct: boolean;
  created_at: string;
}

const defaultSettings: UserSettings = {
  selectedConceptIds: [],
  focusConceptIds: [],
  frontSide: "turkish",
  studyScope: "all",
};

function wordFromRow(row: WordRow): Word {
  return {
    id: row.id,
    term: row.term,
    meaning: row.meaning,
    addedAt: row.added_at,
    needsReview: row.needs_review,
  };
}

function settingsFromRow(row: SettingsRow): UserSettings {
  return {
    selectedConceptIds: row.selected_concept_ids,
    focusConceptIds: row.focus_concept_ids ?? [],
    frontSide: row.front_side,
    studyScope: toStudyScope(row.study_scope),
  };
}

// Postgres error code for a unique-constraint violation — what Supabase
// returns when an insert collides with `words_user_term_unique`.
const UNIQUE_VIOLATION = "23505";
// PostgREST's codes for an RPC function / table that doesn't exist — i.e.
// migration 0005 hasn't been run against this project yet.
const FUNCTION_NOT_FOUND = "PGRST202";
const TABLE_NOT_FOUND = "PGRST205";
// A column the request names doesn't exist — PostgREST reports it from its
// schema cache on a write (PGRST204) and Postgres itself on a read (42703).
const COLUMN_NOT_FOUND = "PGRST204";
const UNDEFINED_COLUMN = "42703";

// Migration 0003 adds user_settings.focus_concept_ids. Until it's run, naming
// that column rejects the *whole* settings write, taking the grammar-concept
// selection down with it — so a rejection on that column is retried without
// it rather than losing everything else the user just chose.
function isMissingFocusColumn(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  if (code !== COLUMN_NOT_FOUND && code !== UNDEFINED_COLUMN) return false;
  return (error.message ?? "").includes("focus_concept_ids");
}

// Handed back by gradeVocab so the answer can be undone: identifies the
// logged attempt and remembers what the review flag was before it.
export interface GradeReceipt {
  wordId: string;
  createdAt: string;
  previousNeedsReview: boolean;
}

// Thrown by addWord when the term is already in the list (matched via
// normalizeTerm). Carries the existing entry so the UI can point at it.
// A queued write the server will keep rejecting however many times it's
// retried, so the queue can't drain on its own. Carries a message meant for
// the user, since "syncing…" forever is worse than saying what's wrong.
export class SyncBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncBlockedError";
  }
}

export class DuplicateWordError extends Error {
  readonly existing: Word;
  constructor(existing: Word) {
    super(`"${existing.term}" is already in your word list`);
    this.name = "DuplicateWordError";
    this.existing = existing;
  }
}

interface WordsContextValue {
  words: Word[];
  settings: UserSettings;
  conceptEvents: ConceptEvent[];
  // Every graded attempt at a word (vocab study and grammar practice), for
  // "how often have I got this wrong recently" stats and deck filters.
  wordEvents: WordEvent[];
  sessionStart: string;
  loading: boolean;
  // True once the browser reports connectivity. Vocab Study doesn't gate
  // anything on this (it always works off the local cache/queue below), but
  // Grammar Practice uses it to warn before attempting a Gemini call that
  // can't possibly succeed offline.
  isOnline: boolean;
  // Count of word add/remove/grade writes made offline that haven't
  // reached Supabase yet — surfaced as a small "syncing" indicator.
  pendingWriteCount: number;
  // Set when the queue has stopped on a write the server keeps rejecting —
  // the difference between "syncing" and "stuck, and here's why".
  syncBlockedReason: string | null;
  // The first entry whose term matches (ignoring case and surrounding
  // whitespace), whatever its meaning — "is this word on my list at all?".
  findWord: (term: string) => Word | undefined;
  // The entry with this exact term AND meaning — the identity a duplicate is
  // judged by, since one term can hold several unrelated meanings.
  findEntry: (term: string, meaning: string) => Word | undefined;
  // Rejects with DuplicateWordError only if the same term *and* meaning is
  // already saved.
  addWord: (term: string, meaning: string) => Promise<Word>;
  addWordIfNew: (term: string, meaning: string) => Promise<void>;
  // Rejects with DuplicateWordError if the new term matches a *different*
  // existing word.
  updateWord: (id: string, patch: { term: string; meaning: string }) => Promise<void>;
  removeWord: (id: string) => Promise<void>;
  // Returns immediately (the write syncs in the background) so the UI can
  // offer an undo straight away.
  gradeVocab: (wordId: string, correct: boolean) => GradeReceipt;
  undoGrade: (receipt: GradeReceipt) => Promise<void>;
  // Grades a practice sentence: the outcome's word effect (if any) applies
  // to every id in `wordIds` — the list words the sentence used — and its
  // concept effect to `conceptsUsed`.
  gradeSentence: (
    wordIds: string[],
    conceptsUsed: string[],
    outcome: SentenceGradeOutcome
  ) => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
}

const WordsContext = createContext<WordsContextValue | null>(null);

// PostgREST caps how many rows a single request may return — Supabase's
// per-project "Max rows" setting, 1000 by default — and it does so
// silently: the response simply stops, with no error and no indication that
// there was more. So one unbounded `select()` of word_events returned an
// arbitrary slice of the history as soon as the account passed that many
// graded attempts, and that slice was then written over the local cache,
// destroying the rest. Words whose misses fell outside the slice vanished
// from the all-time stats, and because the query had no ORDER BY, *which*
// ones survived could change from one load to the next.
//
// Paging by the table's uuid primary key (stable, unique, so no row is
// skipped or repeated between pages) until a request comes back empty is
// the only way to be certain the whole table has been read. Advancing by
// the number of rows actually returned — rather than by a fixed page size —
// keeps this correct on a project configured with a smaller cap.
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  table: string,
  columns: string
): Promise<{ rows: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length === 0) break;
    from += page.length;
  }
  return { rows, error: null };
}

export function WordsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [conceptEvents, setConceptEvents] = useState<ConceptEvent[]>([]);
  const [wordEvents, setWordEvents] = useState<WordEvent[]>([]);
  const [sessionStart] = useState<string>(() => new Date().toISOString());
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [pendingWriteCount, setPendingWriteCount] = useState(0);
  const [syncBlockedReason, setSyncBlockedReason] = useState<string | null>(null);
  const flushingRef = useRef(false);
  const lastGradeAtRef = useRef(0);
  // The latest settings, readable outside a render closure — the load below
  // may need them after an await, and successive toggles need to build on
  // each other rather than on whatever this render captured.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Bumped on every local settings change, so a slow load can tell whether
  // the user has chosen something since it started.
  const settingsRevisionRef = useRef(0);

  // Upsert, not update: `.update().eq("user_id", ...)` silently matches zero
  // rows when the user has no settings row yet, so a grammar-concept
  // selection would apply on screen and then quietly vanish on the next
  // load. supabase-js *returns* errors rather than throwing them, so they're
  // checked here rather than left to a try/catch that could never fire.
  async function persistSettings(userId: string, value: UserSettings): Promise<boolean> {
    saveCachedSettings(userId, value);
    try {
      const row = {
        user_id: userId,
        selected_concept_ids: value.selectedConceptIds,
        focus_concept_ids: value.focusConceptIds,
        front_side: value.frontSide,
        study_scope: value.studyScope,
      };
      let { error } = await supabase
        .from("user_settings")
        .upsert(row, { onConflict: "user_id" });
      if (error && isMissingFocusColumn(error)) {
        const { focus_concept_ids: _unused, ...withoutFocus } = row;
        ({ error } = await supabase
          .from("user_settings")
          .upsert(withoutFocus, { onConflict: "user_id" }));
      }
      if (error) throw error;
      saveSettingsUnsynced(userId, false);
      return true;
    } catch {
      // Offline, or the write was rejected. The local mirror above still has
      // the choice, and this flag makes the next load push it up instead of
      // pulling the server's older row down over it.
      saveSettingsUnsynced(userId, true);
      return false;
    }
  }

  // A word graded while it still had an offline temp id: once the add lands
  // and the real id is known, point its locally-held events at that.
  function retargetWordEvents(userId: string, fromId: string, toId: string) {
    setWordEvents((prev) => {
      if (!prev.some((e) => e.wordId === fromId)) return prev;
      const next = prev.map((e) => (e.wordId === fromId ? { ...e, wordId: toId } : e));
      saveCachedWordEvents(userId, next);
      return next;
    });
  }

  // Words (and their grade events) are the only tables mirrored to
  // localStorage / queued for offline writes — see offlineCache.ts. Drains
  // the queue in order, replaying each
  // write against Supabase; stops at the first failure (still offline, or a
  // transient error) and leaves the remainder queued for the next attempt.
  async function flushPendingWrites(userId: string) {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      // Maps a word's temporary offline id to the real id Supabase assigned
      // once its "add" write succeeds, so any other still-queued write for
      // that same word (a remove, or a needs-review flip) targets the right
      // row instead of a locally-invented id.
      const idMap = new Map<string, string>();

      for (;;) {
        const queue = loadPendingWrites(userId);
        if (queue.length === 0) break;
        const write = queue[0];

        try {
          if (write.type === "add") {
            const { data, error } = await supabase
              .from("words")
              .insert({
                user_id: userId,
                term: write.term,
                meaning: write.meaning,
                added_at: write.createdAt,
              })
              .select()
              .single();
            if (error?.code === UNIQUE_VIOLATION) {
              // Another device (or an earlier replay) already added this
              // word, so the server rejected ours. Swap the optimistic local
              // copy for the real row so the queue can move on and any
              // later queued write for this word lands on the right id. If
              // the lookup itself fails we're presumably offline again —
              // throw so the write stays queued and we try again later.
              const { data: rows, error: lookupError } = await supabase
                .from("words")
                .select("*")
                .order("added_at", { ascending: false });
              if (lookupError || !rows) throw lookupError ?? new Error("Failed to look up word");
              const existing = (rows as WordRow[])
                .map(wordFromRow)
                .find((w) => sameWord(w, { term: write.term, meaning: write.meaning }));
              if (!existing) {
                // Rejected as a duplicate, yet nothing on the server has this
                // term *and* meaning: the database is still carrying the
                // term-only index from migration 0004, so it won't accept a
                // second meaning for a term until 0006 replaces it. Throwing
                // leaves this write queued and the local copy untouched, so
                // the word stays on the list and syncs by itself once the
                // index is fixed — far better than silently dropping it.
                throw new SyncBlockedError(
                  `"${write.term}" can't be saved to the server: this account's database still allows only one meaning per Turkish word. Running supabase/migrations/0006_unique_word_meaning.sql fixes it, and everything queued will sync straight after. The word is safe on this device meanwhile.`
                );
              }
              idMap.set(write.tempId, existing.id);
              retargetWordEvents(userId, write.tempId, existing.id);
              setWords((prev) => {
                const withoutTemp = prev.filter((w) => w.id !== write.tempId);
                const next =
                  existing && !withoutTemp.some((w) => w.id === existing.id)
                    ? [existing, ...withoutTemp]
                    : withoutTemp;
                saveCachedWords(userId, next);
                return next;
              });
            } else {
              if (error || !data) throw error ?? new Error("Failed to add word");
              const real = wordFromRow(data as WordRow);
              idMap.set(write.tempId, real.id);
              setWords((prev) => {
                const next = prev.map((w) => (w.id === write.tempId ? real : w));
                saveCachedWords(userId, next);
                return next;
              });
              retargetWordEvents(userId, write.tempId, real.id);
            }
          } else if (write.type === "edit") {
            const id = idMap.get(write.id) ?? write.id;
            const { error } = await supabase
              .from("words")
              .update({ term: write.term, meaning: write.meaning })
              .eq("id", id);
            if (error?.code === UNIQUE_VIOLATION) {
              // The new term collides with a word added from elsewhere since
              // this edit was queued. Put the server's version of this row
              // back locally and move on; the edit is dropped.
              const { data: row, error: lookupError } = await supabase
                .from("words")
                .select("*")
                .eq("id", id)
                .maybeSingle();
              if (lookupError) throw lookupError;
              if (row) {
                const real = wordFromRow(row as WordRow);
                setWords((prev) => {
                  const next = prev.map((w) => (w.id === id ? real : w));
                  saveCachedWords(userId, next);
                  return next;
                });
              }
            } else if (error) {
              throw error;
            }
          } else if (write.type === "remove") {
            const id = idMap.get(write.id) ?? write.id;
            await supabase.from("words").delete().eq("id", id);
          } else if (write.type === "grade") {
            const id = idMap.get(write.id) ?? write.id;
            const { error } = await supabase.rpc("record_word_grade", {
              p_word_id: id,
              p_correct: write.correct,
              p_created_at: write.createdAt,
            });
            if (error?.code === FUNCTION_NOT_FOUND) {
              // Counters can't be stored until the migration runs; keep the
              // review flag in sync at least, and don't jam the queue.
              await supabase.from("words").update({ needs_review: !write.correct }).eq("id", id);
            } else if (error) {
              throw error;
            }
          } else if (write.type === "ungrade") {
            const id = idMap.get(write.id) ?? write.id;
            const { error } = await supabase
              .from("word_events")
              .delete()
              .eq("word_id", id)
              .eq("created_at", write.createdAt);
            // No word_events table yet (pre-migration) — nothing to delete.
            if (error && error.code !== TABLE_NOT_FOUND) throw error;
            await supabase.from("words").update({ needs_review: write.needsReview }).eq("id", id);
          } else {
            const id = idMap.get(write.id) ?? write.id;
            await supabase.from("words").update({ needs_review: write.needsReview }).eq("id", id);
          }
        } catch (err) {
          // A write the server will never accept is called out by name; any
          // other failure (offline, transient) just pauses the queue.
          setSyncBlockedReason(err instanceof SyncBlockedError ? err.message : null);
          // Stop here and leave this write (and everything after it) queued.
          break;
        }

        setSyncBlockedReason(null);

        // Dequeue this write by value rather than position: undoGrade may
        // have pulled a later entry out from under us meanwhile.
        const current = loadPendingWrites(userId);
        const done = JSON.stringify(write);
        const at = current.findIndex((w) => JSON.stringify(w) === done);
        const remaining = at >= 0 ? [...current.slice(0, at), ...current.slice(at + 1)] : current;
        savePendingWrites(userId, remaining);
        setPendingWriteCount(remaining.length);
      }
    } finally {
      flushingRef.current = false;
    }
  }

  function enqueueWrite(write: PendingWrite) {
    if (!user) return;
    const queue = [...loadPendingWrites(user.id), write];
    savePendingWrites(user.id, queue);
    setPendingWriteCount(queue.length);
  }

  useEffect(() => {
    if (!user) {
      setWords([]);
      setSettings(defaultSettings);
      setConceptEvents([]);
      setWordEvents([]);
      setPendingWriteCount(0);
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Hydrate instantly from the local mirror (if any) so Vocab Study can
    // render before — or entirely without — a network round-trip.
    const cachedWords = loadCachedWords(user.id);
    if (cachedWords.length > 0) setWords(cachedWords);
    const cachedSettings = loadCachedSettings(user.id);
    if (cachedSettings) setSettings(cachedSettings);
    setWordEvents(loadCachedWordEvents(user.id));
    setPendingWriteCount(loadPendingWrites(user.id).length);
    setLoading(cachedWords.length === 0);

    async function load() {
      const revisionAtStart = settingsRevisionRef.current;
      try {
        const [wordsRes, settingsRes, eventsRes, wordEventsRes] = await Promise.all([
          fetchAllRows<WordRow>("words", "*"),
          supabase.from("user_settings").select("*").eq("user_id", user!.id).maybeSingle(),
          fetchAllRows<ConceptEventRow>("concept_events", "concept_id, correct, created_at"),
          fetchAllRows<WordEventRow>("word_events", "word_id, correct, created_at"),
        ]);

        if (cancelled) return;
        if (wordsRes.error) throw wordsRes.error;

        const freshWords = wordsRes.rows
          .map(wordFromRow)
          .sort((a, b) => b.addedAt.localeCompare(a.addedAt));

        // A word whose "add" is still queued isn't on the server yet, so the
        // fetched list doesn't contain it. Replacing the list outright would
        // wipe it from view — and from the local cache — while its write sat
        // in the queue, which is exactly how a word can seem to vanish after
        // a reload. Carry those back in, newest first, until they sync.
        const queuedAdds = loadPendingWrites(user!.id).filter(
          (w): w is Extract<PendingWrite, { type: "add" }> => w.type === "add"
        );
        const unsynced = queuedAdds
          .filter((w) => !freshWords.some((f) => sameWord(f, { term: w.term, meaning: w.meaning })))
          .map((w) => ({
            id: w.tempId,
            term: w.term,
            meaning: w.meaning,
            addedAt: w.createdAt,
            needsReview: false,
          }));
        const mergedWords = [...unsynced, ...freshWords];
        setWords(mergedWords);
        saveCachedWords(user!.id, mergedWords);

        // A settings change made while offline (or that otherwise failed to
        // land) is newer than whatever the server still has, so push it up
        // rather than pulling the stale row down over it. Same for a change
        // made while this load was still in flight.
        const localIsNewer =
          loadSettingsUnsynced(user!.id) || settingsRevisionRef.current !== revisionAtStart;

        if (localIsNewer) {
          void persistSettings(user!.id, settingsRef.current);
        } else if (settingsRes.data) {
          const fromServer = settingsFromRow(settingsRes.data as SettingsRow);
          setSettings(fromServer);
          saveCachedSettings(user!.id, fromServer);
        } else if (!settingsRes.error) {
          await persistSettings(user!.id, defaultSettings);
          setSettings(defaultSettings);
        }

        if (!eventsRes.error) {
          setConceptEvents(
            eventsRes.rows.map((row) => ({
              conceptId: row.concept_id,
              correct: row.correct,
              createdAt: row.created_at,
            }))
          );
        }

        // Errors here most likely mean migration 0005 hasn't been run yet
        // (no word_events table) — keep whatever the cache had.
        if (!wordEventsRes.error) {
          const freshEvents = wordEventsRes.rows.map((row) => ({
            wordId: row.word_id,
            correct: row.correct,
            createdAt: row.created_at,
          }));
          // Grades recorded against a word that hasn't synced yet are held
          // under its temporary id, so the server can't know about them.
          // Keep them for the same reason the words above are kept.
          const unsyncedIds = new Set(unsynced.map((w) => w.id));
          const heldEvents = loadCachedWordEvents(user!.id).filter((e) =>
            unsyncedIds.has(e.wordId)
          );
          const mergedEvents = [...heldEvents, ...freshEvents];
          setWordEvents(mergedEvents);
          saveCachedWordEvents(user!.id, mergedEvents);
        }
      } catch {
        // Offline, or Supabase otherwise unreachable — keep whatever we
        // hydrated from the cache above (or the empty default, if this is a
        // brand-new device that's never synced while online yet).
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    void flushPendingWrites(user.id);

    return () => {
      cancelled = true;
    };
    // Keyed on the id, not the `user` object: AuthContext derives `user` from
    // `session`, so every token refresh (including one on app resume) hands
    // back a new object for the same person. Keying on identity re-ran this
    // whole load on each refresh, which could pull the server's settings row
    // back over a choice just made locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      if (user) void flushPendingWrites(user.id);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function findWord(term: string): Word | undefined {
    const key = normalizeTerm(term);
    if (!key) return undefined;
    return words.find((w) => normalizeTerm(w.term) === key);
  }

  function findEntry(term: string, meaning: string): Word | undefined {
    if (!normalizeTerm(term)) return undefined;
    return words.find((w) => sameWord(w, { term, meaning }));
  }

  async function addWord(term: string, meaning: string): Promise<Word> {
    const existing = findEntry(term, meaning);
    if (existing) throw new DuplicateWordError(existing);

    const tempId = makeLocalId();
    const createdAt = new Date().toISOString();
    const word: Word = { id: tempId, term, meaning, addedAt: createdAt, needsReview: false };

    setWords((prev) => {
      const next = [word, ...prev];
      saveCachedWords(user!.id, next);
      return next;
    });
    enqueueWrite({ type: "add", tempId, term, meaning, createdAt });
    // Best-effort immediate sync if we're actually online — otherwise this
    // is a no-op that leaves the write queued (see flushPendingWrites).
    await flushPendingWrites(user!.id);
    return word;
  }

  async function addWordIfNew(term: string, meaning: string): Promise<void> {
    if (findWord(term)) return;
    await addWord(term, meaning);
  }

  async function updateWord(
    id: string,
    patch: { term: string; meaning: string }
  ): Promise<void> {
    const term = patch.term.trim();
    const meaning = patch.meaning.trim();
    const clash = findEntry(term, meaning);
    if (clash && clash.id !== id) throw new DuplicateWordError(clash);

    setWords((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, term, meaning } : w));
      saveCachedWords(user!.id, next);
      return next;
    });
    enqueueWrite({ type: "edit", id, term, meaning });
    await flushPendingWrites(user!.id);
  }

  async function removeWord(id: string): Promise<void> {
    setWords((prev) => {
      const next = prev.filter((w) => w.id !== id);
      saveCachedWords(user!.id, next);
      return next;
    });
    setWordEvents((prev) => {
      const next = prev.filter((e) => e.wordId !== id);
      saveCachedWordEvents(user!.id, next);
      return next;
    });
    enqueueWrite({ type: "remove", id });
    await flushPendingWrites(user!.id);
  }

  // One graded attempt at a word: flips its review flag and logs the
  // attempt as a timestamped event. The local update is immediate; `done`
  // resolves once the sync attempt has finished.
  function gradeWord(wordId: string, correct: boolean): { receipt: GradeReceipt; done: Promise<void> } {
    // The timestamp is what identifies the event for undo, so keep them
    // strictly increasing even if two grades land in the same millisecond.
    const at = Math.max(Date.now(), lastGradeAtRef.current + 1);
    lastGradeAtRef.current = at;
    const createdAt = new Date(at).toISOString();
    const previousNeedsReview = words.find((w) => w.id === wordId)?.needsReview ?? false;
    setWords((prev) => {
      const next = prev.map((w) => (w.id === wordId ? { ...w, needsReview: !correct } : w));
      saveCachedWords(user!.id, next);
      return next;
    });
    setWordEvents((prev) => {
      const next = [...prev, { wordId, correct, createdAt }];
      saveCachedWordEvents(user!.id, next);
      return next;
    });
    enqueueWrite({ type: "grade", id: wordId, correct, createdAt });
    return {
      receipt: { wordId, createdAt, previousNeedsReview },
      done: flushPendingWrites(user!.id),
    };
  }

  // Reverses a grade: the logged attempt disappears and the review flag goes
  // back to what it was. If the grade is still waiting in the offline queue
  // it's simply dropped; otherwise an "ungrade" is queued behind it.
  async function undoGrade(receipt: GradeReceipt): Promise<void> {
    const { wordId, createdAt, previousNeedsReview } = receipt;
    setWords((prev) => {
      const next = prev.map((w) => (w.id === wordId ? { ...w, needsReview: previousNeedsReview } : w));
      saveCachedWords(user!.id, next);
      return next;
    });
    setWordEvents((prev) => {
      const next = prev.filter((e) => !(e.wordId === wordId && e.createdAt === createdAt));
      saveCachedWordEvents(user!.id, next);
      return next;
    });

    const queue = loadPendingWrites(user!.id);
    const at = queue.findIndex(
      (w) => w.type === "grade" && w.id === wordId && w.createdAt === createdAt
    );
    // The head of the queue may be mid-flight while a flush is running, so
    // only short-circuit when we can be sure the grade hasn't been sent.
    const unsent = at > 0 || (at === 0 && !flushingRef.current);
    if (unsent) {
      const remaining = [...queue.slice(0, at), ...queue.slice(at + 1)];
      savePendingWrites(user!.id, remaining);
      setPendingWriteCount(remaining.length);
      return;
    }
    enqueueWrite({ type: "ungrade", id: wordId, createdAt, needsReview: previousNeedsReview });
    await flushPendingWrites(user!.id);
  }

  async function recordConceptEvents(conceptIds: string[], correct: boolean) {
    if (conceptIds.length === 0) return;

    const createdAt = new Date().toISOString();
    const rows = conceptIds.map((conceptId) => ({
      user_id: user!.id,
      concept_id: conceptId,
      correct,
      created_at: createdAt,
    }));

    setConceptEvents((prev) => [
      ...prev,
      ...conceptIds.map((conceptId) => ({ conceptId, correct, createdAt })),
    ]);

    try {
      await supabase.from("concept_events").insert(rows);
    } catch {
      // Grammar Practice is online-only by design (sentence generation is a
      // live Gemini call) — if this write fails because connectivity
      // dropped mid-session, the local stat above still applies to this
      // session's ConceptStats view, it just won't have reached Supabase.
      // Unlike `words`, concept events aren't queued for offline replay.
    }
  }

  function gradeVocab(wordId: string, correct: boolean): GradeReceipt {
    const effect = vocabGradeEffect(correct);
    // vocabGradeEffect always sets the flag one way or the other; the null
    // case only exists for sentence outcomes.
    return gradeWord(wordId, effect.needsReview === null ? correct : !effect.needsReview).receipt;
  }

  async function gradeSentence(
    wordIds: string[],
    conceptsUsed: string[],
    outcome: SentenceGradeOutcome
  ): Promise<void> {
    const { word, concept } = sentenceGradeEffect(outcome);
    const tasks: Promise<unknown>[] = [];
    if (word.needsReview !== null) {
      for (const wordId of wordIds) tasks.push(gradeWord(wordId, !word.needsReview).done);
    }
    if (conceptsUsed.length > 0) {
      tasks.push(recordConceptEvents(conceptsUsed, concept.correctDelta === 1));
    }
    await Promise.all(tasks);
  }

  async function updateSettings(partial: Partial<UserSettings>): Promise<void> {
    settingsRevisionRef.current += 1;
    // Built from the ref, not this render's `settings`: ticking several
    // grammar concepts in quick succession would otherwise have each write
    // built from the same stale array, so all but the last would be lost.
    const next = { ...settingsRef.current, ...partial };
    settingsRef.current = next;
    setSettings(next);
    await persistSettings(user!.id, next);
  }

  return (
    <WordsContext.Provider
      value={{
        words,
        settings,
        conceptEvents,
        wordEvents,
        sessionStart,
        loading,
        isOnline,
        pendingWriteCount,
        syncBlockedReason,
        findWord,
        findEntry,
        addWord,
        addWordIfNew,
        updateWord,
        removeWord,
        gradeVocab,
        undoGrade,
        gradeSentence,
        updateSettings,
      }}
    >
      {children}
    </WordsContext.Provider>
  );
}

export function useWords() {
  const ctx = useContext(WordsContext);
  if (!ctx) throw new Error("useWords must be used within WordsProvider");
  return ctx;
}
