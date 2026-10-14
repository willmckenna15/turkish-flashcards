import { useRegisterSW } from "virtual:pwa-register/react";

// Surfaces the two states vite-plugin-pwa's service worker can report:
// - offlineReady: the app shell just finished precaching for the first time
//   on this device, so Vocab Study will now work with zero connectivity.
// - needRefresh: a new build has been precached in the background (per
//   registerType: "autoUpdate" in vite.config.ts) but the open tab is still
//   running the old JS/CSS until it reloads. We never force-reload a tab out
//   from under the user — this is just a quiet, dismissible nudge, in
//   keeping with the app's "no intrusive UI" design direction.
export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new build once an hour for anyone who leaves a tab open
      // for a long time; vite-plugin-pwa doesn't poll on its own.
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => {
          // Offline or otherwise unreachable — nothing to do, try again later.
        });
      }, 60 * 60 * 1000);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  function dismiss() {
    setOfflineReady(false);
    setNeedRefresh(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-700 shadow-lg shadow-neutral-900/10">
        <span>
          {needRefresh
            ? "An update is ready."
            : "Vocab Study is now available offline on this device."}
        </span>
        {needRefresh && (
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="rounded-md bg-red-700 px-3 py-1 font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800"
          >
            Reload
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="text-neutral-400 transition hover:text-neutral-700"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
