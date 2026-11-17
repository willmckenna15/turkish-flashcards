import type { KeyboardEvent } from "react";

// Each plain letter and its Turkish form, both ways round, so a second Tab
// puts the plain letter back. The i's swap their dot rather than gaining
// one: plain i is already dotted (→ ı) and plain I already dotless (→ İ).
const SWAP: Record<string, string> = {};
for (const [plain, turkish] of [
  ["c", "ç"],
  ["g", "ğ"],
  ["i", "ı"],
  ["o", "ö"],
  ["s", "ş"],
  ["u", "ü"],
  ["C", "Ç"],
  ["G", "Ğ"],
  ["I", "İ"],
  ["O", "Ö"],
  ["S", "Ş"],
  ["U", "Ü"],
]) {
  SWAP[plain] = turkish;
  SWAP[turkish] = plain;
}

// Tab turns the letter just before the cursor into its Turkish form (c → ç,
// s → ş, …), or back again, so Turkish can be typed on any keyboard. When
// there's nothing to swap, Tab is left to move focus as usual.
export function swapTurkishLetterOnTab(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Tab" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
  const input = e.currentTarget;
  const { selectionStart: start, selectionEnd: end, value } = input;
  if (start === null || start !== end || start === 0) return;
  const swapped = SWAP[value[start - 1]];
  if (!swapped) return;

  e.preventDefault();
  input.setRangeText(swapped, start - 1, start, "end");
  // setRangeText doesn't fire an input event, so without one React's
  // onChange would never hear about the edit.
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
