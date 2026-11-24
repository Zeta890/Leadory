import { describe, it, expect } from "vitest";
import { runDiscovery, FLORIPA_DENTAL_CAMPAIGN } from "@/lib/discovery/engine";
import { ProviderError, type DiscoveryProvider } from "@/lib/discovery/provider";
import type { DiscoveredBusiness } from "@/lib/domain/types";

// Provedor de TESTE com fixtures sintéticas — nunca usado pela aplicação.
function fakeProvider(pages: Record<string, DiscoveredBusiness[][]>, opts: { failOn?: string; fatal?: boolean } = {}): DiscoveryProvider & { calls: number } {
  return {
    name: "fake", calls: 0,
    async searchText({ query, pageToken }) {
      this.calls++;
      if (opts.failOn === query) throw new ProviderError("boom", opts.fatal ? 403 : 503, !opts.fatal);
      const list = pages[query] ?? [];
      const idx = pageToken ? Number(pageToken) : 0;
      return { items: list[idx] ?? [], nextPageToken: idx + 1 < list.length ? String(idx + 1) : null };
    },
  };
}
let n = 0;
function biz(p: Partial<DiscoveredBusiness> = {}): DiscoveredBusiness {
  n++;
  return { source: "fake", sourceId: `id${n}`, sourceUrl: null, name: `Empresa Teste ${n}`, address: `Rua ${n}, ${n}`, location: { lat: -27.6, lng: -48.55 }, phone: `(48) 3${String(n).padStart(3, "0")}-${String(1000 + n).slice(-4)}`, website: null, rating: 4.5, reviewCount: 10, types: [], businessStatus: "OPERATIONAL", ...p };
}
const crit = (q: string[], max = 100) => ({ ...FLORIPA_DENTAL_CAMPAIGN, queryVariants: q, maxCompanies: max });

describe("motor de descoberta", () => {
  it("limita a 100 empresas únicas mesmo com mais resultados e duplicatas", async () => {
    const pagesA = [0, 1, 2].map(() => Array.from({ length: 20 }, () => biz()));
    const dupes = pagesA.flat().slice(0, 20).map((b) => ({ ...b, sourceId: `${b.sourceId}-dup` }));
    const pagesB = [dupes, Array.from({ length: 20 }, () => biz()), Array.from({ length: 20 }, () => biz())];
    const pagesC = [0, 1, 2].map(() => Array.from({ length: 20 }, () => biz()));
    const r = await runDiscovery(fakeProvider({ a: pagesA, b: pagesB, c: pagesC }), crit(["a", "b", "c"]), { maxRequests: 50 });
    expect(r.accepted).toHaveLength(100);
    expect(new Set(r.accepted.map((x) => x.phoneE164)).size).toBe(100);
    expect(r.rejected.duplicate).toBe(20);
  });
  it("filtra raio de 50 km, telefone obrigatório e empresas fechadas", async () => {
    const items = [biz(), biz({ location: { lat: -26.9, lng: -48.66 } }), biz({ phone: null }), biz({ businessStatus: "CLOSED_PERMANENTLY" }), biz({ location: null })];
    const r = await runDiscovery(fakeProvider({ q: [items] }), crit(["q"]), { maxRequests: 5 });
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toMatchObject({ outsideRadius: 1, noPhone: 1, closed: 1, noLocation: 1 });
    expect(r.exhausted).toBe(true);
  });
  it("prioriza empresas sem site na fonte", async () => {
    const items = [biz({ website: "https://a.com.br" }), biz({ website: "https://instagram.com/x" }), biz(), biz({ website: "https://b.com.br" })];
    const r = await runDiscovery(fakeProvider({ q: [items] }), crit(["q"], 2), { maxRequests: 5 });
    expect(r.accepted.every((x) => !x.hasSourceWebsite)).toBe(true);
  });
  it("falha transitória da API continua com próxima consulta e registra erro", async () => {
    const r = await runDiscovery(fakeProvider({ ok: [[biz()]] }, { failOn: "bad" }), crit(["bad", "ok"]), { maxRequests: 5 });
    expect(r.accepted).toHaveLength(1);
    expect(r.errors[0]).toMatch(/boom/);
  });
  it("falha fatal (403) interrompe", async () => {
    const r = await runDiscovery(fakeProvider({ ok: [[biz()]] }, { failOn: "bad", fatal: true }), crit(["bad", "ok"]), { maxRequests: 5 });
    expect(r.accepted).toHaveLength(0);
  });
  it("respeita orçamento de requisições", async () => {
    const p = fakeProvider({ q: [[biz()], [biz()], [biz()]] });
    const r = await runDiscovery(p, crit(["q"]), { maxRequests: 2 });
    expect(p.calls).toBe(2);
    expect(r.exhausted).toBe(false);
  });
  it("respeita chaves já existentes (re-execução não duplica)", async () => {
    const b = biz();
    const r = await runDiscovery(fakeProvider({ q: [[b]] }), crit(["q"]), { maxRequests: 2, existingKeys: [`src:fake:${b.sourceId}`] });
    expect(r.accepted).toHaveLength(0);
  });
  it("campanha inicial tem parâmetros exigidos", () => {
    expect(FLORIPA_DENTAL_CAMPAIGN).toMatchObject({ radiusKm: 50, maxCompanies: 100, prioritizeNoWebsite: true, requireInstagram: false, requireBusinessPhone: true });
  });
});
