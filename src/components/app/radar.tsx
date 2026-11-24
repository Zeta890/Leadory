import { haversineKm } from "@/lib/domain/geo";
import type { GeoPoint, WebsiteStatus } from "@/lib/domain/types";

export interface RadarPoint { id: string; name: string; lat: number; lng: number; websiteStatus: WebsiteStatus }

function bearing(a: GeoPoint, b: GeoPoint) {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return Math.atan2(y, x); // 0 = norte, sentido horário
}

const TONE: Record<WebsiteStatus, { fill: string; stroke: string; label: string }> = {
  not_identified: { fill: "#34d399", stroke: "#34d399", label: "Nenhum site identificado" },
  identified: { fill: "#4b5f50", stroke: "#4b5f50", label: "Site identificado" },
  inconclusive: { fill: "transparent", stroke: "#fbbf24", label: "Inconclusivo" },
  unknown: { fill: "transparent", stroke: "#9fb1a3", label: "Não auditado" },
};

/** Radar da campanha: cada empresa na distância e direção reais a partir do centro. */
export function CampaignRadar({ center, radiusKm, points, size = 320 }: { center: GeoPoint; radiusKm: number; points: RadarPoint[]; size?: number }) {
  const R = size / 2 - 14;
  const c = size / 2;
  const rings = [0.25, 0.5, 0.75, 1];
  const counts = points.reduce<Record<string, number>>((m, p) => ((m[p.websiteStatus] = (m[p.websiteStatus] ?? 0) + 1), m), {});
  const summary = `${points.length} empresas num raio de ${radiusKm} km; ${counts.not_identified ?? 0} sem site identificado.`;
  return (
    <figure className="flex flex-col items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[360px]" role="img" aria-label={summary}>
        <defs>
          <radialGradient id="rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#10b981" stopOpacity="0.14" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" /></radialGradient>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#34d399" stopOpacity="0" /><stop offset="100%" stopColor="#34d399" stopOpacity="0.35" /></linearGradient>
        </defs>
        <circle cx={c} cy={c} r={R} fill="url(#rg)" />
        {rings.map((f) => <circle key={f} cx={c} cy={c} r={R * f} fill="none" stroke="#243026" strokeDasharray={f === 1 ? undefined : "2 4"} />)}
        <line x1={c} y1={c - R} x2={c} y2={c + R} stroke="#1c261e" />
        <line x1={c - R} y1={c} x2={c + R} y2={c} stroke="#1c261e" />
        {rings.slice(1).map((f) => <text key={f} x={c + 4} y={c - R * f + 12} fill="#6f8273" fontSize="10" className="tabular">{Math.round(radiusKm * f)} km</text>)}
        <text x={c} y={12} textAnchor="middle" fill="#6f8273" fontSize="10">N</text>
        <g className="origin-center motion-safe:animate-[spin_2.4s_cubic-bezier(0.4,0,0.2,1)_1]" style={{ transformOrigin: `${c}px ${c}px` }}>
          <path d={`M${c} ${c} L${c} ${c - R} A${R} ${R} 0 0 1 ${c + R * Math.sin(Math.PI / 5)} ${c - R * Math.cos(Math.PI / 5)} Z`} fill="url(#sweep)" opacity="0.6" />
        </g>
        {points.map((p) => {
          const d = Math.min(1, haversineKm(center, p) / radiusKm);
          const th = bearing(center, p);
          const t = TONE[p.websiteStatus];
          return (
            <circle key={p.id} cx={c + Math.sin(th) * d * R} cy={c - Math.cos(th) * d * R} r={p.websiteStatus === "not_identified" ? 3.6 : 3} fill={t.fill} stroke={t.stroke} strokeWidth="1.3">
              <title>{`${p.name} — ${t.label}`}</title>
            </circle>
          );
        })}
        <circle cx={c} cy={c} r="4" fill="#eaf3eb" />
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
        {(Object.keys(TONE) as WebsiteStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="3.5" fill={TONE[k].fill} stroke={TONE[k].stroke} strokeWidth="1.3" /></svg>
            {TONE[k].label} <span className="tabular text-foreground">{counts[k] ?? 0}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
