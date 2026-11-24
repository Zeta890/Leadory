import { z } from "zod";
import { route, json, body, owned, logEvent, HttpError } from "@/lib/api";
import { generateMessage } from "@/lib/services/ai-message";
import { validateMessage } from "@/lib/domain/message";
import type { LeadRow, Workspace } from "@/lib/db-types";

type P = { id: string };

async function context(ctx: Parameters<Parameters<typeof route>[0]>[1], lead: LeadRow) {
  const { data: ws } = await ctx.supabase.from("workspaces").select("*").eq("id", ctx.workspaceId).single<Workspace>();
  const { data: pv } = await ctx.supabase.from("previews").select("slug").eq("lead_id", lead.id).eq("status", "published").limit(1);
  return { ws, previewReady: Boolean(pv?.length) };
}

/** Gera rascunho de mensagem (agente). Nunca envia. */
export const POST = route<P>(async (_req, ctx, { id }) => {
  const lead = await owned<LeadRow>(ctx, "leads", id);
  const { ws, previewReady } = await context(ctx, lead);
  if (!ws?.sender_name) throw new HttpError(412, "Defina o nome do remetente em Integrações antes de gerar mensagens.");
  const r = await generateMessage(
    { senderName: ws.sender_name, senderRole: ws.sender_role, businessName: lead.name, previewReady },
    { city: "Florianópolis", hasInstagram: Boolean(lead.instagram_verified) },
  );
  const { data, error } = await ctx.supabase.from("messages").insert({ workspace_id: ctx.workspaceId, lead_id: id, direction: "outbound", body: r.text, status: "draft" }).select("*").single();
  if (error) throw new HttpError(400, error.message);
  await logEvent(ctx, id, "message_drafted", { source: r.source, preview_ready: previewReady });
  return json({ message: data, source: r.source, warning: "error" in r ? r.error : undefined }, 201);
});

/** Edição manual do rascunho — revalidada. */
const Edit = z.object({ message_id: z.uuid(), body: z.string().trim().min(1).max(350) });
export const PATCH = route<P>(async (req, ctx, { id }) => {
  const lead = await owned<LeadRow>(ctx, "leads", id);
  const p = await body(req, Edit);
  const { previewReady } = await context(ctx, lead);
  const v = validateMessage(p.body, { previewReady, businessName: lead.name });
  if (!v.ok) throw new HttpError(422, "Mensagem reprovada", v.issues);
  const { data, error } = await ctx.supabase.from("messages").update({ body: p.body, status: "draft", approved_at: null, approved_by: null })
    .eq("id", p.message_id).eq("lead_id", id).eq("workspace_id", ctx.workspaceId).in("status", ["draft", "approved"]).select("*").single();
  if (error || !data) throw new HttpError(409, "Somente rascunhos podem ser editados");
  return json({ message: data });
});
