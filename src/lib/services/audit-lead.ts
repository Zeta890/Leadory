import "server-only";
import { safeFetchHtml } from "@/lib/domain/safe-fetch";
import { decideWebsiteStatus, extractSignals, isOwnWebsiteCandidate, type AuditEvidence } from "@/lib/domain/audit";
import { searchWebPresence } from "@/lib/discovery/web-search";
import { env } from "@/lib/env";
import type { Ctx } from "@/lib/session";
import type { LeadRow } from "@/lib/db-types";
import { rescoreLead } from "./score-lead";

export async function auditLead(ctx: Ctx, lead: LeadRow, city: string) {
  const now = () => new Date().toISOString();
  const evidence: AuditEvidence[] = [];
  let reachable: boolean | null = null;
  let signals = null;
  let finalUrl: string | null = null;
  let httpStatus: number | null = null;

  const sourceSite = lead.website && isOwnWebsiteCandidate(lead.website) ? lead.website : null;
  if (sourceSite) {
    try {
      const r = await safeFetchHtml(sourceSite);
      httpStatus = r.status;
      finalUrl = r.finalUrl;
      reachable = r.status >= 200 && r.status < 400 && r.body.length > 200;
      if (reachable) signals = extractSignals(r.body, r.finalUrl);
      evidence.push({ kind: "http_check", detail: `HTTP ${r.status}${signals?.title ? ` · “${signals.title}”` : ""}`, url: r.finalUrl, at: now() });
    } catch (e) {
      reachable = false;
      evidence.push({ kind: "http_error", detail: (e as Error).message.slice(0, 200), url: sourceSite, at: now() });
    }
  } else if (lead.website) {
    evidence.push({ kind: "not_own_site", detail: "URL da fonte é rede social/agregador", url: lead.website, at: now() });
  }

  // Busca web só quando a fonte não informou site próprio.
  const web = sourceSite ? null : await searchWebPresence({ businessName: lead.name, city, apiKey: env.braveKey });
  if (web) {
    await ctx.supabase.from("api_usage").insert({ workspace_id: ctx.workspaceId, campaign_id: lead.campaign_id, provider: "brave_search", units: web.executed ? 1 : 0 });
    evidence.push({ kind: "web_search", detail: web.executed ? `${web.websiteCandidates.length} candidato(s) a site, ${web.instagramCandidates.length} a Instagram` : `Não executada: ${web.error}`, at: now() });
  }

  const status = decideWebsiteStatus({
    sourceWebsite: sourceSite,
    sourceWebsiteReachable: reachable,
    webSearchExecuted: web?.executed ?? false,
    webCandidates: web?.websiteCandidates ?? [],
    humanValidatedWebsite: null,
    humanConfirmedNoWebsite: false,
  });

  const instagramCandidate = lead.instagram ?? signals?.instagramHandles[0] ?? web?.instagramCandidates[0] ?? null;

  await ctx.supabase.from("lead_audits").insert({
    workspace_id: ctx.workspaceId, lead_id: lead.id, website_status: status, checked_url: sourceSite, final_url: finalUrl, http_status: httpStatus,
    signals: signals ?? {}, web_search: web ?? {}, evidence,
  });
  const patch: Partial<LeadRow> = { website_status: status };
  // Instagram encontrado é candidato; só pontua após validação humana (instagram_verified).
  if (!lead.instagram && instagramCandidate) patch.instagram = instagramCandidate;
  await ctx.supabase.from("leads").update(patch).eq("id", lead.id).eq("workspace_id", ctx.workspaceId);
  await ctx.supabase.from("lead_events").insert({ workspace_id: ctx.workspaceId, lead_id: lead.id, type: "audit", payload: { status, evidence: evidence.length } });
  const scored = await rescoreLead(ctx, { ...lead, ...patch } as LeadRow);
  return { status, evidence, signals, web, score: scored.score };
}
