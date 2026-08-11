/**
 * Minimal Plaid REST client and shared helpers for the Edge Functions.
 *
 * Hand-rolled rather than using the Plaid SDK: Edge Functions run on Deno,
 * the surface used here is four endpoints, and a fetch wrapper avoids
 * pinning a Node-oriented dependency into the runtime.
 *
 * PLAID_CLIENT_ID / PLAID_SECRET are read from the function environment
 * (Supabase secrets). They must never be sent to the browser.
 */

const PLAID_ENV = Deno.env.get("PLAID_ENV") ?? "sandbox";

const BASE_URLS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

export function plaidBaseUrl() {
  const url = BASE_URLS[PLAID_ENV];
  if (!url) throw new Error(`Unknown PLAID_ENV "${PLAID_ENV}" (expected sandbox or production)`);
  return url;
}

export function plaidCredentials() {
  const client_id = Deno.env.get("PLAID_CLIENT_ID");
  const secret = Deno.env.get("PLAID_SECRET");
  if (!client_id || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set as Supabase secrets");
  }
  return { client_id, secret };
}

/** POSTs to Plaid with credentials injected. Throws on a Plaid error body. */
export async function plaidPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${plaidBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...plaidCredentials(), ...body }),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Plaid ${path} returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const err = parsed as { error_code?: string; error_message?: string; error_type?: string };
    // error_code is the part worth surfacing — ITEM_LOGIN_REQUIRED and friends
    // are actionable, everything else is noise.
    throw Object.assign(
      new Error(err.error_message ?? `Plaid ${path} failed with ${response.status}`),
      { plaidErrorCode: err.error_code, plaidErrorType: err.error_type, status: response.status },
    );
  }

  return parsed as T;
}

export type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  /**
   * Plaid signs this the OPPOSITE way to this app: Plaid uses positive for
   * money leaving the account, while quick-add stores outflows negative
   * (`signed = type === "income" ? amt : -amt`). Always convert with
   * toAppAmount() rather than using this directly.
   */
  amount: number;
  iso_currency_code: string | null;
  date: string;
  authorized_date?: string | null;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
  pending_transaction_id?: string | null;
  personal_finance_category?: { primary?: string; detailed?: string } | null;
};

export type PlaidAccount = {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances?: {
    current?: number | null;
    available?: number | null;
    iso_currency_code?: string | null;
  };
};

/**
 * Converts a Plaid amount into this app's sign convention.
 *
 * Plaid: positive = money out of the account.
 * This app: negative = money out (see quick-add-dialog).
 *
 * Getting this backwards would invert every synced transaction, which is
 * the same class of silent error that previously left the budget totals
 * negative and disabled every over-budget warning.
 */
export function toAppAmount(plaidAmount: number) {
  return -plaidAmount;
}

/** Maps a Plaid transaction onto this app's transaction type. */
export function toAppTxType(transaction: PlaidTransaction): "income" | "expense" | "debt_payment" {
  const category = transaction.personal_finance_category?.primary ?? "";
  if (category === "INCOME") return "income";
  if (category === "LOAN_PAYMENTS") return "debt_payment";
  // Plaid positive means money left the account, so anything non-positive is
  // money arriving even when the category is unhelpful.
  return transaction.amount <= 0 ? "income" : "expense";
}

/** Human-readable category for the review screen. */
export function toAppCategory(transaction: PlaidTransaction): string | null {
  const detailed = transaction.personal_finance_category?.detailed;
  if (!detailed) return null;
  // "FOOD_AND_DRINK_GROCERIES" -> "Food And Drink Groceries"
  return detailed
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Never leak a Plaid error body wholesale — it can echo request details. */
export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const code = (error as { plaidErrorCode?: string })?.plaidErrorCode;
  console.error("plaid function error:", message, code ?? "");
  return jsonResponse({ error: message, code: code ?? null }, status);
}
