import { z } from "zod";
import { route, json, body, owned, logEvent, HttpError } from "@/lib/api";
import { nextSendSlot, idempotencyKey } from "@/lib/domain/whatsapp/schedule";
import { loadEligibility } from "@/lib/services/eligibility";
import { createHash } from "node:crypto";
import type { MessageRow } from "@/lib/db-types";

type P = { id: string };

const Action = z.object({ action: z.enum(["approve", "schedule", "cancel"]), not_before: z.iso.datetime().optional() });

/** Fluxo: rascunho → aprovação humana → agendamento (janela seg–sex 09–17) → envio pelo worker. */
export const PATCH = route<P>(async (req, ctx, { id }) => {
  const m = await owned<MessageRow & { workspace_id: string }>(ctx, "messages", id);
  const { action, not_before } = await body(req, Action);

  if (action === "cancel") {
    if (!["draft", "approved", "scheduled"].includes(m.status)) throw new HttpError(409, "Mensagem já processada");
    await ctx.supabase.from("messages").update({ status: "cancelled", last_error: "Cancelada pelo usuário" }).eq("id", id);
    await logEvent(ctx, m.lead_id, "message_cancelled", { message_id: id });
    return json({ ok: true });
  }

  if (action === "approve") {
    if (m.status !== "draft") throw new HttpError(409, "Apenas rascunhos podem ser aprovados");
    const { data } = await ctx.supabase.from("messages").update({ status: "approved", approved_by: ctx.userId, approved_at: new Date().toISOString() }).eq("id", id).select("*").single();
    await logEvent(ctx, m.lead_id, "message_approved", { message_id: id });
    return json({ message: data });
  }

  // schedule
  if (m.status !== "approved") throw new HttpError(409, "Aprove a mensagem antes de agendar");
  const elig = await loadEligibility(ctx.supabase, ctx.workspaceId, m);
  if (!elig.ok) throw new HttpError(412, "Envio não permitido", elig.reasons);
  const when = nextSendSlot(not_before ? new Date(Math.max(Date.now(), Date.parse(not_before))) : new Date());
  const key = idempotencyKey(m.lead_id, createHash("sha256").update(m.body).digest("hex").slice(0, 16), "outreach");
  const { data, error } = await ctx.supabase.from("messages").update({ status: "scheduled", scheduled_for: when.toISOString(), idempotency_key: key, template_name: elig.templateName }).eq("id", id).select("*").single();
  if (error) throw new HttpError(error.code === "23505" ? 409 : 412, error.code === "23505" ? "Mensagem idêntica já agendada para este lead" : error.message);
  await logEvent(ctx, m.lead_id, "message_scheduled", { message_id: id, scheduled_for: when.toISOString() });
  return json({ message: data });
});
