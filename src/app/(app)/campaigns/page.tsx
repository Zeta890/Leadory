import Link from "next/link";
import { Plus, Radar } from "lucide-react";
import { requireCtx } from "@/lib/session";
import { PageHeader } from "@/components/app/nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CampaignRow } from "@/lib/db-types";

export const metadata = { title: "Campanhas" };
const STATUS: Record<string, string> = { draft: "Rascunho", running: "Em execução", paused: "Pausada", completed: "Concluída", failed: "Falhou" };

export default async function CampaignsPage() {
  const ctx = await requireCtx();
  const { data } = await ctx.supabase.from("campaigns").select("*").eq("workspace_id", ctx.workspaceId).order("created_at", { ascending: false });
  const list = (data ?? []) as CampaignRow[];
  return (
    <>
      <PageHeader title="Campanhas" description="Descoberta de empresas por nicho, região, raio e quantidade." actions={<Button asChild><Link href="/campaigns/new"><Plus />Nova campanha</Link></Button>} />
      {list.length === 0 ? (
        <EmptyState icon={Radar} title="Nenhuma campanha" action={<Button asChild><Link href="/campaigns/new">Configurar clínicas odontológicas em Florianópolis</Link></Button>}>
          A primeira campanha já vem configurada: raio de 50 km, até 100 empresas únicas, prioridade para quem não tem site, telefone comercial obrigatório e Instagram opcional.
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-primary/50">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold leading-snug">{c.name}</h2>
                  <span className="shrink-0 rounded-full border border-border-strong px-2 py-0.5 text-[11px] text-muted">{STATUS[c.status]}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{c.niche} em {c.city}, raio de {c.radius_km} km</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (c.found_count / c.max_companies) * 100)}%` }} /></div>
                <p className="tabular mt-2 text-xs text-muted">{c.found_count} de {c.max_companies} empresas</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
