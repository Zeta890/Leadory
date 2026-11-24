import { CheckCircle2, CircleDashed } from "lucide-react";
import { requireCtx } from "@/lib/session";
import { integrationStatus } from "@/lib/env";
import { PageHeader } from "@/components/app/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import type { Workspace } from "@/lib/db-types";

export const metadata = { title: "Integrações" };

export default async function SettingsPage() {
  const ctx = await requireCtx();
  const { data: ws } = await ctx.supabase.from("workspaces").select("*").eq("id", ctx.workspaceId).single<Workspace>();
  const s = integrationStatus();
  const rows: [string, boolean, string][] = [
    ["Supabase", s.supabase && s.supabaseServer, "Autenticação, banco com RLS, webhook e fila."],
    ["Google Places API", s.places, "Descoberta de empresas nas campanhas."],
    ["Brave Search API", s.webSearch, "Busca de site e Instagram para empresas sem site na fonte."],
    ["IA para mensagens", s.ai, "Opcional. Sem ela, o agente usa o modelo de mensagem aprovado."],
    ["WhatsApp Cloud API", s.whatsapp, "Token, Phone Number ID, App Secret e Verify Token."],
    ["Worker da fila", s.cron, "CRON_SECRET para /api/cron/dispatch e /api/cron/retention."],
  ];
  return (
    <>
      <PageHeader title="Integrações" description="Chaves ficam apenas no servidor. Esta tela mostra se estão configuradas, nunca os valores." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader><CardTitle>Workspace e envio</CardTitle></CardHeader>
          <CardContent>{ws && <WorkspaceForm ws={ws} canEdit={ctx.role !== "member"} whatsappReady={s.whatsapp} />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Status das integrações</CardTitle><CardDescription>Variáveis descritas em .env.example</CardDescription></CardHeader>
          <CardContent className="divide-y divide-border">
            {rows.map(([label, ok, hint]) => (
              <div key={label} className="flex items-start gap-3 py-3">
                {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-strong" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted" />}
                <div><p className="text-sm font-medium">{label} <span className="text-xs font-normal text-muted">{ok ? "configurado" : "pendente"}</span></p><p className="text-xs text-muted">{hint}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
