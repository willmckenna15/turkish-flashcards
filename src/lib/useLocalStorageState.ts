import { useEffect, useState } from "react";

// useState that survives reloads via localStorage. Storage is best-effort:
// a missing, unreadable or corrupt value falls back to `initial`, and a
// failed write is ignored. `validate` lets the caller reject a stale shape
// from an older build.
export function useLocalStorageState<T>(
  key: string,
  initial: T,
  validate?: (value: unknown) => value is T
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return validate ? (validate(parsed) ? parsed : initial) : (parsed as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable — the in-memory value still works this session.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
