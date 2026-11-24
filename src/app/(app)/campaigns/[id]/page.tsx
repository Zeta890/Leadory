import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/session";
import { integrationStatus } from "@/lib/env";
import { WEBSITE_STATUS_LABEL, STAGE_LABEL } from "@/lib/domain/types";
import { formatPhoneBR } from "@/lib/domain/normalize";
import { PageHeader } from "@/components/app/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignRadar } from "@/components/app/radar";
import { CampaignControls } from "@/components/campaigns/campaign-controls";
import { ScoreRing } from "@/components/crm/kanban";
import type { CampaignRow, LeadRow } from "@/lib/db-types";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await requireCtx();
  const { data: c } = await ctx.supabase.from("campaigns").select("*").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle<CampaignRow>();
  if (!c) notFound();
  const { data } = await ctx.supabase.from("leads").select("*").eq("campaign_id", id).order("score", { ascending: false });
  const leads = (data ?? []) as LeadRow[];
  const audit: Record<string, number> = { unknown: 0, inconclusive: 0, identified: 0, not_identified: 0 };
  leads.forEach((l) => audit[l.website_status]!++);
  const s = integrationStatus();
  return (
    <>
      <PageHeader title={c.name} description={`${c.niche} em ${c.city}. Raio de ${c.radius_km} km a partir de ${c.center_lat.toFixed(4)}, ${c.center_lng.toFixed(4)}. ${c.prioritize_no_website ? "Prioriza empresas sem site; " : ""}${c.require_business_phone ? "telefone comercial obrigatório; " : ""}Instagram ${c.require_instagram ? "obrigatório" : "opcional"}.`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <Card><CardContent className="pt-5">
          <CampaignControls id={c.id} placesReady={s.places} webSearchReady={s.webSearch}
            initial={{ status: c.status, found_count: c.found_count, max_companies: c.max_companies, requests_used: c.requests_used, max_requests: c.max_requests, rejected: c.rejected ?? {}, last_error: c.last_error, audit, progress: Math.round((c.found_count / c.max_companies) * 100) }} />
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <CampaignRadar center={{ lat: c.center_lat, lng: c.center_lng }} radiusKm={c.radius_km} points={leads.filter((l) => l.lat !== null && l.lng !== null).map((l) => ({ id: l.id, name: l.name, lat: l.lat!, lng: l.lng!, websiteStatus: l.website_status }))} />
        </CardContent></Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Empresas encontradas</CardTitle><CardDescription>Ordenadas por Lead Score. Telefone comercial não indica que o número usa WhatsApp.</CardDescription></CardHeader>
        <CardContent className="px-0 sm:px-5">
          {leads.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">Nenhuma empresa ainda. Inicie a descoberta para buscar empresas reais na região.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-muted"><tr className="border-b border-border">
                  <th className="px-5 py-2 font-medium sm:px-2">Empresa</th><th className="px-2 py-2 font-medium">Distância</th><th className="px-2 py-2 font-medium">Telefone</th><th className="px-2 py-2 font-medium">Site</th><th className="px-2 py-2 font-medium">Etapa</th><th className="px-2 py-2 font-medium">Score</th>
                </tr></thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-border/60 hover:bg-surface-2/50">
                      <td className="px-5 py-2.5 sm:px-2"><Link href={`/leads/${l.id}`} className="font-medium hover:text-primary-strong">{l.name}</Link><p className="max-w-xs truncate text-[11px] text-muted">{l.address}</p></td>
                      <td className="tabular px-2 py-2.5 text-muted">{l.distance_km !== null ? `${Number(l.distance_km).toLocaleString("pt-BR")} km` : "—"}</td>
                      <td className="tabular whitespace-nowrap px-2 py-2.5">{formatPhoneBR(l.phone_e164)}</td>
                      <td className="px-2 py-2.5"><Badge tone={l.website_status === "not_identified" ? "success" : l.website_status === "inconclusive" ? "warning" : "neutral"}>{WEBSITE_STATUS_LABEL[l.website_status]}</Badge></td>
                      <td className="px-2 py-2.5 text-muted">{STAGE_LABEL[l.stage]}</td>
                      <td className="px-2 py-2.5"><ScoreRing score={l.score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-5 pt-3 text-[11px] text-muted sm:px-0">Dados de localização, avaliações e contato vêm do Google Places e expiram em 30 dias conforme os termos do provedor.</p>
        </CardContent>
      </Card>
    </>
  );
}
