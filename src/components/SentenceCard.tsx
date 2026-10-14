import { useState } from "react";
import { useWords } from "../lib/WordsContext";
import type { SentenceCard as SentenceCardData, Token } from "../types";

interface SentenceCardProps {
  card: SentenceCardData;
  showTurkish: boolean;
}

export function SentenceCard({ card, showTurkish }: SentenceCardProps) {
  const { findWord, addWordIfNew } = useWords();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());

  if (!showTurkish) {
    return <span>{card.english}</span>;
  }

  const openToken: Token | undefined = openIndex !== null ? card.tokens[openIndex] : undefined;
  const alreadySaved = openToken ? !!findWord(openToken.lemma ?? openToken.text) : false;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="leading-relaxed">
        {card.tokens.map((token, i) => {
          if (token.isPunctuation) {
            return <span key={i}>{token.text}</span>;
          }
          const classes = [
            "cursor-pointer text-neutral-800 transition hover:text-red-600",
            // The "new" share of the vocabulary mix — words not on the list.
            token.isNew ? "border-b border-dotted border-amber-400" : "",
          ].join(" ");
          return (
            <span key={i}>
              {i > 0 ? " " : ""}
              <span
                className={classes}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIndex(openIndex === i ? null : i);
                }}
              >
                {token.text}
              </span>
            </span>
          );
        })}
      </p>

      {openToken && (
        <div
          className="flex items-center gap-3 rounded-md border border-red-100 bg-red-50/60 px-3 py-2 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-neutral-700">{openToken.meaning ?? "—"}</span>
          {openToken.lemma && openToken.lemma.toLowerCase() !== openToken.text.toLowerCase() && (
            <span className="text-xs text-red-700/70">dictionary form: {openToken.lemma}</span>
          )}
          <button
            type="button"
            disabled={alreadySaved || (openIndex !== null && added.has(openIndex))}
            className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            onClick={async () => {
              await addWordIfNew(openToken.lemma ?? openToken.text, openToken.meaning ?? "");
              if (openIndex !== null) setAdded((prev) => new Set(prev).add(openIndex));
            }}
          >
            {alreadySaved || (openIndex !== null && added.has(openIndex)) ? "Saved" : "Add to word list"}
          </button>
        </div>
      )}
    </div>
  );
}
