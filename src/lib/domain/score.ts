import type { WebsiteStatus } from "./types";

export interface ScoreInput {
  websiteStatus: WebsiteStatus;
  instagramActiveVerified: boolean;
  reviewCount: number | null;
  rating: number | null;
  phoneVerified: boolean;
  name: string;
  types?: string[];
  priorityKeywords: string[];
}

export interface ScoreBreakdownItem { key: string; label: string; points: number; earned: boolean }

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lead Score heurístico (0–100), regras definidas em CLAUDE.md. */
export function computeLeadScore(i: ScoreInput): { score: number; breakdown: ScoreBreakdownItem[] } {
  const haystack = strip([i.name, ...(i.types ?? [])].join(" "));
  const priority = i.priorityKeywords.some((k) => k.trim() && haystack.includes(strip(k.trim())));
  const breakdown: ScoreBreakdownItem[] = [
    { key: "no_site", label: "Nenhum site identificado", points: 40, earned: i.websiteStatus === "not_identified" },
    { key: "instagram", label: "Instagram ativo (validado)", points: 20, earned: i.instagramActiveVerified },
    { key: "reviews", label: "Mais de 30 avaliações", points: 10, earned: (i.reviewCount ?? 0) > 30 },
    { key: "rating", label: "Nota acima de 4", points: 10, earned: (i.rating ?? 0) > 4 },
    { key: "phone", label: "Telefone verificado", points: 10, earned: i.phoneVerified },
    { key: "specialty", label: "Especialidade prioritária", points: 10, earned: priority },
  ];
  const score = breakdown.reduce((s, b) => s + (b.earned ? b.points : 0), 0);
  return { score: Math.min(100, score), breakdown };
}
