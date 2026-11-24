import { z } from "zod";
import { route, json, body, owned, logEvent, HttpError } from "@/lib/api";
import { buildPreview } from "@/lib/domain/preview";
import type { LeadRow } from "@/lib/db-types";

type P = { id: string };

/** Gera (ou regenera) rascunho de prévia a partir de dados conhecidos. */
export const POST = route<P>(async (_req, ctx, { id }) => {
  const lead = await owned<LeadRow>(ctx, "leads", id);
  let city = "Florianópolis";
  if (lead.campaign_id) {
    const { data } = await ctx.supabase.from("campaigns").select("city").eq("id", lead.campaign_id).maybeSingle();
    if (data?.city) city = String(data.city).split(",")[0]!;
  }
  const content = buildPreview({
    businessName: lead.name, address: lead.address, phoneE164: lead.phone_e164, city,
    confirmedServices: lead.confirmed_services, instagram: lead.instagram_verified ? lead.instagram : null,
  });
  const { data, error } = await ctx.supabase.from("previews").insert({ workspace_id: ctx.workspaceId, lead_id: id, content, status: "draft" }).select("id,slug,status,content").single();
  if (error) throw new HttpError(400, error.message);
  await logEvent(ctx, id, "preview_created", { preview_id: data.id });
  return json({ preview: data }, 201);
});

const Publish = z.object({ preview_id: z.uuid(), action: z.enum(["publish", "archive"]) });

export const PATCH = route<P>(async (req, ctx, { id }) => {
  await owned(ctx, "leads", id);
  const p = await body(req, Publish);
  const patch = p.action === "publish"
    ? { status: "published", published_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString() }
    : { status: "archived" };
  const { data, error } = await ctx.supabase.from("previews").update(patch).eq("id", p.preview_id).eq("lead_id", id).eq("workspace_id", ctx.workspaceId).select("id,slug,status").single();
  if (error || !data) throw new HttpError(404, "Prévia não encontrada");
  await logEvent(ctx, id, `preview_${p.action}`, { preview_id: data.id });
  return json({ preview: data });
});
