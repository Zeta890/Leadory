import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isWithinSendWindow, nextSendSlot, retryDelayMs } from "@/lib/domain/whatsapp/schedule";
import { loadEligibility } from "@/lib/services/eligibility";
import { sendWhatsApp } from "@/lib/services/whatsapp-send";

export const maxDuration = 60;

/** Worker da fila. Agende (ex.: Vercel Cron a cada 5 min) com Authorization: Bearer CRON_SECRET. */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) return new NextResponse("unauthorized", { status: 401 });
  const sb = createAdminClient();
  if (!sb) return new NextResponse("not configured", { status: 503 });
  if (!isWithinSendWindow(new Date())) return NextResponse.json({ skipped: "fora da janela de envio" });

  const { data: due } = await sb.from("messages").select("*").eq("status", "scheduled").eq("direction", "outbound").lte("scheduled_for", new Date().toISOString()).order("scheduled_for").limit(20);
  const results: { id: string; outcome: string }[] = [];
  for (const m of due ?? []) {
    // Reivindicação atômica: só um worker processa cada mensagem (o trigger revalida consentimento aqui).
    const { data: claimed, error: claimErr } = await sb.from("messages").update({ status: "sending" }).eq("id", m.id).eq("status", "scheduled").select("id");
    if (claimErr) {
      await sb.from("messages").update({ status: "cancelled", last_error: claimErr.message }).eq("id", m.id);
      results.push({ id: m.id, outcome: `cancelada: ${claimErr.message}` });
      continue;
    }
    if (!claimed?.length) continue;
    const elig = await loadEligibility(sb, m.workspace_id, m);
    if (!elig.ok) {
      await sb.from("messages").update({ status: "cancelled", last_error: elig.reasons.join("; ") }).eq("id", m.id);
      results.push({ id: m.id, outcome: "cancelada: inelegível" });
      continue;
    }
    const r = await sendWhatsApp({ to: elig.phone!, body: m.body, templateName: elig.templateName, insideWindow: elig.insideWindow, idempotencyKey: m.idempotency_key ?? m.id });
    const attempts = m.attempts + 1;
    if (r.ok) {
      await sb.from("messages").update({ status: "sent", wa_message_id: r.waMessageId, attempts }).eq("id", m.id);
      await sb.from("lead_events").insert({ workspace_id: m.workspace_id, lead_id: m.lead_id, type: "message_sent", payload: { message_id: m.id }, actor: null });
      results.push({ id: m.id, outcome: "enviada" });
    } else {
      const delay = r.retryable ? retryDelayMs(attempts) : null;
      if (delay !== null) await sb.from("messages").update({ status: "scheduled", attempts, last_error: r.error, scheduled_for: nextSendSlot(new Date(Date.now() + delay)).toISOString() }).eq("id", m.id);
      else await sb.from("messages").update({ status: "failed", attempts, last_error: r.error }).eq("id", m.id);
      results.push({ id: m.id, outcome: delay !== null ? "reagendada" : "falhou" });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}

/** Vercel Cron chama via GET com Authorization: Bearer CRON_SECRET. */
export const GET = POST;
