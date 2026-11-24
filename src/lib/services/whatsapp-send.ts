import "server-only";
import { env } from "@/lib/env";

export interface SendResult { ok: boolean; waMessageId?: string; error?: string; retryable: boolean }

/** Envio via Graph API oficial. Template quando fora da janela de 24h. */
export async function sendWhatsApp(args: { to: string; body: string; templateName: string | null; insideWindow: boolean; idempotencyKey: string }): Promise<SendResult> {
  if (!env.waToken || !env.waPhoneId) return { ok: false, error: "WhatsApp não configurado", retryable: false };
  const to = args.to.replace(/^\+/, "");
  const payload = args.insideWindow
    ? { messaging_product: "whatsapp", to, type: "text", text: { body: args.body, preview_url: false } }
    : { messaging_product: "whatsapp", to, type: "template", template: { name: args.templateName, language: { code: "pt_BR" } } };
  try {
    const res = await fetch(`https://graph.facebook.com/${env.waGraphVersion}/${env.waPhoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.waToken}`, "Content-Type": "application/json", "Idempotency-Key": args.idempotencyKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (res.ok && j.messages?.[0]?.id) return { ok: true, waMessageId: j.messages[0].id, retryable: false };
    return { ok: false, error: j.error?.message ?? `HTTP ${res.status}`, retryable: res.status === 429 || res.status >= 500 };
  } catch (e) {
    return { ok: false, error: (e as Error).message, retryable: true };
  }
}
