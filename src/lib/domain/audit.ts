import type { WebsiteStatus } from "./types";
import { normalizeInstagram } from "./normalize";

/** Hosts que não contam como "site próprio" (agregadores, redes sociais, encurtadores). */
const NOT_OWN_SITE = [
  "instagram.com", "facebook.com", "fb.com", "wa.me", "whatsapp.com", "api.whatsapp.com", "linktr.ee", "linkr.bio",
  "google.com", "g.page", "maps.app.goo.gl", "goo.gl", "bit.ly", "doctoralia.com.br", "tiktok.com", "youtube.com",
  "boaconsulta.com", "linkedin.com", "twitter.com", "x.com",
];

export function hostOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

export function isOwnWebsiteCandidate(url: string | null | undefined): boolean {
  if (!url) return false;
  const h = hostOf(url);
  if (!h) return false;
  return !NOT_OWN_SITE.some((d) => h === d || h.endsWith(`.${d}`));
}

export interface HtmlSignals {
  title: string | null;
  hasViewport: boolean;
  hasHttps: boolean;
  instagramHandles: string[];
  hasWhatsappLink: boolean;
  hasBookingKeywords: boolean;
  bytes: number;
}

/** Extração por regex (sem executar nada do conteúdo externo). */
export function extractSignals(html: string, finalUrl: string): HtmlSignals {
  const sample = html.slice(0, 600_000);
  const title = sample.match(/<title[^>]*>([^<]{0,200})<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  const ig = new Set<string>();
  for (const m of sample.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/gi)) {
    const h = normalizeInstagram(m[0]);
    if (h) ig.add(h);
  }
  return {
    title,
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(sample),
    hasHttps: finalUrl.startsWith("https://"),
    instagramHandles: [...ig].slice(0, 5),
    hasWhatsappLink: /(wa\.me\/|api\.whatsapp\.com\/send)/i.test(sample),
    hasBookingKeywords: /agend(e|ar|amento)|marque sua consulta/i.test(sample),
    bytes: html.length,
  };
}

export interface AuditEvidence { kind: string; detail: string; url?: string; at: string }

export interface WebsiteDecisionInput {
  /** Site informado pela fonte de descoberta (ex.: websiteUri do Places). */
  sourceWebsite: string | null;
  /** Resultado da checagem HTTP do site da fonte; null quando não checado. */
  sourceWebsiteReachable: boolean | null;
  /** A busca web foi realmente executada com sucesso? */
  webSearchExecuted: boolean;
  /** Domínios candidatos encontrados na busca web (requerem validação humana). */
  webCandidates: string[];
  /** Domínio validado manualmente por humano. */
  humanValidatedWebsite: string | null;
  humanConfirmedNoWebsite: boolean;
}

/**
 * Decide o estado de site. Regra: só "not_identified" quando TODAS as fontes consultadas
 * foram de fato consultadas e nada foi encontrado. Falhas → "inconclusive".
 */
export function decideWebsiteStatus(i: WebsiteDecisionInput): WebsiteStatus {
  if (i.humanValidatedWebsite) return "identified";
  if (i.humanConfirmedNoWebsite) return "not_identified";
  if (i.sourceWebsite && isOwnWebsiteCandidate(i.sourceWebsite)) {
    if (i.sourceWebsiteReachable === true) return "identified";
    return "inconclusive";
  }
  if (!i.webSearchExecuted) return "inconclusive";
  if (i.webCandidates.length > 0) return "inconclusive"; // candidato aguarda validação humana
  return "not_identified";
}
