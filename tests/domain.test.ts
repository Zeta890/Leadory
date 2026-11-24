import { describe, it, expect } from "vitest";
import { haversineKm, withinRadius } from "@/lib/domain/geo";
import { normalizePhoneBR, Deduper, normalizeName, normalizeInstagram, isMobileBR } from "@/lib/domain/normalize";
import { computeLeadScore } from "@/lib/domain/score";
import { assertSafeUrl, isPublicIp } from "@/lib/domain/ssrf";
import { decideWebsiteStatus, extractSignals, isOwnWebsiteCandidate } from "@/lib/domain/audit";
import { buildDefaultMessage, validateMessage, MAX_MESSAGE_CHARS } from "@/lib/domain/message";
import { buildPreview } from "@/lib/domain/preview";

const FLORIPA = { lat: -27.5954, lng: -48.548 };

describe("geo", () => {
  it("haversine: Florianópolis → São José ≈ 7–10 km", () => {
    const d = haversineKm(FLORIPA, { lat: -27.6136, lng: -48.6366 });
    expect(d).toBeGreaterThan(7);
    expect(d).toBeLessThan(10);
  });
  it("raio 50 km inclui Palhoça e exclui Itajaí/Blumenau", () => {
    expect(withinRadius(FLORIPA, { lat: -27.6455, lng: -48.6697 }, 50)).toBe(true);
    expect(withinRadius(FLORIPA, { lat: -26.9078, lng: -48.6619 }, 50)).toBe(false);
    expect(withinRadius(FLORIPA, { lat: -26.9194, lng: -49.0661 }, 50)).toBe(false);
  });
  it("sem coordenadas → fora", () => expect(withinRadius(FLORIPA, null, 50)).toBe(false));
});

describe("normalize", () => {
  it.each([
    ["(48) 3222-1234", "+554832221234"],
    ["+55 48 99999-8888", "+5548999998888"],
    ["048 99999 8888", "+5548999998888"],
    ["5548999998888", "+5548999998888"],
  ])("%s → %s", (raw, out) => expect(normalizePhoneBR(raw)).toBe(out));
  it("rejeita inválidos", () => {
    expect(normalizePhoneBR("12345")).toBeNull();
    expect(normalizePhoneBR("(48) 8999-88881")).toBeNull();
    expect(normalizePhoneBR(null)).toBeNull();
  });
  it("móvel ≠ WhatsApp, mas identifica celular", () => {
    expect(isMobileBR("+5548999998888")).toBe(true);
    expect(isMobileBR("+554832221234")).toBe(false);
  });
  it("nome ignora acentos e ruído societário", () => {
    expect(normalizeName("Clínica Odontológica Sorriso LTDA")).toBe(normalizeName("clinica odontologica SORRISO"));
  });
  it("dedupe por place id, telefone ou nome+endereço", () => {
    const d = new Deduper();
    const base = { source: "google_places", sourceId: "A", name: "Sorriso", address: "Rua X, 10", phone: "(48) 3222-1234" };
    expect(d.add(base)).toBe(true);
    expect(d.add({ ...base, sourceId: "B", address: "outro" })).toBe(false); // mesmo telefone
    expect(d.add({ ...base, sourceId: "C", phone: null, address: "R. X, 10" })).toBe(false); // nome+endereço
    expect(d.add({ ...base, sourceId: "A", phone: null, address: null })).toBe(false); // mesmo id
    expect(d.add({ ...base, sourceId: "D", phone: "(48) 3000-0000", name: "Outra", address: "Rua Y" })).toBe(true);
  });
  it("instagram", () => {
    expect(normalizeInstagram("https://www.instagram.com/Clinica.Sorriso/")).toBe("clinica.sorriso");
    expect(normalizeInstagram("@clinica_x")).toBe("clinica_x");
    expect(normalizeInstagram("https://instagram.com/p/abc")).toBeNull();
  });
});

describe("lead score", () => {
  const base = { websiteStatus: "not_identified" as const, instagramActiveVerified: true, reviewCount: 31, rating: 4.1, phoneVerified: true, name: "Clínica de Implantes", priorityKeywords: ["implante"] };
  it("máximo = 100", () => expect(computeLeadScore(base).score).toBe(100));
  it("inconclusivo não ganha os 40 pontos", () => expect(computeLeadScore({ ...base, websiteStatus: "inconclusive" }).score).toBe(60));
  it("limiares estritos (>30, >4)", () => expect(computeLeadScore({ ...base, reviewCount: 30, rating: 4 }).score).toBe(80));
  it("especialidade ignora acento", () => expect(computeLeadScore({ ...base, name: "Estetica Dental", priorityKeywords: ["estética"] }).breakdown.find((b) => b.key === "specialty")?.earned).toBe(true));
});

describe("SSRF", () => {
  it.each(["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "0.0.0.0", "fd00::1"])("bloqueia %s", (ip) => expect(isPublicIp(ip)).toBe(false));
  it("permite IP público", () => expect(isPublicIp("8.8.8.8")).toBe(true));
  it.each(["file:///etc/passwd", "http://localhost/", "http://user:pw@example.com", "http://example.com:8080", "http://169.254.169.254/latest", "http://intranet/", "gopher://x.com", "http://svc.internal/"])("rejeita %s", (u) => expect(() => assertSafeUrl(u)).toThrow());
  it("aceita https público", () => expect(assertSafeUrl("https://example.com/a").hostname).toBe("example.com"));
});

describe("auditoria de site", () => {
  const base = { sourceWebsite: null, sourceWebsiteReachable: null, webSearchExecuted: true, webCandidates: [], humanValidatedWebsite: null, humanConfirmedNoWebsite: false };
  it("sem busca executada → inconclusivo (ausência não é prova)", () => expect(decideWebsiteStatus({ ...base, webSearchExecuted: false })).toBe("inconclusive"));
  it("busca executada sem candidatos → nenhum site identificado", () => expect(decideWebsiteStatus(base)).toBe("not_identified"));
  it("candidato sem validação → inconclusivo", () => expect(decideWebsiteStatus({ ...base, webCandidates: ["https://x.com.br"] })).toBe("inconclusive"));
  it("site da fonte acessível → identificado", () => expect(decideWebsiteStatus({ ...base, sourceWebsite: "https://sorriso.com.br", sourceWebsiteReachable: true })).toBe("identified"));
  it("site da fonte inacessível → inconclusivo", () => expect(decideWebsiteStatus({ ...base, sourceWebsite: "https://sorriso.com.br", sourceWebsiteReachable: false })).toBe("inconclusive"));
  it("instagram como 'site' não conta como site próprio", () => {
    expect(isOwnWebsiteCandidate("https://instagram.com/x")).toBe(false);
    expect(decideWebsiteStatus({ ...base, sourceWebsite: "https://instagram.com/x" })).toBe("not_identified");
  });
  it("validação humana prevalece", () => expect(decideWebsiteStatus({ ...base, humanConfirmedNoWebsite: true, webSearchExecuted: false })).toBe("not_identified"));
  it("extrai sinais sem executar conteúdo", () => {
    const s = extractSignals('<title> Sorriso </title><meta name="viewport"><a href="https://instagram.com/sorriso">ig</a><a href="https://wa.me/5548">w</a> Agende', "https://a.com");
    expect(s).toMatchObject({ title: "Sorriso", hasViewport: true, hasHttps: true, instagramHandles: ["sorriso"], hasWhatsappLink: true, hasBookingKeywords: true });
  });
});

describe("mensagens", () => {
  const ctx = { senderName: "Pedro", senderRole: "desenvolvedor de sites", businessName: "Clínica Sorriso" };
  it("com prévia segue o modelo e respeita limite", () => {
    const m = buildDefaultMessage({ ...ctx, previewReady: true });
    expect(m).toContain("criei uma prévia");
    expect(m.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    expect(validateMessage(m, { previewReady: true, businessName: ctx.businessName }).ok).toBe(true);
  });
  it("sem prévia não afirma prévia pronta", () => {
    const m = buildDefaultMessage({ ...ctx, previewReady: false });
    expect(m).not.toMatch(/criei uma prévia/);
    expect(m).toContain("gostaria de apresentar uma ideia");
    expect(validateMessage(m, { previewReady: false, businessName: ctx.businessName }).ok).toBe(true);
  });
  it("bloqueia afirmação falsa de prévia", () => {
    const v = validateMessage("Olá, criei uma prévia para vocês. Posso mostrar?", { previewReady: false, businessName: "X" });
    expect(v.ok).toBe(false);
  });
  it("bloqueia promessas garantidas e excesso", () => {
    expect(validateMessage("Garantimos o dobro de pacientes. Vamos conversar?", { previewReady: true, businessName: "X" }).ok).toBe(false);
    expect(validateMessage("a".repeat(400) + "?", { previewReady: true, businessName: "X" }).ok).toBe(false);
  });
  it("nome muito longo ainda cabe em 350", () => {
    expect(buildDefaultMessage({ ...ctx, businessName: "X".repeat(400), previewReady: true }).length).toBeLessThanOrEqual(350);
  });
});

describe("prévia", () => {
  it("não inventa serviços; usa placeholders", () => {
    const p = buildPreview({ businessName: "Sorriso", address: null, phoneE164: null, city: "Florianópolis", confirmedServices: [], instagram: null });
    expect(p.placeholders).toEqual(expect.arrayContaining(["Tratamentos oferecidos", "Endereço", "Telefone"]));
    expect(JSON.stringify(p)).not.toMatch(/depoimento|anos de experiência|\d+ pacientes/i);
    expect(p.sections.at(-1)?.kind).toBe("disclaimer");
  });
});
