import { z } from "zod";
import { route, json, body, owned, logEvent, HttpError } from "@/lib/api";
import type { LeadRow } from "@/lib/db-types";
import { revokeAll } from "@/lib/services/consent";

type P = { id: string };

const Grant = z.object({
  source: z.enum(["inbound_message", "web_form", "signed_document", "verbal_recorded", "other"]),
  evidence: z.string().trim().min(10).max(2000),
});

/** Registra opt-in verificável. A etapa "Autorizado" do CRM não substitui este registro. */
export const POST = route<P>(async (req, ctx, { id }) => {
  const lead = await owned<LeadRow>(ctx, "leads", id);
  if (!lead.phone_e164) throw new HttpError(422, "Lead sem telefone");
  const p = await body(req, Grant);
  const { data: sup } = await ctx.supabase.from("suppression_list").select("phone_e164").eq("workspace_id", ctx.workspaceId).eq("phone_e164", lead.phone_e164).maybeSingle();
  if (sup) throw new HttpError(409, "Número na lista de supressão (opt-out). Remova manualmente somente com novo consentimento documentado.");
  const { data, error } = await ctx.supabase.from("consents").insert({ workspace_id: ctx.workspaceId, lead_id: id, phone_e164: lead.phone_e164, source: p.source, evidence: p.evidence }).select("*").single();
  if (error) throw new HttpError(400, error.message);
  await logEvent(ctx, id, "consent_granted", { source: p.source });
  return json({ consent: data }, 201);
});

/** Revoga consentimento: suprime número e cancela mensagens pendentes. */
export const DELETE = route<P>(async (_req, ctx, { id }) => {
  const lead = await owned<LeadRow>(ctx, "leads", id);
  await revokeAll(ctx.supabase, ctx.workspaceId, id, lead.phone_e164, "Revogado manualmente");
  await logEvent(ctx, id, "consent_revoked", {});
  return json({ ok: true });
});
