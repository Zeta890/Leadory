import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifica X-Hub-Signature-256 (HMAC-SHA256 do corpo bruto com o App Secret). */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const got = header.slice(7);
  if (got.length !== expected.length || !/^[0-9a-f]+$/i.test(got)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(got, "hex"));
}

const OPT_OUT = /^\s*(sair|parar|pare|stop|cancelar|descadastrar|remover|n[aã]o (quero|tenho interesse)|unsubscribe)\b/i;
export const isOptOut = (text: string) => OPT_OUT.test(text);

export type WebhookEvent =
  | { type: "inbound"; from: string; waMessageId: string; text: string; timestamp: Date; optOut: boolean }
  | { type: "status"; waMessageId: string; recipient: string; status: "sent" | "delivered" | "read" | "failed"; timestamp: Date; error?: string };

interface MetaPayload {
  object?: string;
  entry?: { changes?: { value?: {
    messages?: { from: string; id: string; timestamp: string; type: string; text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string } } }[];
    statuses?: { id: string; recipient_id: string; status: string; timestamp: string; errors?: { title?: string; message?: string }[] }[];
  } }[] }[];
}

export function parseWebhook(payload: unknown): WebhookEvent[] {
  const p = payload as MetaPayload;
  if (p?.object !== "whatsapp_business_account") return [];
  const out: WebhookEvent[] = [];
  for (const e of p.entry ?? []) for (const c of e.changes ?? []) {
    const v = c.value ?? {};
    for (const m of v.messages ?? []) {
      const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "";
      out.push({ type: "inbound", from: `+${m.from.replace(/\D/g, "")}`, waMessageId: m.id, text: text.slice(0, 4096), timestamp: new Date(Number(m.timestamp) * 1000), optOut: isOptOut(text) });
    }
    for (const s of v.statuses ?? []) {
      if (!["sent", "delivered", "read", "failed"].includes(s.status)) continue;
      out.push({ type: "status", waMessageId: s.id, recipient: `+${s.recipient_id.replace(/\D/g, "")}`, status: s.status as "sent", timestamp: new Date(Number(s.timestamp) * 1000), error: s.errors?.[0]?.message ?? s.errors?.[0]?.title });
    }
  }
  return out;
}
