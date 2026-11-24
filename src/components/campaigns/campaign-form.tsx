"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface CampaignTemplate {
  name: string; niche: string; city: string; center_lat: number; center_lng: number; radius_km: number; max_companies: number;
  prioritize_no_website: boolean; require_instagram: boolean; require_business_phone: boolean; priority_keywords: string[]; query_variants: string[]; max_requests: number;
}

export function CampaignForm({ template, placesReady }: { template: CampaignTemplate; placesReady: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(template);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof CampaignTemplate>(k: K, val: CampaignTemplate[K]) => setV((s) => ({ ...s, [k]: val }));
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { campaign } = await api<{ campaign: { id: string } }>("/api/campaigns", { method: "POST", json: v });
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle>Alvo</CardTitle><CardDescription>Nicho, região e quantidade de empresas únicas.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Nome da campanha" className="sm:col-span-2"><Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} /></Field>
          <Field id="niche" label="Nicho"><Input id="niche" value={v.niche} onChange={(e) => set("niche", e.target.value)} required /></Field>
          <Field id="city" label="Cidade"><Input id="city" value={v.city} onChange={(e) => set("city", e.target.value)} required /></Field>
          <Field id="lat" label="Latitude do centro"><Input id="lat" type="number" step="0.0001" value={v.center_lat} onChange={(e) => set("center_lat", Number(e.target.value))} required /></Field>
          <Field id="lng" label="Longitude do centro"><Input id="lng" type="number" step="0.0001" value={v.center_lng} onChange={(e) => set("center_lng", Number(e.target.value))} required /></Field>
          <Field id="radius" label={`Raio: ${v.radius_km} km`}>
            <input id="radius" type="range" min={1} max={50} value={v.radius_km} onChange={(e) => set("radius_km", Number(e.target.value))} className="w-full accent-[#10b981]" />
          </Field>
          <Field id="max" label="Limite de empresas únicas"><Input id="max" type="number" min={1} max={100} value={v.max_companies} onChange={(e) => set("max_companies", Number(e.target.value))} required /></Field>
          <Field id="queries" label="Consultas de busca (uma por linha)" className="sm:col-span-2" hint="Variações de termo e bairro/cidade vizinha ampliam a cobertura. Resultados fora do raio são descartados pela distância real.">
            <Textarea id="queries" rows={6} value={v.query_variants.join("\n")} onChange={(e) => set("query_variants", lines(e.target.value))} />
          </Field>
          <Field id="kw" label="Especialidades prioritárias (uma por linha)" className="sm:col-span-2" hint="Somam 10 pontos no Lead Score quando aparecem no nome ou nas categorias.">
            <Textarea id="kw" rows={3} value={v.priority_keywords.join("\n")} onChange={(e) => set("priority_keywords", lines(e.target.value))} />
          </Field>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle>Critérios</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Toggle id="nosite" label="Priorizar sem site" hint="Empresas sem site na fonte vêm primeiro." checked={v.prioritize_no_website} onChange={(b) => set("prioritize_no_website", b)} />
            <Toggle id="phone" label="Exigir telefone comercial" hint="Descarta empresas sem telefone válido." checked={v.require_business_phone} onChange={(b) => set("require_business_phone", b)} />
            <Toggle id="ig" label="Exigir Instagram" hint="Aplicado após validação humana do perfil." checked={v.require_instagram} onChange={(b) => set("require_instagram", b)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Custo</CardTitle><CardDescription>Cada página de busca é uma requisição faturada pelo provedor.</CardDescription></CardHeader>
          <CardContent><Field id="req" label="Máximo de requisições nesta campanha"><Input id="req" type="number" min={1} max={500} value={v.max_requests} onChange={(e) => set("max_requests", Number(e.target.value))} /></Field></CardContent>
        </Card>
        {!placesReady && <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">A Google Places API ainda não está configurada no servidor. Você pode salvar a campanha agora e executá-la depois de configurar a chave.</p>}
        {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
        <Button size="lg" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Salvar campanha</Button>
      </div>
    </form>
  );
}

function Field({ id, label, hint, className, children }: { id: string; label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <div className={`grid gap-1.5 ${className ?? ""}`}><Label htmlFor={id}>{label}</Label>{children}{hint && <p className="text-[11px] text-muted">{hint}</p>}</div>;
}
function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div><Label htmlFor={id} className="text-sm text-foreground">{label}</Label><p className="text-[11px] text-muted">{hint}</p></div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
