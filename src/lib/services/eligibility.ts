import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkSendEligibility } from "@/lib/domain/whatsapp/schedule";

/** Reúne do banco tudo que a regra de elegibilidade precisa. Usado ao agendar e de novo no momento do envio. */
export async function loadEligibility(sb: SupabaseClient, ws: string, msg: { lead_id: string; approved_at: string | null; template_name: string | null }) {
  const [{ data: w }, { data: lead }] = await Promise.all([
    sb.from("workspaces").select("sending_enabled, whatsapp_template_name").eq("id", ws).single(),
    sb.from("leads").select("phone_e164").eq("id", msg.lead_id).eq("workspace_id", ws).single(),
  ]);
  const phone = lead?.phone_e164 as string | null;
  const [{ data: consent }, { data: sup }, { data: inbound }] = await Promise.all([
    sb.from("consents").select("status,evidence").eq("workspace_id", ws).eq("lead_id", msg.lead_id).eq("phone_e164", phone ?? "").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("suppression_list").select("phone_e164").eq("workspace_id", ws).eq("phone_e164", phone ?? "").maybeSingle(),
    sb.from("messages").select("created_at").eq("workspace_id", ws).eq("lead_id", msg.lead_id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const lastInbound = inbound?.created_at ? new Date(inbound.created_at as string) : null;
  const insideWindow = Boolean(lastInbound && Date.now() - lastInbound.getTime() < 24 * 3600_000);
  // Uma resposta do contato depois da aprovação interrompe a sequência — exige nova aprovação humana.
  const replied = Boolean(lastInbound && msg.approved_at && lastInbound > new Date(msg.approved_at));
  const templateName = msg.template_name ?? (w?.whatsapp_template_name as string | null) ?? null;
  const result = checkSendEligibility({
    sendingEnabled: Boolean(w?.sending_enabled),
    consent: consent ? { status: consent.status as "granted" | "revoked", evidence: consent.evidence as string } : null,
    suppressed: Boolean(sup),
    humanApproved: Boolean(msg.approved_at),
    hasRepliedOrOptedOut: replied,
    insideCustomerServiceWindow: insideWindow,
    templateName,
  });
  if (!phone) result.reasons.push("Lead sem telefone");
  return { ...result, ok: result.ok && Boolean(phone), phone, insideWindow, templateName };
}
