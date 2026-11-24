import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

vi.mock("@/lib/session", () => ({ apiCtx: async () => null, requireCtx: async () => { throw new Error("no"); } }));

let webhook: typeof import("@/app/api/webhooks/whatsapp/route");
let dispatch: typeof import("@/app/api/cron/dispatch/route");
let campaigns: typeof import("@/app/api/campaigns/route");

beforeAll(async () => {
  process.env.WHATSAPP_APP_SECRET = "app-secret";
  process.env.WHATSAPP_VERIFY_TOKEN = "verify-me";
  process.env.CRON_SECRET = "cron-secret-123";
  webhook = await import("@/app/api/webhooks/whatsapp/route");
  dispatch = await import("@/app/api/cron/dispatch/route");
  campaigns = await import("@/app/api/campaigns/route");
});

const noParams = { params: Promise.resolve({}) };

describe("webhook WhatsApp", () => {
  it("verificação com token correto devolve challenge", async () => {
    const r = webhook.GET(new NextRequest("http://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42"));
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("42");
  });
  it("token errado → 403", () => {
    expect(webhook.GET(new NextRequest("http://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42")).status).toBe(403);
  });
  it("POST sem assinatura válida → 401 (nada é processado)", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const bad = await webhook.POST(new NextRequest("http://x/api/webhooks/whatsapp", { method: "POST", body, headers: { "x-hub-signature-256": "sha256=" + "a".repeat(64) } }));
    expect(bad.status).toBe(401);
  });
  it("assinatura válida passa da verificação (503 sem banco configurado)", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const sig = "sha256=" + createHmac("sha256", "app-secret").update(body).digest("hex");
    const r = await webhook.POST(new NextRequest("http://x/api/webhooks/whatsapp", { method: "POST", body, headers: { "x-hub-signature-256": sig } }));
    expect(r.status).toBe(503);
  });
});

describe("cron", () => {
  it("sem segredo → 401", async () => {
    expect((await dispatch.POST(new NextRequest("http://x/api/cron/dispatch", { method: "POST" }))).status).toBe(401);
    expect((await dispatch.POST(new NextRequest("http://x/api/cron/dispatch", { method: "POST", headers: { authorization: "Bearer errado" } }))).status).toBe(401);
  });
});

describe("rotas autenticadas", () => {
  it("POST sem Origin → 403 (CSRF)", async () => {
    const r = await campaigns.POST(new NextRequest("http://app.test/api/campaigns", { method: "POST", body: "{}", headers: { host: "app.test" } }), noParams);
    expect(r.status).toBe(403);
  });
  it("POST de outra origem → 403", async () => {
    const r = await campaigns.POST(new NextRequest("http://app.test/api/campaigns", { method: "POST", body: "{}", headers: { host: "app.test", origin: "https://evil.test" } }), noParams);
    expect(r.status).toBe(403);
  });
  it("mesma origem sem sessão → 401", async () => {
    const r = await campaigns.POST(new NextRequest("http://app.test/api/campaigns", { method: "POST", body: "{}", headers: { host: "app.test", origin: "http://app.test" } }), noParams);
    expect(r.status).toBe(401);
  });
  it("GET sem sessão → 401", async () => {
    expect((await campaigns.GET(new NextRequest("http://app.test/api/campaigns"), noParams)).status).toBe(401);
  });
});
