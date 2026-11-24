import { CheckCircle2, CircleDashed } from "lucide-react";
import { integrationStatus } from "@/lib/env";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Configuração" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  const s = integrationStatus();
  const rows: [string, boolean, string][] = [
    ["Supabase (URL + publishable key)", s.supabase, "Obrigatório para autenticação e dados."],
    ["Supabase secret key (servidor)", s.supabaseServer, "Webhook, fila e prévias públicas."],
    ["Google Places API", s.places, "Descoberta de empresas nas campanhas."],
    ["Brave Search API", s.webSearch, "Identificação de presença online."],
    ["IA (opcional)", s.ai, "Personalização das mensagens; sem ela, usa o modelo aprovado."],
    ["WhatsApp Cloud API", s.whatsapp, "Envio consentido. Desligado por padrão."],
  ];
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Logo className="text-2xl" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Configuração pendente</h1>
      <p className="mt-2 text-sm text-muted">Defina as variáveis de ambiente do servidor (veja <code>.env.example</code> e o README) e aplique as migrations em <code>supabase/migrations</code>. Nenhum dado de exemplo é exibido como resultado real.</p>
      <Card className="mt-6">
        <CardHeader><CardTitle>Integrações</CardTitle><CardDescription>Status lido no servidor; valores nunca são expostos.</CardDescription></CardHeader>
        <CardContent className="divide-y divide-border">
          {rows.map(([label, ok, hint]) => (
            <div key={label} className="flex items-start gap-3 py-3">
              {ok ? <CheckCircle2 className="mt-0.5 size-4 text-primary-strong" /> : <CircleDashed className="mt-0.5 size-4 text-muted" />}
              <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted">{hint}</p></div>
            </div>
          ))}
        </CardContent>
      </Card>
      {s.supabase && <a href="/login" className="mt-6 inline-block text-sm text-primary-strong hover:underline">Ir para o login →</a>}
    </main>
  );
}
