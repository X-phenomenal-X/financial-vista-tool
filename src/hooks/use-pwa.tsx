import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallMethod = "prompt" | "ios-safari" | "manual" | "installed";

type PwaState = {
  /** A browser install prompt is queued and install() will show it. */
  canInstall: boolean;
  /** Running from the home screen rather than a browser tab. */
  installed: boolean;
  online: boolean;
  /** iOS never fires beforeinstallprompt, so it needs written instructions instead. */
  isIos: boolean;
  /** How this browser can install the app, so the UI can say the right thing. */
  installMethod: InstallMethod;
  /** A new service worker is waiting to take over. */
  updateAvailable: boolean;
  install: () => Promise<boolean>;
  applyUpdate: () => void;
  /** Drops cached rendered pages — call on sign-out. */
  clearPrivateCache: () => void;
};

const PwaContext = createContext<PwaState | null>(null);

/**
 * Drops the service worker's cache of rendered pages. Exported standalone as
 * well as on the context so sign-out paths outside the provider can call it.
 */
export function clearPrivateCache() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
}

function detectIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so touch points disambiguate it.
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function detectStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setOnline(navigator.onLine);
    setInstalled(detectStandalone());
    setIsIos(detectIos());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    // Covers the case where the app is launched straight from the home screen.
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (event: MediaQueryListEvent) => setInstalled(event.matches);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    standaloneQuery.addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      standaloneQuery.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // In dev the service worker would cache unhashed dev assets and produce
    // very confusing stale reloads, so it only runs in production builds.
    if (!import.meta.env.PROD) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }

    // On a first visit there is no controller yet, and the new worker's
    // clients.claim() fires controllerchange during its initial activation.
    // Reloading on that would bounce the page on every first load, so only
    // treat it as an update when a controller was already in charge.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) setWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // A worker reaching "installed" while one is already in control
            // means this is an update rather than the first install.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      })
      .catch(() => undefined);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome === "accepted";
  }, [deferred]);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    // The controllerchange listener reloads once the new worker takes over.
    waiting.postMessage({ type: "SKIP_WAITING" });
    setWaiting(null);
  }, [waiting]);

  const value = useMemo<PwaState>(() => {
    const installMethod: InstallMethod = installed
      ? "installed"
      : deferred
        ? "prompt"
        : isIos
          ? "ios-safari"
          : "manual";

    return {
      canInstall: deferred !== null,
      installed,
      online,
      isIos,
      installMethod,
      updateAvailable: waiting !== null,
      install,
      applyUpdate,
      clearPrivateCache,
    };
  }, [deferred, installed, online, isIos, waiting, install, applyUpdate]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) throw new Error("usePwa must be used inside a PwaProvider");
  return context;
}
