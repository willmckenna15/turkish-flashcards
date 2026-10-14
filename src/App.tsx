import { useState } from "react";
import { AuthProvider } from "./lib/AuthContext";
import { WordsProvider } from "./lib/WordsContext";
import { AuthGate } from "./components/AuthGate";
import { Layout, type Tab } from "./components/Layout";
import { WordList } from "./components/WordList";
import { VocabMode } from "./components/VocabMode";
import { GrammarMode } from "./components/GrammarMode";
import { StatsMode } from "./components/StatsMode";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";

function AppShell() {
  const [tab, setTab] = useState<Tab>("words");

  // Grammar Practice holds a batch of sentences that cost an AI round-trip to
  // produce, plus whatever you've typed into the current card. Unmounting it
  // threw all of that away, so nipping to the Words tab to add a word meant
  // generating the batch again from scratch. It stays mounted once opened and
  // is just hidden while another tab is on screen.
  //
  // The other tabs keep unmounting: they rebuild instantly from the word
  // list, and Vocab Study in particular registers a window-level ⌘Z handler
  // that must not stay live while it's off screen.
  const [grammarOpened, setGrammarOpened] = useState(false);
  if (tab === "grammar" && !grammarOpened) setGrammarOpened(true);

  return (
    <Layout tab={tab} onTabChange={setTab}>
      {tab === "words" && <WordList />}
      {tab === "vocab" && <VocabMode />}
      {grammarOpened && (
        <div className={tab === "grammar" ? undefined : "hidden"}>
          <GrammarMode />
        </div>
      )}
      {tab === "stats" && <StatsMode />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <WordsProvider>
          <AppShell />
        </WordsProvider>
      </AuthGate>
      <PwaUpdatePrompt />
    </AuthProvider>
  );
}
