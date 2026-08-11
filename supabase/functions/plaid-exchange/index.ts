import { requireUser, serviceClient } from "../_shared/auth.ts";
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  plaidPost,
  type PlaidAccount,
} from "../_shared/plaid.ts";

/**
 * Exchanges the one-time public_token from Plaid Link for a long-lived
 * access_token, stores it server-side, and records the accounts it exposes.
 *
 * The access_token is written to plaid_item_secrets and is never included
 * in the response — the browser only learns which accounts were found so it
 * can ask the user to map them.
 */
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await requireUser(request);
    const body = await request.json();
    const publicToken: string | undefined = body?.public_token;
    if (!publicToken) throw Object.assign(new Error("public_token is required"), { status: 400 });

    const exchanged = await plaidPost<{ access_token: string; item_id: string }>(
      "/item/public_token/exchange",
      { public_token: publicToken },
    );

    const institutionId: string | null = body?.institution?.institution_id ?? null;
    const institutionName: string | null = body?.institution?.name ?? null;

    const service = serviceClient();

    // Upsert on item_id so re-linking the same institution repairs the
    // existing row rather than creating a duplicate connection.
    const { error: itemError } = await service.from("plaid_items").upsert(
      {
        user_id: user.id,
        item_id: exchanged.item_id,
        institution_id: institutionId,
        institution_name: institutionName,
        status: "active",
        last_error: null,
      },
      { onConflict: "item_id" },
    );
    if (itemError) throw itemError;

    const { error: secretError } = await service.from("plaid_item_secrets").upsert(
      {
        item_id: exchanged.item_id,
        access_token: exchanged.access_token,
        // Null cursor means the next sync pulls full history for this item.
        transactions_cursor: null,
      },
      { onConflict: "item_id" },
    );
    if (secretError) throw secretError;

    // Record the accounts so the user can map each one to a local account
    // or debt. Nothing syncs until that mapping exists.
    const accountsResult = await plaidPost<{ accounts: PlaidAccount[] }>("/accounts/get", {
      access_token: exchanged.access_token,
    });

    const links = accountsResult.accounts.map((account) => ({
      user_id: user.id,
      item_id: exchanged.item_id,
      plaid_account_id: account.account_id,
      plaid_account_name: account.official_name ?? account.name,
      plaid_account_mask: account.mask ?? null,
      plaid_account_type: account.type,
      plaid_account_subtype: account.subtype ?? null,
    }));

    if (links.length) {
      const { error: linkError } = await service
        .from("plaid_account_links")
        .upsert(links, { onConflict: "plaid_account_id" });
      if (linkError) throw linkError;
    }

    return jsonResponse({
      item_id: exchanged.item_id,
      institution_name: institutionName,
      accounts: accountsResult.accounts.map((account) => ({
        plaid_account_id: account.account_id,
        name: account.official_name ?? account.name,
        mask: account.mask ?? null,
        type: account.type,
        subtype: account.subtype ?? null,
      })),
    });
  } catch (error) {
    return errorResponse(error, (error as { status?: number })?.status ?? 500);
  }
});
