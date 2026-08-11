import { assertOwnsItem, requireUser, serviceClient } from "../_shared/auth.ts";
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  plaidPost,
  toAppAmount,
  toAppCategory,
  toAppTxType,
  type PlaidTransaction,
} from "../_shared/plaid.ts";

/**
 * Pulls new transactions for a connection and files them for review.
 *
 * Deliberately does NOT write to `transactions` or touch balances. Synced
 * rows land in statement_imports / import_items, the same queue statement
 * uploads use, because the product rule is that nothing reaches the books
 * without confirmation — and that shouldn't stop being true just because
 * the data arrived automatically.
 *
 * Uses /transactions/sync, which is cursor-based: each call returns what
 * changed since the stored cursor, so this is safe to call repeatedly.
 */
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const itemId: string | undefined = body?.item_id;
    if (!itemId) throw Object.assign(new Error("item_id is required"), { status: 400 });

    const service = serviceClient();
    await assertOwnsItem(service, user.id, itemId);

    const { data: secret, error: secretError } = await service
      .from("plaid_item_secrets")
      .select("access_token, transactions_cursor")
      .eq("item_id", itemId)
      .maybeSingle();
    if (secretError) throw secretError;
    if (!secret) throw Object.assign(new Error("Connection not found"), { status: 404 });

    // Only accounts the user has mapped are synced. An unmapped account has
    // nowhere sensible to post to, so importing it would create orphans.
    const { data: links, error: linksError } = await service
      .from("plaid_account_links")
      .select("plaid_account_id, account_id, debt_id, sync_enabled")
      .eq("item_id", itemId);
    if (linksError) throw linksError;

    const syncable = new Map(
      (links ?? [])
        .filter((l) => l.sync_enabled && (l.account_id || l.debt_id))
        .map((l) => [l.plaid_account_id, l]),
    );

    // ---- Pull every page Plaid has for us -------------------------------
    let cursor: string | null = secret.transactions_cursor;
    let hasMore = true;
    const added: PlaidTransaction[] = [];
    const modified: PlaidTransaction[] = [];
    const removed: string[] = [];
    // Bounded so a broken cursor cannot spin forever on a metered API.
    let pages = 0;

    while (hasMore && pages < 50) {
      const page = await plaidPost<{
        added: PlaidTransaction[];
        modified: PlaidTransaction[];
        removed: { transaction_id: string }[];
        next_cursor: string;
        has_more: boolean;
      }>("/transactions/sync", {
        access_token: secret.access_token,
        ...(cursor ? { cursor } : {}),
        count: 500,
      });

      added.push(...page.added);
      modified.push(...page.modified);
      removed.push(...page.removed.map((r) => r.transaction_id));
      cursor = page.next_cursor;
      hasMore = page.has_more;
      pages += 1;
    }

    // Plaid replays a modified transaction in full, so for a review queue it
    // is just another candidate row.
    const candidates = [...added, ...modified].filter((t) => syncable.has(t.account_id));

    if (!candidates.length) {
      await service
        .from("plaid_item_secrets")
        .update({ transactions_cursor: cursor })
        .eq("item_id", itemId);
      await service
        .from("plaid_items")
        .update({ last_synced_at: new Date().toISOString(), last_error: null, status: "active" })
        .eq("item_id", itemId);

      return jsonResponse({ imported: 0, removed: removed.length, import_id: null });
    }

    // ---- Skip anything already on the books ------------------------------
    // Plaid's transaction_id is stable, so storing it in import_items.raw
    // gives an exact dedup key rather than fuzzy date/amount matching.
    const ids = candidates.map((t) => t.transaction_id);
    const { data: seen, error: seenError } = await service
      .from("import_items")
      .select("raw")
      .eq("user_id", user.id)
      .in("raw", ids);
    if (seenError) throw seenError;

    const alreadySeen = new Set((seen ?? []).map((row) => row.raw));
    const fresh = candidates.filter((t) => !alreadySeen.has(t.transaction_id));

    if (!fresh.length) {
      await service
        .from("plaid_item_secrets")
        .update({ transactions_cursor: cursor })
        .eq("item_id", itemId);
      await service
        .from("plaid_items")
        .update({ last_synced_at: new Date().toISOString(), last_error: null, status: "active" })
        .eq("item_id", itemId);

      return jsonResponse({ imported: 0, removed: removed.length, import_id: null, skipped: candidates.length });
    }

    // ---- File them as an import for review -------------------------------
    const dates = fresh.map((t) => t.date).sort();
    const { data: importRow, error: importError } = await service
      .from("statement_imports")
      .insert({
        user_id: user.id,
        file_name: `Bank sync · ${new Date().toLocaleDateString("en-CA")}`,
        file_type: "plaid",
        file_size: 0,
        doc_kind: "bank",
        detected: { source: "plaid", item_id: itemId, pages },
        status: "pending",
        items_total: fresh.length,
        statement_start: dates[0] ?? null,
        statement_end: dates[dates.length - 1] ?? null,
      })
      .select()
      .single();
    if (importError) throw importError;

    const items = fresh.map((t) => ({
      user_id: user.id,
      import_id: importRow.id,
      item_type: "transaction",
      occurred_on: t.date,
      description: t.merchant_name ?? t.name,
      // Plaid signs outflows positive; this app stores them negative.
      amount: toAppAmount(t.amount),
      tx_type: toAppTxType(t),
      category: toAppCategory(t),
      // Pending transactions can still change, so they start lower.
      confidence: t.pending ? 0.6 : 0.95,
      decision: "accept",
      raw: t.transaction_id,
    }));

    const { error: itemsError } = await service.from("import_items").insert(items);
    if (itemsError) throw itemsError;

    await service
      .from("plaid_item_secrets")
      .update({ transactions_cursor: cursor })
      .eq("item_id", itemId);
    await service
      .from("plaid_items")
      .update({ last_synced_at: new Date().toISOString(), last_error: null, status: "active" })
      .eq("item_id", itemId);

    return jsonResponse({
      imported: items.length,
      skipped: candidates.length - fresh.length,
      removed: removed.length,
      import_id: importRow.id,
    });
  } catch (error) {
    // Record the failure against the connection so the UI can show it.
    const code = (error as { plaidErrorCode?: string })?.plaidErrorCode;
    try {
      const body = await request.clone().json().catch(() => ({}));
      if (body?.item_id) {
        await serviceClient()
          .from("plaid_items")
          .update({
            last_error: error instanceof Error ? error.message : "Sync failed",
            status: code === "ITEM_LOGIN_REQUIRED" ? "login_required" : "error",
          })
          .eq("item_id", body.item_id);
      }
    } catch {
      // Recording the error must never mask the original failure.
    }
    return errorResponse(error, (error as { status?: number })?.status ?? 500);
  }
});
