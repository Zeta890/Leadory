import { STAGES, STAGE_LABEL, type Stage, type WebsiteStatus } from "@/lib/domain/types";

export interface MetricLead { created_at: string; stage: Stage; score: number; website_status: WebsiteStatus; stage_changed_at: string; is_simulated?: boolean }
export interface MetricDeal { value_cents: number; status: "open" | "won" | "lost"; closed_at: string | null; created_at: string }
export interface MetricUsage { provider: string; units: number; cost_cents: number; created_at: string }

const TZ = "America/Sao_Paulo";
export const dayKey = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const monthKey = (d: Date | string) => dayKey(d).slice(0, 7);
const QUALIFIED_SCORE = 60;

/** Segunda-feira (YYYY-MM-DD) da semana do dia informado, no fuso de São Paulo. */
export function weekKey(d: Date | string) {
  const k = dayKey(d);
  const dt = new Date(`${k}T12:00:00Z`);
  const wd = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - wd);
  return dt.toISOString().slice(0, 10);
}

export function computeMetrics(leads: MetricLead[], deals: MetricDeal[], usage: MetricUsage[], now = new Date()) {
  const real = leads.filter((l) => !l.is_simulated);
  const won = real.filter((l) => l.stage === "won").length;
  const contacted = real.filter((l) => l.stage !== "qualified").length;
  const qualified = real.filter((l) => l.score >= QUALIFIED_SCORE).length;
  const revenueReal = deals.filter((d) => d.status === "won").reduce((s, d) => s + d.value_cents, 0);
  const revenueEstimated = deals.filter((d) => d.status === "open").reduce((s, d) => s + d.value_cents, 0);
  const thisMonth = monthKey(now);
  const monthUsage = usage.filter((u) => monthKey(u.created_at) === thisMonth);
  const costMonth = monthUsage.reduce((s, u) => s + u.cost_cents, 0);
  const requestsMonth = monthUsage.filter((u) => u.provider === "google_places").reduce((s, u) => s + u.units, 0);

  const leadsThisMonth = real.filter((l) => monthKey(l.created_at) === thisMonth).length;

  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getTime() - (13 - i) * 86_400_000);
    const k = dayKey(d);
    const day = real.filter((l) => dayKey(l.created_at) === k);
    return { key: k, label: `${k.slice(8)}/${k.slice(5, 7)}`, leads: day.length, qualified: day.filter((l) => l.score >= QUALIFIED_SCORE).length };
  });

  const weekly = Array.from({ length: 8 }, (_, i) => {
    const k = weekKey(new Date(now.getTime() - (7 - i) * 7 * 86_400_000));
    return {
      key: k, label: `${k.slice(8)}/${k.slice(5, 7)}`,
      leads: real.filter((l) => weekKey(l.created_at) === k).length,
      won: real.filter((l) => l.stage === "won" && weekKey(l.stage_changed_at) === k).length,
    };
  });

  const funnel = STAGES.map((s) => ({ stage: STAGE_LABEL[s], count: real.filter((l) => l.stage === s).length }));

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(15);
    d.setUTCMonth(d.getUTCMonth() - (5 - i));
    return monthKey(d);
  });
  const revenue = months.map((m) => ({
    key: m,
    label: new Date(`${m}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: TZ }).replace(".", ""),
    real: deals.filter((d) => d.status === "won" && d.closed_at && monthKey(d.closed_at) === m).reduce((s, d) => s + d.value_cents, 0),
    estimated: deals.filter((d) => d.status === "open" && monthKey(d.created_at) === m).reduce((s, d) => s + d.value_cents, 0),
  }));

  const audit: Record<WebsiteStatus, number> = { unknown: 0, inconclusive: 0, identified: 0, not_identified: 0 };
  for (const l of real) audit[l.website_status]++;

  return {
    kpis: {
      total: real.length,
      qualified,
      won,
      conversion: contacted ? won / contacted : null,
      revenueReal,
      revenueEstimated,
      costMonth,
      requestsMonth,
      costPerLead: leadsThisMonth ? Math.round(costMonth / leadsThisMonth) : null,
      simulated: leads.length - real.length,
    },
    daily, weekly, funnel, revenue, audit,
  };
}
