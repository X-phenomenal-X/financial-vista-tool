import { useEffect } from "react";
import { dehydrate, hydrate, useQueryClient, type QueryClient } from "@tanstack/react-query";

/**
 * Persists the react-query cache to localStorage so the app still has data to
 * show when it opens without a connection.
 *
 * All reads go straight to Supabase (cross-origin), so the service worker can't
 * help here — without this, launching offline gives a working shell wrapped
 * around empty screens.
 *
 * Deliberately hand-rolled rather than pulling in a persistence package: the
 * cache is small and the rules below are specific to this app.
 */

const STORAGE_KEY = "wealthpilot:query-cache";
/** Bump when the cached shape changes so old payloads are discarded. */
const SCHEMA_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 1000;

type Persisted = {
  version: number;
  savedAt: number;
  /** Guards against showing one account's data to another. */
  userId: string;
  state: ReturnType<typeof dehydrate>;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function clearPersistedQueryCache() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage disabled — nothing to clear.
  }
}

/**
 * Restores cached data for `userId`. Returns true if anything was restored.
 */
export function hydrateQueryCache(queryClient: QueryClient, userId: string) {
  if (!isBrowser()) return false;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw) as Persisted;
    const stale = Date.now() - parsed.savedAt > MAX_AGE_MS;
    if (parsed.version !== SCHEMA_VERSION || stale || parsed.userId !== userId) {
      clearPersistedQueryCache();
      return false;
    }
    hydrate(queryClient, parsed.state);
    return true;
  } catch {
    clearPersistedQueryCache();
    return false;
  }
}

/**
 * Mirrors successful queries to storage. Returns an unsubscribe function.
 */
export function startQueryPersistence(queryClient: QueryClient, userId: string) {
  if (!isBrowser()) return () => undefined;

  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = () => {
    timer = null;
    try {
      const payload: Persisted = {
        version: SCHEMA_VERSION,
        savedAt: Date.now(),
        userId,
        // Errored and pending queries are worthless offline, and persisting a
        // failure would show a broken screen on the next launch.
        state: dehydrate(queryClient, {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        }),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Most likely a quota error. Drop the cache rather than leaving a
      // half-written entry that would fail to parse on the next launch.
      clearPersistedQueryCache();
    }
  };

  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    if (timer) return;
    timer = setTimeout(write, WRITE_DEBOUNCE_MS);
  });

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

/**
 * Restores the cache once the signed-in user is known, then keeps it mirrored.
 *
 * Waiting for the user id is safe because every data query is gated on it
 * anyway, and it keeps one account's cache from ever being shown to another.
 */
export function useQueryPersistence(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    hydrateQueryCache(queryClient, userId);
    return startQueryPersistence(queryClient, userId);
  }, [queryClient, userId]);
}
