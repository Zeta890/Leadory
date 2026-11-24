import type { CampaignCriteria, DiscoveredBusiness } from "@/lib/domain/types";
import { withinRadius, haversineKm } from "@/lib/domain/geo";
import { Deduper, normalizePhoneBR } from "@/lib/domain/normalize";
import { isOwnWebsiteCandidate } from "@/lib/domain/audit";
import { type DiscoveryProvider, ProviderError } from "./provider";

export interface QualifiedBusiness extends DiscoveredBusiness {
  phoneE164: string | null;
  distanceKm: number;
  hasSourceWebsite: boolean;
}

export interface RejectionStats { outsideRadius: number; noPhone: number; duplicate: number; closed: number; noLocation: number; noInstagram: number }

export interface DiscoveryRun {
  accepted: QualifiedBusiness[];
  rejected: RejectionStats;
  requests: number;
  queriesTried: string[];
  exhausted: boolean;
  errors: string[];
}

export interface RunOptions {
  maxRequests: number; // limite de custo
  existingKeys?: Iterable<string>;
  onProgress?: (p: { accepted: number; requests: number; query: string }) => void | Promise<void>;
  shouldStop?: () => boolean | Promise<boolean>;
}

/**
 * Executa descoberta sobre um provedor com variações de consulta até atingir maxCompanies únicas
 * (após filtros) ou esgotar as consultas/orçamento. Ordena priorizando empresas sem site na fonte.
 * Coleta um excedente (até 2x) antes do corte para que a priorização tenha efeito.
 */
export async function runDiscovery(provider: DiscoveryProvider, c: CampaignCriteria, o: RunOptions): Promise<DiscoveryRun> {
  const dedupe = new Deduper(o.existingKeys);
  const pool: QualifiedBusiness[] = [];
  const rejected: RejectionStats = { outsideRadius: 0, noPhone: 0, duplicate: 0, closed: 0, noLocation: 0, noInstagram: 0 };
  const errors: string[] = [];
  const queriesTried: string[] = [];
  let requests = 0;
  const target = c.prioritizeNoWebsite ? c.maxCompanies * 2 : c.maxCompanies;
  let budgetHit = false;

  outer: for (const query of c.queryVariants) {
    queriesTried.push(query);
    let token: string | null = null;
    for (let page = 0; page < 3; page++) {
      if (requests >= o.maxRequests) { budgetHit = true; break outer; }
      if (o.shouldStop && (await o.shouldStop())) break outer;
      let res;
      try {
        res = await provider.searchText({ query, center: c.center, radiusKm: c.radiusKm, pageToken: token });
        requests++;
      } catch (e) {
        requests++;
        const pe = e as ProviderError;
        errors.push(`${query}: ${pe.message}`);
        if (pe instanceof ProviderError && !pe.retryable) break outer;
        break;
      }
      for (const b of res.items) {
        if (b.businessStatus && b.businessStatus !== "OPERATIONAL") { rejected.closed++; continue; }
        if (!b.location) { rejected.noLocation++; continue; }
        if (!withinRadius(c.center, b.location, c.radiusKm)) { rejected.outsideRadius++; continue; }
        const phoneE164 = normalizePhoneBR(b.phone);
        if (c.requireBusinessPhone && !phoneE164) { rejected.noPhone++; continue; }
        // Exigência de Instagram não é verificável na descoberta; quando ligada, aplica-se após validação humana.
        if (!dedupe.add(b)) { rejected.duplicate++; continue; }
        pool.push({ ...b, phoneE164, distanceKm: Math.round(haversineKm(c.center, b.location) * 10) / 10, hasSourceWebsite: isOwnWebsiteCandidate(b.website) });
      }
      await o.onProgress?.({ accepted: Math.min(pool.length, c.maxCompanies), requests, query });
      if (pool.length >= target) break outer;
      token = res.nextPageToken;
      if (!token) break;
    }
  }

  const sorted = c.prioritizeNoWebsite
    ? [...pool].sort((a, b) => Number(a.hasSourceWebsite) - Number(b.hasSourceWebsite) || a.distanceKm - b.distanceKm)
    : pool;
  return {
    accepted: sorted.slice(0, c.maxCompanies),
    rejected,
    requests,
    queriesTried,
    exhausted: !budgetHit && pool.length < c.maxCompanies,
    errors,
  };
}

export const FLORIPA_DENTAL_CAMPAIGN: CampaignCriteria = {
  niche: "Clínicas odontológicas",
  city: "Florianópolis, SC",
  center: { lat: -27.5954, lng: -48.548 },
  radiusKm: 50,
  maxCompanies: 100,
  prioritizeNoWebsite: true,
  requireInstagram: false,
  requireBusinessPhone: true,
  priorityKeywords: ["implante", "ortodontia", "estética", "harmonização", "lente de contato dental", "prótese"],
  queryVariants: [
    "clínica odontológica em Florianópolis SC",
    "dentista em Florianópolis SC",
    "consultório odontológico Florianópolis",
    "clínica odontológica São José SC",
    "dentista Palhoça SC",
    "clínica odontológica Biguaçu SC",
    "implante dentário Florianópolis",
    "ortodontia Florianópolis",
    "dentista Santo Amaro da Imperatriz SC",
    "clínica odontológica Governador Celso Ramos SC",
    "dentista Ingleses Florianópolis",
    "dentista Campeche Florianópolis",
  ],
};
