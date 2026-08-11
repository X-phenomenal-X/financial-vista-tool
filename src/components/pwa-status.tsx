import { useEffect, useState } from "react";
import { ArrowUpCircle, Download, Share, SquarePlus, WifiOff, X } from "lucide-react";

import { usePwa } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";

const INSTALL_DISMISSED_KEY = "wealthpilot:install-dismissed";

/**
 * Connection, update, and install state, stacked bottom-centre so it never
 * collides with the fixed header, dock, or quick-add button.
 */
export function PwaStatus({ showInstallPrompt = false }: { showInstallPrompt?: boolean }) {
  const { online, updateAvailable, applyUpdate, installed, installMethod, install } = usePwa();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1");
  }, []);

  function dismissInstall() {
    setDismissed(true);
    if (typeof window !== "undefined") window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  }

  const offerInstall =
    showInstallPrompt &&
    !dismissed &&
    !installed &&
    (installMethod === "prompt" || installMethod === "ios-safari");

  if (online && !updateAvailable && !offerInstall) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {!online && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-warning/25 bg-card/95 px-4 py-2.5 text-xs font-medium text-warning shadow-elevated backdrop-blur-xl">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Offline — showing saved data, edits won't save</span>
        </div>
      )}

      {updateAvailable && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-card/95 px-4 py-3 shadow-elevated backdrop-blur-xl">
          <ArrowUpCircle className="h-5 w-5 shrink-0 text-accent" />
          <div className="min-w-0 text-xs">
            <div className="font-semibold text-foreground">A new version is ready</div>
            <div className="text-muted-foreground">Reload to get the latest changes.</div>
          </div>
          <Button size="sm" className="shrink-0 rounded-xl" onClick={applyUpdate}>
            Reload
          </Button>
        </div>
      )}

      {offerInstall && (
        <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-card/95 p-4 shadow-elevated backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-grad text-primary-foreground shadow-card">
              <Download className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Install Wealthpilot</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {installMethod === "ios-safari"
                  ? "Add it to your home screen for a full-screen app that opens straight to your dashboard."
                  : "Get a home-screen app that opens straight to your dashboard, even on a weak connection."}
              </p>
            </div>
            <button
              onClick={dismissInstall}
              aria-label="Dismiss install prompt"
              className="ui-button -mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {installMethod === "ios-safari" ? (
            <ol className="mt-3 space-y-1.5 rounded-xl bg-white/[0.035] px-3 py-2.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <Share className="h-3.5 w-3.5 shrink-0 text-accent" />
                Tap the Share button in Safari
              </li>
              <li className="flex items-center gap-2">
                <SquarePlus className="h-3.5 w-3.5 shrink-0 text-accent" />
                Choose “Add to Home Screen”
              </li>
            </ol>
          ) : (
            <Button
              className="mt-3 w-full rounded-xl"
              onClick={async () => {
                const accepted = await install();
                if (accepted) dismissInstall();
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Install app
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
