import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { isWithinSendWindow, nextSendSlot, retryDelayMs, checkSendEligibility, zonedParts } from "@/lib/domain/whatsapp/schedule";
import { verifyMetaSignature, parseWebhook, isOptOut } from "@/lib/domain/whatsapp/webhook";

describe("janela de envio (America/Sao_Paulo, seg–sex 09–17)", () => {
  it("terça 10:00 BRT dentro", () => expect(isWithinSendWindow(new Date("2026-11-24T13:00:00Z"))).toBe(true));
  it("terça 17:00 BRT fora (fim exclusivo)", () => expect(isWithinSendWindow(new Date("2026-11-24T20:00:00Z"))).toBe(false));
  it("sábado fora", () => expect(isWithinSendWindow(new Date("2026-11-28T14:00:00Z"))).toBe(false));
  it("sexta 18h → segunda 09:00", () => {
    const n = nextSendSlot(new Date("2026-11-27T21:00:00Z"));
    const z = zonedParts(n);
    expect([z.weekday, z.hour, z.minute]).toEqual([1, 9, 0]);
  });
  it("já dentro mantém o instante (arredondado ao minuto)", () => {
    const d = new Date("2026-11-24T13:00:00Z");
    expect(nextSendSlot(d).getTime()).toBe(d.getTime());
  });
});

describe("retries limitados", () => {
  it("3 tentativas no máximo", () => {
    expect(retryDelayMs(1)).toBe(5 * 60_000);
    expect(retryDelayMs(2)).toBe(20 * 60_000);
    expect(retryDelayMs(3)).toBeNull();
  });
});

describe("elegibilidade de envio", () => {
  const ok = { sendingEnabled: true, consent: { status: "granted" as const, evidence: "Formulário site 2026-11-20 IP x" }, suppressed: false, humanApproved: true, hasRepliedOrOptedOut: false, insideCustomerServiceWindow: false, templateName: "apresentacao_v1" };
  it("tudo certo → ok", () => expect(checkSendEligibility(ok).ok).toBe(true));
  it("sem opt-in bloqueia (número público não basta)", () => expect(checkSendEligibility({ ...ok, consent: null }).ok).toBe(false));
  it("opt-in sem evidência bloqueia", () => expect(checkSendEligibility({ ...ok, consent: { status: "granted", evidence: " " } }).ok).toBe(false));
  it("revogado bloqueia", () => expect(checkSendEligibility({ ...ok, consent: { status: "revoked", evidence: "x" } }).ok).toBe(false));
  it("supressão / resposta / sem aprovação / desabilitado bloqueiam", () => {
    for (const patch of [{ suppressed: true }, { hasRepliedOrOptedOut: true }, { humanApproved: false }, { sendingEnabled: false }])
      expect(checkSendEligibility({ ...ok, ...patch }).ok).toBe(false);
  });
  it("fora da janela 24h exige template", () => expect(checkSendEligibility({ ...ok, templateName: null }).ok).toBe(false));
});

describe("webhook", () => {
  const secret = "s3cr3t";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: {
    messages: [{ from: "5548999998888", id: "wamid.1", timestamp: "1764000000", type: "text", text: { body: "PARAR" } }],
    statuses: [{ id: "wamid.0", recipient_id: "5548999998888", status: "delivered", timestamp: "1764000000" }],
  } }] }] });
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  it("assinatura válida", () => expect(verifyMetaSignature(body, sig, secret)).toBe(true));
  it("assinatura inválida / ausente / corpo alterado", () => {
    expect(verifyMetaSignature(body, "sha256=" + "0".repeat(64), secret)).toBe(false);
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
    expect(verifyMetaSignature(body + " ", sig, secret)).toBe(false);
  });
  it("parse detecta opt-out e status", () => {
    const ev = parseWebhook(JSON.parse(body));
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ type: "inbound", from: "+5548999998888", optOut: true });
    expect(ev[1]).toMatchObject({ type: "status", status: "delivered" });
  });
  it("opt-out keywords", () => {
    expect(isOptOut("não tenho interesse")).toBe(true);
    expect(isOptOut("Sair")).toBe(true);
    expect(isOptOut("Quero saber mais")).toBe(false);
  });
});
