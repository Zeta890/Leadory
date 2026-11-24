import { z } from "zod";
import { route, json, body, HttpError } from "@/lib/api";
import { normalizePhoneBR, normalizeName, normalizeInstagram } from "@/lib/domain/normalize";
import { rescoreLead } from "@/lib/services/score-lead";
import type { LeadRow } from "@/lib/db-types";

const ManualLead = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  website_status: z.enum(["inconclusive", "identified", "not_identified"]).default("inconclusive"),
  website: z.url().max(300).optional().or(z.literal("")),
  instagram: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  campaign_id: z.uuid().optional(),
});

export const GET = route(async (req, ctx) => {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 80);
  let query = ctx.supabase.from("leads").select("*").eq("workspace_id", ctx.workspaceId).order("score", { ascending: false }).limit(500);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ leads: data });
});

/** Cadastro manual (funcionalidade do piloto), com deduplicação por nome+telefone. */
export const POST = route(async (req, ctx) => {
  const i = await body(req, ManualLead);
  const phone = i.phone ? normalizePhoneBR(i.phone) : null;
  if (i.phone && !phone) throw new HttpError(422, "Telefone brasileiro inválido");
  const { data: same } = await ctx.supabase.from("leads").select("id,name,phone_e164").eq("workspace_id", ctx.workspaceId).ilike("name", i.name.replace(/[%_]/g, ""));
  if ((same ?? []).some((l) => normalizeName(l.name) === normalizeName(i.name) && (l.phone_e164 ?? null) === phone)) throw new HttpError(409, "Lead duplicado");
  const { data, error } = await ctx.supabase.from("leads").insert({
    workspace_id: ctx.workspaceId, campaign_id: i.campaign_id ?? null, name: i.name, phone_e164: phone, website: i.website || null,
    website_status: i.website_status, instagram: normalizeInstagram(i.instagram), address: i.address || null, source: "manual",
  }).select("*").single();
  if (error) throw new HttpError(error.code === "23505" ? 409 : 400, error.code === "23505" ? "Telefone já cadastrado" : error.message);
  await ctx.supabase.from("lead_events").insert({ workspace_id: ctx.workspaceId, lead_id: data.id, type: "created", payload: { source: "manual" } });
  await rescoreLead(ctx, data as LeadRow);
  return json({ lead: data }, 201);
});
