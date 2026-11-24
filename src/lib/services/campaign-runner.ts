import "server-only";
import { runDiscovery } from "@/lib/discovery/engine";
import { GooglePlacesProvider } from "@/lib/discovery/google-places";
import { ProviderError } from "@/lib/discovery/provider";
import { env } from "@/lib/env";
import type { Ctx } from "@/lib/session";
import type { CampaignRow } from "@/lib/db-types";
import { HttpError } from "@/lib/api";

const PLACES_CONTENT_TTL_DAYS = 30;

export async function monthlyRequestsUsed(ctx: Ctx) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await ctx.supabase.from("api_usage").select("units").eq("workspace_id", ctx.workspaceId).eq("provider", "google_places").gte("created_at", start.toISOString());
  return (data ?? []).reduce((s, r) => s + (r.units as number), 0);
}

export async function startCampaign(ctx: Ctx, c: CampaignRow) {
  if (!env.googlePlacesKey) throw new HttpError(412, "GOOGLE_PLACES_API_KEY não configurada no servidor. Nenhum resultado será simulado.");
  if (c.status === "running") throw new HttpError(409, "Campanha já em execução");

  const { data: ws } = await ctx.supabase.from("workspaces").select("monthly_request_budget").eq("id", ctx.workspaceId).single();
  const used = await monthlyRequestsUsed(ctx);
  const remainingBudget = Math.max(0, (ws?.monthly_request_budget ?? 0) - used);
  const maxRequests = Math.min(c.max_requests - c.requests_used, remainingBudget);
  if (maxRequests <= 0) throw new HttpError(402, "Orçamento de requisições esgotado (mensal ou da campanha).");

  // Chaves já existentes no workspace evitam reinserir empresas e permitem retomar após pausa.
  const { data: existing } = await ctx.supabase.from("leads").select("source,source_id,phone_e164").eq("workspace_id", ctx.workspaceId);
  const keys = (existing ?? []).flatMap((l) => [l.source_id ? `src:${l.source}:${l.source_id}` : null, l.phone_e164 ? `tel:${l.phone_e164}` : null].filter(Boolean) as string[]);
  const { count: alreadyInCampaign } = await ctx.supabase.from("leads").select("id", { count: "exact", head: true }).eq("campaign_id", c.id);
  const remainingSlots = c.max_companies - (alreadyInCampaign ?? 0);
  if (remainingSlots <= 0) {
    await ctx.supabase.from("campaigns").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", c.id);
    return { inserted: 0, status: "completed" as const };
  }

  await ctx.supabase.from("campaigns").update({ status: "running", started_at: c.started_at ?? new Date().toISOString(), last_error: null }).eq("id", c.id).eq("workspace_id", ctx.workspaceId);

  const provider = new GooglePlacesProvider(env.googlePlacesKey);
  let lastReq = 0;
  const run = await runDiscovery(
    provider,
    {
      niche: c.niche, city: c.city, center: { lat: c.center_lat, lng: c.center_lng }, radiusKm: c.radius_km, maxCompanies: remainingSlots,
      prioritizeNoWebsite: c.prioritize_no_website, requireInstagram: c.require_instagram, requireBusinessPhone: c.require_business_phone,
      priorityKeywords: c.priority_keywords, queryVariants: c.query_variants.length ? c.query_variants : [`${c.niche} em ${c.city}`],
    },
    {
      maxRequests,
      existingKeys: keys,
      onProgress: async (p) => {
        const delta = p.requests - lastReq;
        lastReq = p.requests;
        await ctx.supabase.from("api_usage").insert({ workspace_id: ctx.workspaceId, campaign_id: c.id, provider: "google_places", units: delta, cost_cents: delta * env.placesCostCentsPerRequest });
        await ctx.supabase.from("campaigns").update({ requests_used: c.requests_used + p.requests, found_count: (alreadyInCampaign ?? 0) + p.accepted }).eq("id", c.id);
      },
      shouldStop: async () => {
        const { data } = await ctx.supabase.from("campaigns").select("status").eq("id", c.id).single();
        return data?.status !== "running";
      },
    },
  );
  if (run.requests > lastReq) {
    const delta = run.requests - lastReq;
    await ctx.supabase.from("api_usage").insert({ workspace_id: ctx.workspaceId, campaign_id: c.id, provider: "google_places", units: delta, cost_cents: delta * env.placesCostCentsPerRequest });
  }

  const now = new Date();
  const expires = new Date(now.getTime() + PLACES_CONTENT_TTL_DAYS * 86_400_000).toISOString();
  const rows = run.accepted.map((b) => ({
    workspace_id: ctx.workspaceId, campaign_id: c.id, name: b.name.slice(0, 200), address: b.address, lat: b.location?.lat, lng: b.location?.lng,
    distance_km: b.distanceKm, phone_e164: b.phoneE164, website: b.website, website_status: "unknown", rating: b.rating, review_count: b.reviewCount,
    types: b.types.slice(0, 20), source: b.source, source_id: b.sourceId, source_url: b.sourceUrl, source_retrieved_at: now.toISOString(), source_expires_at: expires,
  }));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const { data, error } = await ctx.supabase.from("leads").upsert(rows.slice(i, i + 50), { onConflict: "workspace_id,source,source_id", ignoreDuplicates: true }).select("id");
    if (error) console.error("[campaign] insert", error.message);
    inserted += data?.length ?? 0;
    if (data?.length) await ctx.supabase.from("lead_events").insert(data.map((d) => ({ workspace_id: ctx.workspaceId, lead_id: d.id, type: "discovered", payload: { campaign_id: c.id, source: "google_places" } })));
  }

  const { data: cur } = await ctx.supabase.from("campaigns").select("status").eq("id", c.id).single();
  const paused = cur?.status === "paused";
  const total = (alreadyInCampaign ?? 0) + inserted;
  const fatal = run.errors.length > 0 && inserted === 0 && run.requests <= run.errors.length;
  const status = paused ? "paused" : fatal ? "failed" : total >= c.max_companies || run.exhausted ? "completed" : "paused";
  await ctx.supabase.from("campaigns").update({
    status, found_count: total, requests_used: c.requests_used + run.requests, rejected: run.rejected,
    last_error: run.errors.length ? run.errors.slice(0, 3).join(" | ").slice(0, 500) : !paused && status === "paused" ? "Orçamento de requisições atingido antes do limite" : null,
    finished_at: status === "completed" || status === "failed" ? new Date().toISOString() : null,
  }).eq("id", c.id);
  return { inserted, total, status, run: { requests: run.requests, rejected: run.rejected, errors: run.errors, exhausted: run.exhausted } };
}

export { ProviderError };
