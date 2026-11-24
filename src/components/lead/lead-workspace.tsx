"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanSearch, Sparkles, Eye, Send, Ban, CheckCircle2, ShieldCheck, ShieldOff, ExternalLink, Clock, Check } from "lucide-react";
import { api } from "@/lib/client-api";
import { STAGES, STAGE_LABEL, WEBSITE_STATUS_LABEL, type Stage } from "@/lib/domain/types";
import { formatPhoneBR, isMobileBR } from "@/lib/domain/normalize";
import { MAX_MESSAGE_CHARS } from "@/lib/domain/message";
import type { LeadRow, MessageRow, DealRow } from "@/lib/db-types";
import { brl, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScoreRing } from "@/components/crm/kanban";

interface Audit { id: string; website_status: string; evidence: { kind: string; detail: string; url?: string; at: string }[]; web_search: { websiteCandidates?: string[]; instagramCandidates?: string[] }; created_at: string }
interface Consent { id: string; status: string; source: string; evidence: string; granted_at: string; revoked_at: string | null }
interface Preview { id: string; slug: string; status: string; published_at: string | null; created_at: string }
interface Event { id: number; type: string; payload: Record<string, unknown>; created_at: string }

export interface LeadData { lead: LeadRow; audits: Audit[]; consents: Consent[]; previews: Preview[]; messages: MessageRow[]; deals: DealRow[]; events: Event[] }

const MSG_STATUS: Record<string, string> = { draft: "Rascunho", approved: "Aprovada", scheduled: "Agendada", sending: "Enviando", sent: "Enviada", delivered: "Entregue", read: "Lida", failed: "Falhou", cancelled: "Cancelada", received: "Recebida" };
const EVENT: Record<string, string> = {
  discovered: "Descoberto na campanha", created: "Cadastrado manualmente", audit: "Auditoria de presença", stage_changed: "Etapa alterada", note_updated: "Notas atualizadas",
  website_review: "Site revisado", instagram_review: "Instagram revisado", phone_review: "Telefone revisado", preview_created: "Prévia gerada", preview_publish: "Prévia publicada",
  preview_archive: "Prévia arquivada", message_drafted: "Mensagem gerada", message_approved: "Mensagem aprovada", message_scheduled: "Mensagem agendada",
  message_cancelled: "Mensagem cancelada", message_sent: "Mensagem enviada", consent_granted: "Opt-in registrado", consent_revoked: "Consentimento revogado",
  reply: "Contato respondeu", opt_out: "Contato pediu para sair", deal_value: "Valor do negócio",
};
const fmt = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function LeadWorkspace({ data, sendingEnabled, appUrl }: { data: LeadData; sendingEnabled: boolean; appUrl: string }) {
  const router = useRouter();
  const { lead } = data;
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function act(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key); setFlash(null);
    try { await fn(); if (ok) setFlash({ tone: "ok", text: ok }); router.refresh(); }
    catch (e) { setFlash({ tone: "err", text: (e as Error).message }); }
    finally { setBusy(null); }
  }
  const patch = (json: unknown, ok?: string) => act("patch", () => api(`/api/leads/${lead.id}`, { method: "PATCH", json }), ok);

  const latestAudit = data.audits[0];
  const published = data.previews.find((p) => p.status === "published");
  const draftPreview = data.previews.find((p) => p.status === "draft");
  const consent = data.consents.find((c) => c.status === "granted");
  const openDeal = data.deals.find((d) => d.status === "open");
  const wonDeal = data.deals.find((d) => d.status === "won");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
      {flash && <p role={flash.tone === "err" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2 text-xs xl:col-span-2", flash.tone === "err" ? "border-danger/30 bg-danger/10 text-danger" : "border-primary/30 bg-primary/10 text-primary-strong")}>{flash.text}</p>}
      <div className="grid content-start gap-4">
        {/* Resumo + score */}
        <Card>
          <CardContent className="grid gap-5 pt-5 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-1"><ScoreRing score={lead.score} size={84} /><span className="text-[11px] text-muted">Lead Score</span></div>
            <ul className="grid gap-1.5 text-sm">
              {lead.score_breakdown.map((b) => (
                <li key={b.key} className="flex items-center justify-between gap-3">
                  <span className={cn("flex items-center gap-2", b.earned ? "text-foreground" : "text-muted")}>{b.earned ? <Check className="size-3.5 text-primary-strong" /> : <span className="size-3.5" />}{b.label}</span>
                  <span className={cn("tabular text-xs", b.earned ? "text-primary-strong" : "text-muted")}>+{b.points}</span>
                </li>
              ))}
              {lead.score_breakdown.length === 0 && <li className="text-muted">Score ainda não calculado.</li>}
            </ul>
          </CardContent>
        </Card>

        {/* Presença online */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div><CardTitle>Presença online</CardTitle><CardDescription>Ausência de resultado não prova que a empresa não tem site. Confirme manualmente antes de afirmar.</CardDescription></div>
            <Button size="sm" variant="outline" onClick={() => act("audit", () => api(`/api/leads/${lead.id}/audit`, { method: "POST" }), "Auditoria concluída.")} disabled={busy !== null}>
              {busy === "audit" ? <Loader2 className="animate-spin" /> : <ScanSearch />}Auditar
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={lead.website_status === "not_identified" ? "success" : lead.website_status === "inconclusive" ? "warning" : "neutral"}>{WEBSITE_STATUS_LABEL[lead.website_status]}</Badge>
              {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary-strong">{lead.website}<ExternalLink className="size-3" /></a>}
            </div>
            {latestAudit && (
              <ul className="grid gap-1 rounded-lg border border-border bg-background/40 p-3 text-xs">
                {latestAudit.evidence.map((e, i) => <li key={i} className="text-muted"><span className="text-foreground">{e.detail}</span>{e.url ? ` (${e.url})` : ""}</li>)}
                {(latestAudit.web_search.websiteCandidates ?? []).map((u) => (
                  <li key={u} className="mt-1 flex flex-wrap items-center gap-2"><span>Candidato a site: <a href={u} target="_blank" rel="noopener noreferrer nofollow" className="text-primary-strong hover:underline">{u}</a></span>
                    <Button size="sm" variant="outline" onClick={() => patch({ website_review: { decision: "confirmed", url: u } }, "Site confirmado.")}>Confirmar este site</Button></li>
                ))}
                <li className="mt-1 text-[11px] text-muted">Auditado em {fmt(latestAudit.created_at)}</li>
              </ul>
            )}
            <SiteReview onConfirm={(url) => patch({ website_review: { decision: "confirmed", url } }, "Site confirmado.")} onNone={() => patch({ website_review: { decision: "none" } }, "Registrado: nenhum site identificado após verificação manual.")} />
            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <InstagramReview lead={lead} onSave={(handle, verified) => patch({ instagram: handle || null, instagram_verified: verified }, "Instagram atualizado.")} />
              <div className="grid content-start gap-2">
                <Label>Telefone comercial</Label>
                <p className="tabular text-sm">{formatPhoneBR(lead.phone_e164)} {lead.phone_e164 && <span className="text-[11px] text-muted">{isMobileBR(lead.phone_e164) ? "celular" : "fixo"}</span>}</p>
                <label className="flex items-center gap-2 text-xs text-muted"><Switch checked={lead.phone_verified} onCheckedChange={(b) => patch({ phone_verified: b })} />Telefone verificado por contato humano</label>
                <p className="text-[11px] text-muted">Ter telefone não significa ter WhatsApp nem autorização de contato.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prévia */}
        <Card>
          <CardHeader><CardTitle>Prévia de site</CardTitle><CardDescription>Página conceitual, não indexada, montada só com dados conhecidos. Lacunas aparecem como campos a confirmar.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => act("preview", () => api(`/api/leads/${lead.id}/preview`, { method: "POST" }), "Rascunho de prévia gerado.")} disabled={busy !== null}>{busy === "preview" ? <Loader2 className="animate-spin" /> : <Sparkles />}Gerar prévia</Button>
            {draftPreview && <Button size="sm" onClick={() => act("pub", () => api(`/api/leads/${lead.id}/preview`, { method: "PATCH", json: { preview_id: draftPreview.id, action: "publish" } }), "Prévia publicada.")} disabled={busy !== null}><Eye />Publicar prévia</Button>}
            {published && <>
              <a href={`/preview/${published.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-strong hover:underline">Abrir prévia publicada<ExternalLink className="size-3.5" /></a>
              <Button size="sm" variant="ghost" onClick={() => act("arch", () => api(`/api/leads/${lead.id}/preview`, { method: "PATCH", json: { preview_id: published.id, action: "archive" } }), "Prévia arquivada.")}>Arquivar</Button>
              <p className="w-full text-[11px] text-muted">Link: {appUrl}/preview/{published.slug}</p>
            </>}
            <ServicesEditor value={lead.confirmed_services} onSave={(v) => patch({ confirmed_services: v }, "Tratamentos confirmados salvos.")} />
          </CardContent>
        </Card>

        {/* Mensagens */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div><CardTitle>Agente de mensagens</CardTitle><CardDescription>Até {MAX_MESSAGE_CHARS} caracteres, tom consultivo. {published ? "Pode mencionar a prévia publicada." : "Sem prévia publicada, a mensagem não afirma que ela existe."}</CardDescription></div>
            <Button size="sm" variant="outline" onClick={() => act("msg", () => api(`/api/leads/${lead.id}/message`, { method: "POST" }), "Rascunho criado. Revise e aprove.")} disabled={busy !== null}>{busy === "msg" ? <Loader2 className="animate-spin" /> : <Sparkles />}Gerar mensagem</Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.messages.length === 0 && <p className="text-sm text-muted">Nenhuma mensagem. Gere um rascunho para revisar.</p>}
            {data.messages.map((m) => <MessageItem key={m.id} m={m} leadId={lead.id} sendingEnabled={sendingEnabled} hasConsent={Boolean(consent)} act={act} busy={busy} />)}
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader><CardTitle>Etapa e negócio</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <NativeSelect aria-label="Etapa" value={lead.stage} onChange={(e) => patch({ stage: e.target.value as Stage }, "Etapa atualizada.")}>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </NativeSelect>
            <DealEditor current={(wonDeal ?? openDeal)?.value_cents ?? null} won={Boolean(wonDeal)} onSave={(cents) => patch({ deal_value_cents: cents }, "Valor salvo.")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Consentimento para WhatsApp</CardTitle><CardDescription>Envio só com opt-in verificável. A etapa Autorizado do CRM não conta como prova.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {consent ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-medium text-primary-strong"><ShieldCheck className="size-4" />Opt-in registrado em {fmt(consent.granted_at)}</p>
                <p className="mt-1 text-muted">{consent.evidence}</p>
                <Button size="sm" variant="danger" className="mt-3" onClick={() => act("revoke", () => api(`/api/leads/${lead.id}/consent`, { method: "DELETE" }), "Consentimento revogado. Número suprimido e pendências canceladas.")}><ShieldOff />Revogar e suprimir</Button>
              </div>
            ) : <ConsentForm disabled={!lead.phone_e164} onSubmit={(json) => act("consent", () => api(`/api/leads/${lead.id}/consent`, { method: "POST", json }), "Opt-in registrado.")} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
          <CardContent><NotesEditor value={lead.notes} onSave={(notes) => patch({ notes }, "Notas salvas.")} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative grid gap-3 border-l border-border pl-4">
              {data.events.map((e) => (
                <li key={e.id} className="text-xs">
                  <span className="absolute -left-[5px] mt-1 size-2.5 rounded-full border border-primary/60 bg-background" aria-hidden />
                  <p className="text-foreground">{EVENT[e.type] ?? e.type}{e.type === "stage_changed" ? `: ${STAGE_LABEL[e.payload.from as Stage]} para ${STAGE_LABEL[e.payload.to as Stage]}` : ""}</p>
                  <p className="text-muted">{fmt(e.created_at)}</p>
                </li>
              ))}
              {data.events.length === 0 && <li className="text-xs text-muted">Sem eventos.</li>}
            </ol>
          </CardContent>
        </Card>
        <p className="px-1 text-[11px] text-muted">Origem: {lead.source === "google_places" ? "Google Places" : "cadastro manual"}{lead.source_url ? <> · <a className="hover:text-primary-strong" href={lead.source_url} target="_blank" rel="noopener noreferrer nofollow">ver na fonte</a></> : null}</p>
      </div>
    </div>
  );
}

function MessageItem({ m, leadId, sendingEnabled, hasConsent, act, busy }: { m: MessageRow; leadId: string; sendingEnabled: boolean; hasConsent: boolean; act: (k: string, fn: () => Promise<unknown>, ok?: string) => void; busy: string | null }) {
  const [text, setText] = useState(m.body);
  const editable = m.direction === "outbound" && (m.status === "draft" || m.status === "approved");
  const tone = m.status === "failed" || m.status === "cancelled" ? "danger" : m.status === "sent" || m.status === "delivered" || m.status === "read" ? "success" : m.status === "scheduled" ? "info" : "neutral";
  return (
    <div className={cn("rounded-lg border p-3", m.direction === "inbound" ? "border-info/30 bg-info/5" : "border-border bg-background/40")}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <Badge tone={tone as "neutral"}>{MSG_STATUS[m.status]}</Badge>
        <span>{m.direction === "inbound" ? "Recebida" : "Saída"} em {fmt(m.created_at)}</span>
        {m.scheduled_for && m.status === "scheduled" && <span className="inline-flex items-center gap-1"><Clock className="size-3" />{fmt(m.scheduled_for)}</span>}
      </div>
      {editable ? (
        <>
          <Textarea aria-label="Texto da mensagem" value={text} maxLength={MAX_MESSAGE_CHARS} onChange={(e) => setText(e.target.value)} rows={4} />
          <p className="tabular mt-1 text-right text-[11px] text-muted">{text.length}/{MAX_MESSAGE_CHARS}</p>
        </>
      ) : <p className="whitespace-pre-wrap text-sm">{m.body}</p>}
      {m.last_error && <p className="mt-2 text-[11px] text-warning">{m.last_error}</p>}
      {m.direction === "outbound" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {editable && text !== m.body && <Button size="sm" variant="outline" onClick={() => act("edit", () => api(`/api/leads/${leadId}/message`, { method: "PATCH", json: { message_id: m.id, body: text } }), "Texto salvo como rascunho.")}>Salvar texto</Button>}
          {m.status === "draft" && text === m.body && <Button size="sm" onClick={() => act("approve", () => api(`/api/messages/${m.id}`, { method: "PATCH", json: { action: "approve" } }), "Mensagem aprovada.")} disabled={busy !== null}><CheckCircle2 />Aprovar</Button>}
          {m.status === "approved" && (
            <Button size="sm" onClick={() => act("schedule", () => api(`/api/messages/${m.id}`, { method: "PATCH", json: { action: "schedule" } }), "Agendada para a próxima janela de envio (seg–sex, 9h–17h).")} disabled={busy !== null || !sendingEnabled || !hasConsent}
              title={!sendingEnabled ? "Envio desabilitado no workspace" : !hasConsent ? "Registre o opt-in antes" : undefined}><Send />Agendar envio</Button>
          )}
          {["draft", "approved", "scheduled"].includes(m.status) && <Button size="sm" variant="ghost" onClick={() => act("cancel", () => api(`/api/messages/${m.id}`, { method: "PATCH", json: { action: "cancel" } }), "Mensagem cancelada.")}><Ban />Cancelar</Button>}
          {m.status === "approved" && (!sendingEnabled || !hasConsent) && <p className="w-full text-[11px] text-muted">{!sendingEnabled ? "O envio está desabilitado em Integrações." : "Registre um opt-in verificável para agendar."}</p>}
        </div>
      )}
    </div>
  );
}

function SiteReview({ onConfirm, onNone }: { onConfirm: (url: string) => void; onNone: () => void }) {
  const [url, setUrl] = useState("");
  return (
    <div className="grid gap-2">
      <Label htmlFor="site-url">Validação humana do site</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="site-url" type="url" placeholder="https://site-da-clinica.com.br" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button size="default" variant="outline" disabled={!/^https?:\/\/.+\..+/.test(url)} onClick={() => onConfirm(url)}>Confirmar site</Button>
        <Button size="default" variant="ghost" onClick={onNone}>Verifiquei: sem site</Button>
      </div>
    </div>
  );
}

function InstagramReview({ lead, onSave }: { lead: LeadRow; onSave: (h: string, v: boolean) => void }) {
  const [h, setH] = useState(lead.instagram ?? "");
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor="ig">Instagram (opcional)</Label>
      <div className="flex gap-2"><Input id="ig" placeholder="perfil" value={h} onChange={(e) => setH(e.target.value)} /><Button variant="outline" onClick={() => onSave(h, lead.instagram_verified)}>Salvar</Button></div>
      {lead.instagram && <a className="text-[11px] text-muted hover:text-primary-strong" href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noopener noreferrer nofollow">Abrir @{lead.instagram} para conferir</a>}
      <label className="flex items-center gap-2 text-xs text-muted"><Switch disabled={!lead.instagram} checked={lead.instagram_verified} onCheckedChange={(b) => onSave(lead.instagram ?? "", b)} />Perfil conferido e ativo</label>
    </div>
  );
}

function ServicesEditor({ value, onSave }: { value: string[]; onSave: (v: string[]) => void }) {
  const [t, setT] = useState(value.join(", "));
  return (
    <div className="mt-2 grid w-full gap-1.5">
      <Label htmlFor="svc">Tratamentos confirmados pela clínica</Label>
      <div className="flex gap-2"><Input id="svc" placeholder="Implantes, ortodontia, clareamento" value={t} onChange={(e) => setT(e.target.value)} /><Button variant="outline" onClick={() => onSave(t.split(",").map((s) => s.trim()).filter(Boolean))}>Salvar</Button></div>
      <p className="text-[11px] text-muted">Use apenas o que a própria clínica informa. Sem isso, a prévia mostra um campo a confirmar.</p>
    </div>
  );
}

function ConsentForm({ onSubmit, disabled }: { onSubmit: (j: { source: string; evidence: string }) => void; disabled: boolean }) {
  const [source, setSource] = useState("inbound_message");
  const [evidence, setEvidence] = useState("");
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); onSubmit({ source, evidence }); }}>
      <Label htmlFor="c-src">Como o contato autorizou</Label>
      <NativeSelect id="c-src" value={source} onChange={(e) => setSource(e.target.value)} disabled={disabled}>
        <option value="inbound_message">Enviou mensagem pedindo contato</option><option value="web_form">Formulário com aceite</option>
        <option value="signed_document">Documento assinado</option><option value="verbal_recorded">Autorização verbal gravada</option><option value="other">Outro</option>
      </NativeSelect>
      <Label htmlFor="c-ev">Evidência (data, canal, quem autorizou)</Label>
      <Textarea id="c-ev" rows={3} minLength={10} required value={evidence} onChange={(e) => setEvidence(e.target.value)} disabled={disabled} />
      <Button size="sm" disabled={disabled || evidence.trim().length < 10}><ShieldCheck />Registrar opt-in</Button>
      {disabled && <p className="text-[11px] text-muted">Lead sem telefone.</p>}
    </form>
  );
}

function NotesEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [t, setT] = useState(value);
  return <div className="grid gap-2"><Textarea aria-label="Notas" rows={5} value={t} onChange={(e) => setT(e.target.value)} maxLength={10000} /><Button size="sm" variant="outline" disabled={t === value} onClick={() => onSave(t)}>Salvar notas</Button></div>;
}

function DealEditor({ current, won, onSave }: { current: number | null; won: boolean; onSave: (c: number) => void }) {
  const [v, setV] = useState(current !== null ? (current / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
  const cents = Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="deal">{won ? "Valor vendido (R$)" : "Valor estimado do negócio (R$)"}</Label>
      <div className="flex gap-2"><Input id="deal" inputMode="decimal" placeholder="1.500,00" value={v} onChange={(e) => setV(e.target.value)} /><Button variant="outline" disabled={!Number.isFinite(cents) || !v.trim()} onClick={() => onSave(cents)}>Salvar</Button></div>
      {current !== null && <p className="text-[11px] text-muted">{won ? "Conta como receita realizada" : "Conta como pipeline estimado"}: {brl(current)}</p>}
    </div>
  );
}
