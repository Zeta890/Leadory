import { z } from "zod";
import { route, json, body, owned, logEvent } from "@/lib/api";
import { STAGES } from "@/lib/domain/types";
import { normalizeInstagram } from "@/lib/domain/normalize";
import { rescoreLead } from "@/lib/services/score-lead";
import type { LeadRow } from "@/lib/db-types";

type P = { id: string };

const Patch = z.object({
  stage: z.enum(STAGES).optional(),
  notes: z.string().max(10_000).optional(),
  phone_verified: z.boolean().optional(),
  instagram: z.string().max(80).nullable().optional(),
  instagram_verified: z.boolean().optional(),
  /** Validação humana do site: URL confirmada ou confirmação de ausência. */
  website_review: z.discriminatedUnion("decision", [
    z.object({ decision: z.literal("confirmed"), url: z.url().max(300) }),
    z.object({ decision: z.literal("none") }),
    z.object({ decision: z.literal("reset") }),
  ]).optional(),
  confirmed_services: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  deal_value_cents: z.number().int().min(0).max(1_000_000_000).optional(),
});

export const GET = route<P>(async (_req, ctx, { id }) => {
  const lead = await owned<LeadRow>(ctx, "leads", id);
  const [events, audits, consents, previews, messages, deals] = await Promise.all([
    ctx.supabase.from("lead_events").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("lead_audits").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(5),
    ctx.supabase.from("consents").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("previews").select("id,slug,status,published_at,created_at").eq("lead_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("messages").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("deals").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);
  return json({ lead, events: events.data, audits: audits.data, consents: consents.data, previews: previews.data, messages: messages.data, deals: deals.data });
});

export const PATCH = route<P>(async (req, ctx, { id }) => {
  const lead = await owned<LeadRow>(ctx, "leads", id);
  const p = await body(req, Patch);
  const upd: Partial<LeadRow> = {};
  if (p.stage && p.stage !== lead.stage) upd.stage = p.stage;
  if (p.notes !== undefined) upd.notes = p.notes;
  if (p.phone_verified !== undefined) upd.phone_verified = p.phone_verified;
  if (p.instagram !== undefined) { upd.instagram = normalizeInstagram(p.instagram); if (!upd.instagram) upd.instagram_verified = false; }
  if (p.instagram_verified !== undefined) upd.instagram_verified = p.instagram_verified && Boolean(upd.instagram ?? lead.instagram);
  if (p.confirmed_services) upd.confirmed_services = p.confirmed_services;
  if (p.website_review) {
    if (p.website_review.decision === "confirmed") { upd.website = p.website_review.url; upd.website_status = "identified"; }
    else if (p.website_review.decision === "none") upd.website_status = "not_identified";
    else upd.website_status = "inconclusive";
  }
  const { data, error } = await ctx.supabase.from("leads").update(upd).eq("id", id).eq("workspace_id", ctx.workspaceId).select("*").single();
  if (error) return json({ error: error.message }, 400);

  if (upd.stage) {
    await logEvent(ctx, id, "stage_changed", { from: lead.stage, to: upd.stage });
    // Negócio: vendido → deal ganho; perdido → deals abertos perdidos.
    if (upd.stage === "won") {
      const { data: open } = await ctx.supabase.from("deals").select("id").eq("lead_id", id).eq("status", "open").limit(1);
      if (open?.[0]) await ctx.supabase.from("deals").update({ status: "won", closed_at: new Date().toISOString(), ...(p.deal_value_cents !== undefined ? { value_cents: p.deal_value_cents } : {}) }).eq("id", open[0].id);
      else if (p.deal_value_cents !== undefined) await ctx.supabase.from("deals").insert({ workspace_id: ctx.workspaceId, lead_id: id, value_cents: p.deal_value_cents, status: "won", closed_at: new Date().toISOString() });
    } else if (upd.stage === "lost") {
      await ctx.supabase.from("deals").update({ status: "lost", closed_at: new Date().toISOString() }).eq("lead_id", id).eq("status", "open");
    }
  }
  if (p.deal_value_cents !== undefined && upd.stage !== "won") {
    const { data: open } = await ctx.supabase.from("deals").select("id").eq("lead_id", id).eq("status", "open").limit(1);
    if (open?.[0]) await ctx.supabase.from("deals").update({ value_cents: p.deal_value_cents }).eq("id", open[0].id);
    else await ctx.supabase.from("deals").insert({ workspace_id: ctx.workspaceId, lead_id: id, value_cents: p.deal_value_cents, status: "open" });
    await logEvent(ctx, id, "deal_value", { value_cents: p.deal_value_cents });
  }
  if (p.notes !== undefined && p.notes !== lead.notes) await logEvent(ctx, id, "note_updated", { length: p.notes.length });
  if (p.website_review) await logEvent(ctx, id, "website_review", p.website_review);
  if (p.instagram_verified !== undefined || p.instagram !== undefined) await logEvent(ctx, id, "instagram_review", { handle: data.instagram, verified: data.instagram_verified });
  if (p.phone_verified !== undefined) await logEvent(ctx, id, "phone_review", { verified: p.phone_verified });
  const scored = await rescoreLead(ctx, data as LeadRow);
  return json({ lead: { ...data, score: scored.score, score_breakdown: scored.breakdown } });
});

export const DELETE = route<P>(async (_req, ctx, { id }) => {
  await owned(ctx, "leads", id);
  const { data } = await ctx.supabase.from("leads").delete().eq("id", id).eq("workspace_id", ctx.workspaceId).select("id");
  if (!data?.length) return json({ error: "Somente owner/admin pode excluir" }, 403);
  return json({ ok: true });
});
