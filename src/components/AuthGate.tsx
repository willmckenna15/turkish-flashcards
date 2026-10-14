import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../lib/AuthContext";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400">Loading…</div>;
  }

  if (user) return <>{children}</>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const fn = mode === "signin" ? signIn : signUp;
    const message = await fn(email, password);
    setSubmitting(false);
    if (message) {
      setError(message);
    } else if (mode === "signup") {
      setInfo("Account created. Check your email to confirm, then sign in.");
      setMode("signin");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg shadow-neutral-900/5">
        <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-700 text-base font-semibold text-white shadow-sm shadow-red-900/20">
          T
        </span>
        <h1 className="mb-1 text-lg font-semibold tracking-tight text-neutral-900">Türkçe</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {mode === "signin" ? "Sign in to your word lists." : "Create an account to get started."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
          />

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {info && <p className="text-sm text-emerald-700">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800 disabled:opacity-50"
          >
            {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm text-neutral-500 hover:text-neutral-800"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
