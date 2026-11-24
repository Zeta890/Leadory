export const STAGES = ["qualified", "authorized", "interested", "meeting", "proposal", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  qualified: "Qualificado",
  authorized: "Autorizado",
  interested: "Interessado",
  meeting: "Reunião",
  proposal: "Proposta",
  won: "Vendido",
  lost: "Perdido",
};

/** Ausência de resultado NÃO é prova de inexistência: "not_identified" = nenhum site identificado nas fontes consultadas. */
export type WebsiteStatus = "unknown" | "inconclusive" | "identified" | "not_identified";

export const WEBSITE_STATUS_LABEL: Record<WebsiteStatus, string> = {
  unknown: "Não auditado",
  inconclusive: "Inconclusivo",
  identified: "Site identificado",
  not_identified: "Nenhum site identificado",
};

export interface GeoPoint { lat: number; lng: number }

/** Empresa como retornada por uma fonte de descoberta (dados não confiáveis). */
export interface DiscoveredBusiness {
  source: "google_places" | "manual" | string;
  sourceId: string | null;
  sourceUrl: string | null;
  name: string;
  address: string | null;
  location: GeoPoint | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  types: string[];
  businessStatus: string | null;
}

export interface CampaignCriteria {
  niche: string;
  city: string;
  center: GeoPoint;
  radiusKm: number;
  maxCompanies: number;
  prioritizeNoWebsite: boolean;
  requireInstagram: boolean;
  requireBusinessPhone: boolean;
  priorityKeywords: string[];
  queryVariants: string[];
}
