"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, ScanSearch, Loader2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";

interface Progress { status: string; found_count: number; max_companies: number; requests_used: number; max_requests: number; rejected: Record<string, number>; last_error: string | null; audit: Record<string, number>; progress: number }

const STATUS: Record<string, string> = { draft: "Rascunho", running: "Em execução", paused: "Pausada", completed: "Concluída", failed: "Falhou" };
const REJ: Record<string, string> = { outsideRadius: "Fora do raio", noPhone: "Sem telefone", duplicate: "Duplicadas", closed: "Fechadas", noLocation: "Sem localização" };

export function CampaignControls({ id, initial, placesReady, webSearchReady }: { id: string; initial: Progress; placesReady: boolean; webSearchReady: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState<null | "start" | "pause" | "audit">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const auditStop = useRef(false);

  useEffect(() => {
    if (p.status !== "running") return;
    const t = setInterval(async () => { try { setP(await api<Progress>(`/api/campaigns/${id}/progress`)); } catch { /* ignora */ } }, 2500);
    return () => clearInterval(t);
  }, [id, p.status]);

  async function startRun() {
    setBusy("start"); setMsg(null);
    setP((s) => ({ ...s, status: "running" }));
    try {
      const r = await api<{ inserted: number; status: string; run?: { errors: string[] } }>(`/api/campaigns/${id}/start`, { method: "POST" });
      setMsg(`${r.inserted} empresa(s) nova(s) adicionada(s).${r.run?.errors.length ? ` Avisos: ${r.run.errors[0]}` : ""}`);
    } catch (e) { setMsg((e as Error).message); }
    setP(await api<Progress>(`/api/campaigns/${id}/progress`));
    setBusy(null); router.refresh();
  }
  async function pause() {
    setBusy("pause");
    try { await api(`/api/campaigns/${id}/pause`, { method: "POST" }); } catch (e) { setMsg((e as Error).message); }
    setBusy(null);
  }
  async function auditAll() {
    setBusy("audit"); setMsg(null); auditStop.current = false;
    try {
      let remaining = Infinity;
      while (remaining > 0 && !auditStop.current) {
        const r = await api<{ audited: number; remaining: number }>(`/api/campaigns/${id}/audit?limit=8`, { method: "POST" });
        remaining = r.remaining;
        setP(await api<Progress>(`/api/campaigns/${id}/progress`));
        if (r.audited === 0) break;
      }
      setMsg(auditStop.current ? "Auditoria interrompida." : "Auditoria concluída.");
    } catch (e) { setMsg((e as Error).message); }
    setBusy(null); router.refresh();
  }

  const running = p.status === "running";
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-xs ${running ? "border-primary/40 bg-primary/10 text-primary-strong" : p.status === "failed" ? "border-danger/40 text-danger" : "border-border-strong text-muted"}`}>
          {running && <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-primary-strong align-middle" />}{STATUS[p.status] ?? p.status}
        </span>
        {running
          ? <Button variant="outline" onClick={pause} disabled={busy === "pause"}><Pause />Pausar</Button>
          : <Button onClick={startRun} disabled={!placesReady || busy !== null || p.found_count >= p.max_companies}>{busy === "start" ? <Loader2 className="animate-spin" /> : <Play />}{p.status === "draft" ? "Iniciar descoberta" : "Retomar descoberta"}</Button>}
        {busy === "audit"
          ? <Button variant="outline" onClick={() => (auditStop.current = true)}><Loader2 className="animate-spin" />Interromper auditoria</Button>
          : <Button variant="outline" onClick={auditAll} disabled={busy !== null || (p.audit.unknown ?? 0) === 0}><ScanSearch />Auditar presença online ({p.audit.unknown ?? 0})</Button>}
      </div>
      {!placesReady && <p className="text-xs text-warning">Configure GOOGLE_PLACES_API_KEY no servidor para executar a descoberta. Nenhum resultado é simulado.</p>}
      {!webSearchReady && <p className="text-xs text-muted">Sem BRAVE_SEARCH_API_KEY, empresas sem site na fonte ficam como Inconclusivo até validação manual.</p>}
      {msg && <p role="status" className="text-xs text-muted">{msg}</p>}
      {p.last_error && <p className="text-xs text-warning">{p.last_error}</p>}

      <div>
        <div className="flex items-baseline justify-between text-sm"><span>Empresas únicas</span><span className="tabular text-muted"><span className="text-lg font-semibold text-foreground">{p.found_count}</span> / {p.max_companies}</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={p.max_companies} aria-valuenow={p.found_count} aria-label="Progresso da campanha">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.min(100, p.progress)}%` }} />
        </div>
        <p className="tabular mt-2 text-[11px] text-muted">{p.requests_used} de {p.max_requests} requisições usadas</p>
      </div>
      {Object.keys(p.rejected ?? {}).length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          {Object.entries(p.rejected).filter(([k]) => REJ[k]).map(([k, n]) => <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{REJ[k]}</dt><dd className="tabular">{n}</dd></div>)}
        </dl>
      )}
    </div>
  );
}
