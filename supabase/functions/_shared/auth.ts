import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Two clients, deliberately kept apart.
 *
 * - The caller's client carries their JWT and is subject to RLS, so it is
 *   used only to establish who is asking.
 * - The service client bypasses RLS and is the only thing that can touch
 *   plaid_item_secrets. It must never be handed a value derived from the
 *   request without checking ownership first.
 */

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Resolves the signed-in user from the request's Authorization header.
 * Throws when the caller is anonymous, so every function fails closed.
 */
export async function requireUser(request: Request): Promise<{ id: string }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) throw Object.assign(new Error("Not signed in"), { status: 401 });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw Object.assign(new Error("Not signed in"), { status: 401 });
  return { id: data.user.id };
}

/**
 * Confirms an item belongs to the caller before any service-role work.
 * Without this, a signed-in user could pass someone else's item_id and the
 * service client would happily act on it.
 */
export async function assertOwnsItem(
  service: SupabaseClient,
  userId: string,
  itemId: string,
): Promise<void> {
  const { data, error } = await service
    .from("plaid_items")
    .select("item_id")
    .eq("item_id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw Object.assign(new Error("Connection not found"), { status: 404 });
}
