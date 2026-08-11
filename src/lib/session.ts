import { supabase } from "@/integrations/supabase/client";
import { clearPrivateCache } from "@/hooks/use-pwa";
import { clearPersistedQueryCache } from "@/lib/query-persist";

/**
 * Single exit path for the app.
 *
 * Signing out has to do more than drop the Supabase session: the service worker
 * caches rendered pages and the query cache is mirrored to localStorage, and
 * neither should outlive the session. Route every sign-out button through here
 * so a new one can't quietly skip the cleanup.
 */
export async function signOutCompletely() {
  clearPrivateCache();
  clearPersistedQueryCache();
  await supabase.auth.signOut();
}
