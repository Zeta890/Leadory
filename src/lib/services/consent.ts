import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Revoga consentimentos, adiciona à supressão e cancela tudo que estiver pendente para o lead. */
export async function revokeAll(sb: SupabaseClient, ws: string, leadId: string, phone: string | null, reason: string) {
  const now = new Date().toISOString();
  await sb.from("consents").update({ status: "revoked", revoked_at: now }).eq("workspace_id", ws).eq("lead_id", leadId).eq("status", "granted");
  if (phone) await sb.from("suppression_list").upsert({ workspace_id: ws, phone_e164: phone, reason }, { onConflict: "workspace_id,phone_e164" });
  await cancelPending(sb, ws, leadId, reason);
}

export async function cancelPending(sb: SupabaseClient, ws: string, leadId: string, reason: string) {
  await sb.from("messages").update({ status: "cancelled", last_error: reason }).eq("workspace_id", ws).eq("lead_id", leadId).eq("direction", "outbound").in("status", ["draft", "approved", "scheduled"]);
}
