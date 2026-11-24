"use client";
import { useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { Search, Download, GripVertical, Phone, Globe, AtSign } from "lucide-react";
import { STAGES, STAGE_LABEL, WEBSITE_STATUS_LABEL, type Stage, type WebsiteStatus } from "@/lib/domain/types";
import { formatPhoneBR } from "@/lib/domain/normalize";
import type { LeadRow } from "@/lib/db-types";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AddLeadDialog } from "./add-lead";

type Lead = Pick<LeadRow, "id" | "name" | "stage" | "score" | "website_status" | "phone_e164" | "instagram" | "instagram_verified" | "distance_km" | "is_simulated">;

const siteTone: Record<WebsiteStatus, "success" | "neutral" | "warning"> = { not_identified: "success", identified: "neutral", inconclusive: "warning", unknown: "neutral" };

export function Kanban({ initial }: { initial: Lead[] }) {
  const [leads, setLeads] = useState(initial);
  const [q, setQ] = useState("");
  const [site, setSite] = useState<"all" | WebsiteStatus>("all");
  const [minScore, setMinScore] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingWon, setPendingWon] = useState<{ id: string; from: Stage } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnJump }),
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return leads.filter((l) =>
      (!term || l.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(term)) &&
      (site === "all" || l.website_status === site) && l.score >= minScore);
  }, [leads, q, site, minScore]);

  function persist(id: string, from: Stage, to: Stage, dealValueCents?: number) {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage: to } : l)));
    setError(null);
    start(async () => {
      try { await api(`/api/leads/${id}`, { method: "PATCH", json: { stage: to, ...(dealValueCents !== undefined ? { deal_value_cents: dealValueCents } : {}) } }); }
      catch (e) { setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage: from } : l))); setError((e as Error).message); }
    });
  }

  function move(id: string, to: Stage) {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === to) return;
    if (to === "won") {
      // Mostra no destino e pede o valor antes de salvar.
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage: to } : l)));
      setPendingWon({ id, from: lead.stage });
      return;
    }
    persist(id, lead.stage, to);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const to = e.over?.id as Stage | undefined;
    if (to && STAGES.includes(to)) move(String(e.active.id), to);
  }

  const active = leads.find((l) => l.id === activeId);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa" aria-label="Buscar no CRM" className="pl-9" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <NativeSelect aria-label="Filtrar por site" value={site} onChange={(e) => setSite(e.target.value as typeof site)} className="sm:w-52">
            <option value="all">Todos os status de site</option>
            {(Object.keys(WEBSITE_STATUS_LABEL) as WebsiteStatus[]).map((k) => <option key={k} value={k}>{WEBSITE_STATUS_LABEL[k]}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Score mínimo" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="sm:w-36">
            {[0, 40, 60, 80].map((s) => <option key={s} value={s}>{s === 0 ? "Qualquer score" : `Score ≥ ${s}`}</option>)}
          </NativeSelect>
          <AddLeadDialog onCreated={(l) => setLeads((ls) => [l, ...ls])} />
          <Button asChild variant="outline"><a href="/api/leads/export"><Download />Exportar CSV</a></Button>
        </div>
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
      <p className="sr-only" aria-live="polite">{filtered.length} leads exibidos</p>

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}
        accessibility={{ announcements: {
          onDragStart: ({ active }) => `Movendo ${leads.find((l) => l.id === active.id)?.name}.`,
          onDragOver: ({ over }) => (over ? `Sobre a coluna ${STAGE_LABEL[over.id as Stage]}.` : "Fora das colunas."),
          onDragEnd: ({ over }) => (over ? `Solto em ${STAGE_LABEL[over.id as Stage]}.` : "Movimento cancelado."),
          onDragCancel: () => "Movimento cancelado.",
        }, screenReaderInstructions: { draggable: "Pressione espaço para pegar o card, setas para mover entre colunas e espaço para soltar. Ou use o seletor Mover para." } }}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {STAGES.map((s) => <Column key={s} stage={s} leads={filtered.filter((l) => l.stage === s)} onMove={move} />)}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>{active ? <Card lead={active} overlay /> : null}</DragOverlay>
      </DndContext>

      <WonDialog
        open={Boolean(pendingWon)}
        onCancel={() => { if (pendingWon) setLeads((ls) => ls.map((l) => (l.id === pendingWon.id ? { ...l, stage: pendingWon.from } : l))); setPendingWon(null); }}
        onConfirm={(cents) => { const p = pendingWon!; setPendingWon(null); persist(p.id, p.from, "won", cents); }}
      />
    </div>
  );
}

/** Setas esquerda/direita saltam para o centro da coluna vizinha (o padrão move só 25 px). */
const columnJump: KeyboardCoordinateGetter = (event, { context: { active, droppableRects, over } }) => {
  if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.code) || !active) return undefined;
  event.preventDefault();
  const current = (over?.id as Stage | undefined) ?? (STAGES.find((s) => droppableRects.get(s) && active.rect.current.translated && rectContains(droppableRects.get(s)!, active.rect.current.translated)) ?? null);
  const idx = current ? STAGES.indexOf(current) : 0;
  const step = event.code === "ArrowRight" || event.code === "ArrowDown" ? 1 : -1;
  const next = STAGES[Math.min(STAGES.length - 1, Math.max(0, idx + step))]!;
  const r = droppableRects.get(next);
  if (!r) return undefined;
  const size = active.rect.current.translated ?? active.rect.current.initial;
  return { x: r.left + r.width / 2 - (size?.width ?? 0) / 2, y: r.top + 48 };
};
const rectContains = (r: { left: number; top: number; width: number; height: number }, a: { left: number; top: number; width: number; height: number }) => {
  const cx = a.left + a.width / 2, cy = a.top + a.height / 2;
  return cx >= r.left && cx <= r.left + r.width && cy >= r.top && cy <= r.top + r.height;
};

function Column({ stage, leads, onMove }: { stage: Stage; leads: Lead[]; onMove: (id: string, to: Stage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef} aria-label={STAGE_LABEL[stage]}
      className={cn("flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border bg-[#0c110d] p-2.5 transition-colors sm:w-72", isOver ? "border-primary/60 bg-primary/5" : "border-border")}>
      <header className="flex items-center justify-between px-1.5 pb-2 pt-1">
        <h2 className={cn("text-sm font-semibold", stage === "won" && "text-primary-strong", stage === "lost" && "text-muted")}>{STAGE_LABEL[stage]}</h2>
        <span className="tabular rounded-md bg-surface-2 px-1.5 text-xs text-muted">{leads.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">
        {leads.map((l) => <Card key={l.id} lead={l} onMove={onMove} />)}
        {leads.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted">Arraste um card para cá</p>}
      </div>
    </section>
  );
}

function Card({ lead, onMove, overlay }: { lead: Lead; onMove?: (id: string, to: Stage) => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, disabled: overlay });
  return (
    <article ref={overlay ? undefined : setNodeRef}
      className={cn("group rounded-lg border border-border-strong bg-surface p-3 text-sm", isDragging && "opacity-30", overlay && "rotate-1 border-primary/60 shadow-2xl shadow-black/60")}>
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} aria-label={`Arrastar ${lead.name}`} className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted hover:text-foreground active:cursor-grabbing">
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${lead.id}`} className="line-clamp-2 font-medium leading-snug hover:text-primary-strong">{lead.name}</Link>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={siteTone[lead.website_status]}><Globe className="size-3" />{WEBSITE_STATUS_LABEL[lead.website_status]}</Badge>
            {lead.is_simulated && <Badge tone="warning">Simulado</Badge>}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
            {lead.phone_e164 && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{formatPhoneBR(lead.phone_e164)}</span>}
            {lead.instagram && <span className="inline-flex items-center gap-1"><AtSign className="size-3" />{lead.instagram_verified ? "validado" : "a validar"}</span>}
          </div>
        </div>
        <ScoreRing score={lead.score} />
      </div>
      {onMove && (
        <NativeSelect aria-label={`Mover ${lead.name} para`} value={lead.stage} onChange={(e) => onMove(lead.id, e.target.value as Stage)} className="mt-3 h-8 text-xs">
          {STAGES.map((s) => <option key={s} value={s}>Mover para: {STAGE_LABEL[s]}</option>)}
        </NativeSelect>
      )}
    </article>
  );
}

export function ScoreRing({ score, size = 34 }: { score: number; size?: number }) {
  const r = size / 2 - 3, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} title={`Lead Score ${score}`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#243026" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={score >= 60 ? "#34d399" : score >= 40 ? "#10b981" : "#4b5f50"} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="tabular absolute text-[10px] font-semibold"><span className="sr-only">Score </span>{score}</span>
    </span>
  );
}

function WonDialog({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: (cents: number | undefined) => void }) {
  const [value, setValue] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent title="Marcar como vendido" description="Informe o valor fechado para registrar a receita realizada. Deixe em branco se ainda não souber.">
        <form onSubmit={(e) => { e.preventDefault(); const n = Number(value.replace(/\./g, "").replace(",", ".")); onConfirm(value.trim() && Number.isFinite(n) ? Math.round(n * 100) : undefined); setValue(""); }} className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="won-value">Valor (R$)</Label><Input id="won-value" inputMode="decimal" placeholder="1.500,00" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button>Confirmar venda</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
