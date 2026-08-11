import { supabase } from "@/integrations/supabase/client";

export async function logAudit(
  userId: string | undefined,
  entity: string,
  action: string,
  summary: string,
  details: Record<string, unknown> = {},
  entityId?: string | null,
) {
  if (!userId) return;
  try {
    await supabase.from("audit_log").insert({
      user_id: userId,
      entity,
      action,
      summary,
      details: details as never,
      entity_id: entityId ?? null,
    });
  } catch {
    /* auditing must never block the user action */
  }
}
