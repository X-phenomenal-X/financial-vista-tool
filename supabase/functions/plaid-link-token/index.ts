import { requireUser } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, plaidPost } from "../_shared/plaid.ts";

/**
 * Creates a short-lived link_token for Plaid Link.
 *
 * The token is scoped to the signed-in user and expires in minutes, so it
 * is safe to hand to the browser — unlike the access_token it eventually
 * leads to, which never leaves the server.
 *
 * Pass { item_id } to get a token in update mode, which is how a connection
 * in ITEM_LOGIN_REQUIRED gets repaired without being removed and re-added.
 */
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await requireUser(request);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const itemId: string | undefined = body?.item_id;

    const payload: Record<string, unknown> = {
      client_name: "Wealthpilot",
      user: { client_user_id: user.id },
      language: "en",
      // Canadian institutions. Adding other countries here changes which
      // banks Link will offer.
      country_codes: ["CA"],
    };

    const webhookUrl = Deno.env.get("PLAID_WEBHOOK_URL");
    if (webhookUrl) payload.webhook = webhookUrl;

    if (itemId) {
      // Update mode: re-authenticate an existing item. products must be
      // omitted, and the access_token identifies which connection to repair.
      const { serviceClient, assertOwnsItem } = await import("../_shared/auth.ts");
      const service = serviceClient();
      await assertOwnsItem(service, user.id, itemId);

      const { data, error } = await service
        .from("plaid_item_secrets")
        .select("access_token")
        .eq("item_id", itemId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw Object.assign(new Error("Connection not found"), { status: 404 });

      payload.access_token = data.access_token;
    } else {
      payload.products = ["transactions"];
    }

    const result = await plaidPost<{ link_token: string; expiration: string }>(
      "/link/token/create",
      payload,
    );

    return jsonResponse({ link_token: result.link_token, expiration: result.expiration });
  } catch (error) {
    return errorResponse(error, (error as { status?: number })?.status ?? 500);
  }
});
