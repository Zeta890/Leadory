import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { requireCtx } from "@/lib/session";
import { PageHeader } from "@/components/app/nav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Mensagens" };
const LABEL: Record<string, string> = { draft: "Rascunho", approved: "Aprovada", scheduled: "Agendada", sending: "Enviando", sent: "Enviada", delivered: "Entregue", read: "Lida", failed: "Falhou", cancelled: "Cancelada", received: "Recebida" };
const GROUPS: { title: string; statuses: string[] }[] = [
  { title: "Aguardando revisão", statuses: ["draft", "approved"] },
  { title: "Fila de envio", statuses: ["scheduled", "sending"] },
  { title: "Respostas recebidas", statuses: ["received"] },
  { title: "Histórico", statuses: ["sent", "delivered", "read", "failed", "cancelled"] },
];
const fmt = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function MessagesPage() {
  const ctx = await requireCtx();
  const { data } = await ctx.supabase.from("messages").select("id,lead_id,direction,body,status,scheduled_for,created_at,last_error,leads(name)").eq("workspace_id", ctx.workspaceId).order("created_at", { ascending: false }).limit(300);
  const list = (data ?? []) as unknown as { id: string; lead_id: string; direction: string; body: string; status: string; scheduled_for: string | null; created_at: string; last_error: string | null; leads: { name: string } | null }[];
  return (
    <>
      <PageHeader title="Mensagens" description="Rascunhos, fila e respostas. Uma resposta do contato interrompe a sequência; pedidos para sair suprimem o número." />
      {list.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="Nenhuma mensagem">Abra um lead e use o agente de mensagens para gerar um rascunho personalizado.</EmptyState>
      ) : (
        <div className="grid gap-6">
          {GROUPS.map((g) => {
            const items = list.filter((m) => g.statuses.includes(m.status));
            if (!items.length) return null;
            return (
              <section key={g.title}>
                <h2 className="mb-2 text-sm font-semibold">{g.title} <span className="tabular text-muted">{items.length}</span></h2>
                <Card className="divide-y divide-border">
                  {items.map((m) => (
                    <Link key={m.id} href={`/leads/${m.lead_id}`} className="flex flex-col gap-1 p-4 hover:bg-surface-2/50 sm:flex-row sm:items-start sm:gap-4">
                      <div className="w-48 shrink-0"><p className="truncate text-sm font-medium">{m.leads?.name ?? "Lead"}</p><p className="text-[11px] text-muted">{fmt(m.created_at)}</p></div>
                      <p className="line-clamp-2 flex-1 text-sm text-muted">{m.body}</p>
                      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                        <Badge tone={m.status === "failed" || m.status === "cancelled" ? "danger" : m.status === "scheduled" ? "info" : m.status === "received" ? "warning" : "neutral"}>{LABEL[m.status]}</Badge>
                        {m.scheduled_for && m.status === "scheduled" && <span className="text-[11px] text-muted">{fmt(m.scheduled_for)}</span>}
                      </div>
                    </Link>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
