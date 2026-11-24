"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client-api";
import type { Workspace } from "@/lib/db-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function WorkspaceForm({ ws, canEdit, whatsappReady }: { ws: Workspace; canEdit: boolean; whatsappReady: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(ws);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function save(next: Partial<Workspace>) {
    setBusy(true); setMsg(null);
    try {
      const { workspace } = await api<{ workspace: Workspace }>("/api/workspace", { method: "PATCH", json: next });
      setV(workspace); setMsg({ ok: true, t: "Configurações salvas." }); router.refresh();
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } finally { setBusy(false); }
  }
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save({ name: v.name, sender_name: v.sender_name, sender_role: v.sender_role, monthly_request_budget: v.monthly_request_budget, whatsapp_template_name: v.whatsapp_template_name || null }); }}>
      <fieldset disabled={!canEdit || busy} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="ws-name">Nome do workspace</Label><Input id="ws-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="ws-budget">Limite mensal de requisições de descoberta</Label><Input id="ws-budget" type="number" min={0} value={v.monthly_request_budget} onChange={(e) => setV({ ...v, monthly_request_budget: Number(e.target.value) })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="ws-sender">Seu nome nas mensagens</Label><Input id="ws-sender" placeholder="Pedro" value={v.sender_name} onChange={(e) => setV({ ...v, sender_name: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="ws-role">Como você se apresenta</Label><Input id="ws-role" value={v.sender_role} onChange={(e) => setV({ ...v, sender_role: e.target.value })} /></div>
        <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="ws-tpl">Template aprovado na Meta (fora da janela de 24h)</Label><Input id="ws-tpl" placeholder="apresentacao_site_v1" value={v.whatsapp_template_name ?? ""} onChange={(e) => setV({ ...v, whatsapp_template_name: e.target.value })} /></div>
      </fieldset>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/40 p-4">
        <div>
          <p className="text-sm font-medium">Envio pelo WhatsApp</p>
          <p className="text-xs text-muted">Mesmo ligado, cada mensagem exige opt-in com evidência, aprovação humana e a janela seg–sex, 9h–17h.</p>
          {!whatsappReady && <p className="mt-1 text-xs text-warning">Configure a WhatsApp Cloud API no servidor para habilitar.</p>}
        </div>
        <Switch aria-label="Habilitar envio pelo WhatsApp" checked={v.sending_enabled} disabled={!canEdit || busy || (!whatsappReady && !v.sending_enabled)} onCheckedChange={(b) => save({ sending_enabled: b })} />
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-xs text-primary-strong" : "text-xs text-danger"}>{msg.t}</p>}
      {canEdit ? <Button className="justify-self-start" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Salvar configurações</Button> : <p className="text-xs text-muted">Somente owner ou admin altera estas configurações.</p>}
    </form>
  );
}
