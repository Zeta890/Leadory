import "server-only";
import { isOwnWebsiteCandidate, hostOf } from "@/lib/domain/audit";
import { normalizeInstagram } from "@/lib/domain/normalize";

export interface WebPresenceResult { executed: boolean; websiteCandidates: string[]; instagramCandidates: string[]; error?: string; query: string }

/** Brave Search API (licenciada para uso programático). Resultados são candidatos e exigem validação humana. */
export async function searchWebPresence(
  args: { businessName: string; city: string; apiKey: string | undefined },
  fetchImpl: typeof fetch = fetch,
): Promise<WebPresenceResult> {
  const query = `"${args.businessName}" ${args.city}`;
  if (!args.apiKey) return { executed: false, websiteCandidates: [], instagramCandidates: [], error: "BRAVE_SEARCH_API_KEY ausente", query };
  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "10");
    url.searchParams.set("country", "BR");
    url.searchParams.set("search_lang", "pt-br");
    const res = await fetchImpl(url, { headers: { Accept: "application/json", "X-Subscription-Token": args.apiKey }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { executed: false, websiteCandidates: [], instagramCandidates: [], error: `Busca web respondeu ${res.status}`, query };
    const json = (await res.json()) as { web?: { results?: { url: string; title?: string }[] } };
    const results = json.web?.results ?? [];
    const tokens = args.businessName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\W+/).filter((t) => t.length > 3);
    const sites = new Set<string>();
    const ig = new Set<string>();
    for (const r of results) {
      const h = hostOf(r.url);
      if (!h) continue;
      if (h.endsWith("instagram.com")) { const handle = normalizeInstagram(r.url); if (handle) ig.add(handle); continue; }
      // Candidato a site próprio somente se o domínio compartilha um token do nome.
      if (isOwnWebsiteCandidate(r.url) && tokens.some((t) => h.replace(/[^a-z0-9]/g, "").includes(t))) sites.add(`https://${h}`);
    }
    return { executed: true, websiteCandidates: [...sites].slice(0, 3), instagramCandidates: [...ig].slice(0, 3), query };
  } catch (e) {
    return { executed: false, websiteCandidates: [], instagramCandidates: [], error: (e as Error).message, query };
  }
}
