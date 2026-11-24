import Link from "next/link";
import { Radar, Plus } from "lucide-react";
import { requireCtx } from "@/lib/session";
import { computeMetrics, type MetricDeal, type MetricLead, type MetricUsage } from "@/lib/metrics";
import { brl } from "@/lib/utils";
import { PageHeader } from "@/components/app/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CaptureChart, FunnelChart, RevenueChart, WeeklyChart } from "@/components/app/charts";
import { CampaignRadar } from "@/components/app/radar";
import type { CampaignRow } from "@/lib/db-types";

export const metadata = { title: "Visão geral" };

export default async function DashboardPage() {
  const ctx = await requireCtx();
  const since = new Date(Date.now() - 200 * 86_400_000).toISOString();
  const [leads, deals, usage, campaign] = await Promise.all([
    ctx.supabase.from("leads").select("created_at,stage,score,website_status,stage_changed_at,is_simulated").eq("workspace_id", ctx.workspaceId).limit(5000),
    ctx.supabase.from("deals").select("value_cents,status,closed_at,created_at").eq("workspace_id", ctx.workspaceId).gte("created_at", since),
    ctx.supabase.from("api_usage").select("provider,units,cost_cents,created_at").eq("workspace_id", ctx.workspaceId).gte("created_at", since),
    ctx.supabase.from("campaigns").select("*").eq("workspace_id", ctx.workspaceId).order("created_at", { ascending: false }).limit(1).maybeSingle<CampaignRow>(),
  ]);
  const m = computeMetrics((leads.data ?? []) as MetricLead[], (deals.data ?? []) as MetricDeal[], (usage.data ?? []) as MetricUsage[]);
  const c = campaign.data;
  const { data: points } = c
    ? await ctx.supabase.from("leads").select("id,name,lat,lng,website_status").eq("campaign_id", c.id).not("lat", "is", null)
    : { data: [] };

  if (m.kpis.total === 0 && !c) {
    return (
      <>
        <PageHeader title="Visão geral" description="Captação, conversão e faturamento a partir dos seus dados reais." />
        <EmptyState icon={Radar} title="Nenhum lead ainda" action={<Button asChild><Link href="/campaigns/new"><Plus />Criar primeira campanha</Link></Button>}>
          Crie uma campanha para descobrir empresas na região ou cadastre leads manualmente no CRM. Os gráficos aparecem assim que houver dados.
        </EmptyState>
      </>
    );
  }

  const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
  const kpis = [
    { label: "Leads captados", value: m.kpis.total.toLocaleString("pt-BR"), hint: `${m.kpis.qualified} com score ≥ 60` },
    { label: "Conversão", value: pct(m.kpis.conversion), hint: `${m.kpis.won} vendidos entre os contatados` },
    { label: "Receita realizada", value: brl(m.kpis.revenueReal), hint: "Negócios marcados como vendidos" },
    { label: "Pipeline estimado", value: brl(m.kpis.revenueEstimated), hint: "Negócios abertos com valor informado" },
  ];

  return (
    <>
      <PageHeader title="Visão geral" description="Captação, conversão e faturamento a partir dos seus dados reais." actions={<Button asChild variant="outline"><Link href="/campaigns/new"><Plus />Nova campanha</Link></Button>} />
      {m.kpis.simulated > 0 && <p className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">{m.kpis.simulated} lead(s) marcados como simulados foram excluídos das métricas.</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4 sm:p-5">
            <p className="text-xs text-muted">{k.label}</p>
            <p className="mt-2 whitespace-nowrap text-xl font-semibold tracking-tight sm:text-3xl">{k.value}</p>
            <p className="mt-1 text-[11px] text-muted">{k.hint}</p>
          </Card>
        ))}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
        <Card className="flex flex-col">
          <CardHeader><CardTitle>Captação diária</CardTitle><CardDescription>Leads criados por dia nos últimos 14 dias (horário de Brasília)</CardDescription></CardHeader>
          <CardContent className="flex-1"><CaptureChart data={m.daily} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{c ? c.name : "Campanha"}</CardTitle>
            <CardDescription>{c ? `${c.city}, raio de ${c.radius_km} km. ${c.found_count} de ${c.max_companies} empresas.` : "Nenhuma campanha criada"}</CardDescription>
          </CardHeader>
          <CardContent>
            {c ? (
              <Link href={`/campaigns/${c.id}`} className="block rounded-lg focus-visible:outline-offset-4">
                <CampaignRadar center={{ lat: c.center_lat, lng: c.center_lng }} radiusKm={c.radius_km} points={(points ?? []).map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, websiteStatus: p.website_status }))} />
              </Link>
            ) : <p className="text-sm text-muted">Crie uma campanha para ver as empresas no mapa de raio.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Funil comercial</CardTitle><CardDescription>Leads por etapa do CRM</CardDescription></CardHeader>
          <CardContent><FunnelChart data={m.funnel} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Faturamento</CardTitle><CardDescription>Realizado por mês de fechamento e pipeline aberto por mês de criação</CardDescription></CardHeader>
          <CardContent><RevenueChart data={m.revenue} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Desempenho semanal</CardTitle><CardDescription>Captados e vendidos por semana (início na segunda)</CardDescription></CardHeader>
          <CardContent><WeeklyChart data={m.weekly} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Custos e auditoria</CardTitle><CardDescription>Mês corrente</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Custo estimado de APIs" value={brl(m.kpis.costMonth)} />
            <Stat label="Custo por lead" value={m.kpis.costPerLead === null ? "—" : brl(m.kpis.costPerLead)} />
            <Stat label="Requisições de descoberta" value={m.kpis.requestsMonth.toLocaleString("pt-BR")} />
            <Stat label="Sem site identificado" value={m.audit.not_identified.toLocaleString("pt-BR")} />
            <Stat label="Inconclusivos" value={m.audit.inconclusive.toLocaleString("pt-BR")} />
            <Stat label="Não auditados" value={m.audit.unknown.toLocaleString("pt-BR")} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-background/40 p-3"><p className="text-[11px] text-muted">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
