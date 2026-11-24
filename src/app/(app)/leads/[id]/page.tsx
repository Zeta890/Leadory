import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/app/nav";
import { LeadWorkspace, type LeadData } from "@/components/lead/lead-workspace";
import type { LeadRow } from "@/lib/db-types";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await requireCtx();
  const { data: lead } = await ctx.supabase.from("leads").select("*").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle<LeadRow>();
  if (!lead) notFound();
  const [events, audits, consents, previews, messages, deals, ws] = await Promise.all([
    ctx.supabase.from("lead_events").select("id,type,payload,created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("lead_audits").select("id,website_status,evidence,web_search,created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(3),
    ctx.supabase.from("consents").select("id,status,source,evidence,granted_at,revoked_at").eq("lead_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("previews").select("id,slug,status,published_at,created_at").eq("lead_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("messages").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("deals").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("workspaces").select("sending_enabled").eq("id", ctx.workspaceId).single(),
  ]);
  const data = { lead, events: events.data ?? [], audits: audits.data ?? [], consents: consents.data ?? [], previews: previews.data ?? [], messages: messages.data ?? [], deals: deals.data ?? [] } as LeadData;
  return (
    <>
      <Link href="/crm" className="text-xs text-muted hover:text-primary-strong">Voltar ao CRM</Link>
      <PageHeader title={lead.name} description={[lead.address, lead.distance_km !== null ? `${Number(lead.distance_km).toLocaleString("pt-BR")} km do centro da campanha` : null].filter(Boolean).join(". ")} />
      <LeadWorkspace data={data} sendingEnabled={Boolean(ws.data?.sending_enabled)} appUrl={env.appUrl} />
    </>
  );
}
