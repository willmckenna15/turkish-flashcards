import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { GradeControls, type WrongReason } from "./GradeControls";

interface FlashcardDeckProps<T> {
  cards: T[];
  order: number[];
  index: number;
  onGoTo: (index: number) => void;
  onShuffle: () => void;
  // Optional: shown as a "Reset" button that returns to the first card in
  // the original order. Omitted by decks that don't persist a position.
  onReset?: () => void;
  getKey: (card: T) => string;
  renderFront: (card: T) => ReactNode;
  renderBack: (card: T) => ReactNode;
  wrongReasons?: WrongReason[];
  onGrade: (card: T, correct: boolean, reason?: string) => void;
  emptyMessage?: string;
}

export function FlashcardDeck<T>({
  cards,
  order,
  index: safeIndex,
  onGoTo,
  onShuffle,
  onReset,
  getKey,
  renderFront,
  renderBack,
  wrongReasons,
  onGrade,
  emptyMessage = "No cards to study right now.",
}: FlashcardDeckProps<T>) {
  const [flipped, setFlipped] = useState(false);
  const [dragX, setDragX] = useState(0);
  const dragStart = useRef<number | null>(null);

  const currentCard = order.length > 0 ? cards[order[safeIndex]] : undefined;
  const currentKey = currentCard ? getKey(currentCard) : null;

  // Reset the flip state as soon as the card changes, not after — resetting
  // via a useEffect only runs after that render has already painted, so for
  // one frame the *new* card would render with the *previous* card's
  // `flipped` value still in effect (e.g. showing the back/Turkish side of
  // the next card for an instant before snapping to the front/English side,
  // if the previous card had been flipped). Comparing against the last-seen
  // *card identity* (not the numeric index) during render and adjusting
  // state synchronously avoids that flash — comparing by index alone isn't
  // enough: grading a card out of a filtered scope (e.g. "words I've gotten
  // wrong") shrinks the deck, and the card that slides into the current
  // slot can end up at that exact same numeric index, so an index-only
  // check would miss the change entirely and leave the flip stuck.
  const [prevKey, setPrevKey] = useState(currentKey);
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setFlipped(false);
    setDragX(0);
  }

  function goTo(newIndex: number) {
    onGoTo(newIndex);
    setDragX(0);
  }

  function grade(correct: boolean, reason?: string) {
    if (!currentCard) return;
    onGrade(currentCard, correct, reason);
    goTo(safeIndex + 1);
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!flipped) return;
    dragStart.current = e.clientX;
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    setDragX(e.clientX - dragStart.current);
  }

  function handlePointerUp() {
    if (dragStart.current === null) return;
    const delta = dragX;
    dragStart.current = null;
    const threshold = 90;
    if (delta > threshold) {
      grade(true);
    } else if (delta < -threshold && !wrongReasons) {
      // Left swipe always means "wrong"; when a reason is required we let the
      // user finish via the Wrong button instead of guessing mid-swipe.
      grade(false);
    }
    setDragX(0);
  }

  if (order.length === 0 || !currentCard) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white/60 p-10 text-center text-neutral-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Card {safeIndex + 1} of {order.length}
      </p>

      <div
        key={getKey(currentCard)}
        className="relative w-full max-w-md cursor-pointer select-none rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-md shadow-neutral-900/5 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-900/10"
        style={{ transform: `translateX(${dragX}px) rotate(${dragX / 30}deg)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          dragStart.current = null;
          setDragX(0);
        }}
        onClick={() => setFlipped((f) => !f)}
      >
        <span
          className={`absolute left-6 top-6 h-1.5 w-1.5 rounded-full transition ${
            flipped ? "bg-red-500" : "bg-neutral-200"
          }`}
        />
        <div className="flex min-h-[10rem] items-center justify-center text-lg text-neutral-800">
          {flipped ? renderBack(currentCard) : renderFront(currentCard)}
        </div>
        <p className="mt-4 text-xs text-neutral-400">
          {flipped ? "Click to see the front" : "Click to reveal"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          onClick={() => goTo(safeIndex - 1)}
        >
          Prev
        </button>
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          onClick={onShuffle}
        >
          Shuffle
        </button>
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          onClick={() => goTo(safeIndex + 1)}
        >
          Next
        </button>
        {onReset && (
          <button
            type="button"
            title="Back to the first card, in the original order"
            className="ml-2 rounded-md px-3 py-1.5 text-sm text-neutral-400 transition hover:bg-neutral-50 hover:text-neutral-600"
            onClick={onReset}
          >
            Reset
          </button>
        )}
      </div>

      <GradeControls
        disabled={!flipped}
        wrongReasons={wrongReasons}
        onCorrect={() => grade(true)}
        onWrong={(reason) => grade(false, reason)}
      />
    </div>
  );
}
