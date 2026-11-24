import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWebhook, verifyMetaSignature } from "@/lib/domain/whatsapp/webhook";
import { revokeAll, cancelPending } from "@/lib/services/consent";

/** Verificação do endpoint pela Meta. */
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (env.waVerifyToken && sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === env.waVerifyToken)
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return new NextResponse("too large", { status: 413 });
  if (!env.waAppSecret || !verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), env.waAppSecret))
    return new NextResponse("invalid signature", { status: 401 });
  const sb = createAdminClient();
  if (!sb) return new NextResponse("not configured", { status: 503 });

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new NextResponse("bad json", { status: 400 }); }

  for (const ev of parseWebhook(payload)) {
    const eventId = ev.type === "inbound" ? `in:${ev.waMessageId}` : `st:${ev.waMessageId}:${ev.status}`;
    // Idempotência: a Meta reenvia eventos; processa cada um uma única vez.
    const { error: dup } = await sb.from("webhook_events").insert({ id: eventId });
    if (dup) continue;

    if (ev.type === "status") {
      const patch: Record<string, unknown> = { status: ev.status };
      if (ev.status === "failed") patch.last_error = ev.error ?? "Falha reportada pela Meta";
      await sb.from("messages").update(patch).eq("wa_message_id", ev.waMessageId).not("status", "in", "(cancelled,received)");
      continue;
    }

    const { data: leads } = await sb.from("leads").select("id, workspace_id, phone_e164").eq("phone_e164", ev.from);
    for (const lead of leads ?? []) {
      await sb.from("messages").insert({ workspace_id: lead.workspace_id, lead_id: lead.id, direction: "inbound", body: ev.text || "[mídia]", status: "received", wa_message_id: leads!.length === 1 ? ev.waMessageId : null });
      await sb.from("lead_events").insert({ workspace_id: lead.workspace_id, lead_id: lead.id, type: ev.optOut ? "opt_out" : "reply", payload: { at: ev.timestamp.toISOString() }, actor: null });
      // Qualquer resposta interrompe a sequência automática; opt-out revoga consentimento e suprime.
      if (ev.optOut) await revokeAll(sb, lead.workspace_id, lead.id, lead.phone_e164, "Opt-out via WhatsApp");
      else await cancelPending(sb, lead.workspace_id, lead.id, "Contato respondeu — aguardando ação humana");
    }
  }
  return NextResponse.json({ ok: true });
}
