export const TIMEZONE = "America/Sao_Paulo";
export const SEND_WINDOW = { startHour: 9, endHour: 17, weekdays: [1, 2, 3, 4, 5] } as const;
export const MAX_ATTEMPTS = 3;

interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(d: Date, tz = TIMEZONE): ZonedParts {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year!, month: +p.month!, day: +p.day!, hour: +p.hour!, minute: +p.minute!, weekday: WD[p.weekday!] ?? 0 };
}

export function isWithinSendWindow(d: Date, tz = TIMEZONE): boolean {
  const z = zonedParts(d, tz);
  return (SEND_WINDOW.weekdays as readonly number[]).includes(z.weekday) && z.hour >= SEND_WINDOW.startHour && z.hour < SEND_WINDOW.endHour;
}

/** Próximo instante válido (>= d) dentro da janela seg–sex 09–17 no fuso informado. Resolução de 1 minuto. */
export function nextSendSlot(d: Date, tz = TIMEZONE): Date {
  let t = new Date(Math.ceil(d.getTime() / 60_000) * 60_000);
  for (let i = 0; i < 8 * 24 * 60; i++) {
    if (isWithinSendWindow(t, tz)) return t;
    const z = zonedParts(t, tz);
    // salta direto para o próximo topo de hora para acelerar
    t = new Date(t.getTime() + (60 - z.minute) * 60_000);
  }
  throw new Error("Nenhuma janela de envio encontrada");
}

/** Backoff exponencial limitado: 5 min, 20 min, 80 min. null = desistir. */
export function retryDelayMs(attempt: number): number | null {
  if (attempt >= MAX_ATTEMPTS) return null;
  return 5 * 60_000 * 4 ** (attempt - 1);
}

export function idempotencyKey(leadId: string, templateOrHash: string, purpose: string): string {
  return `${purpose}:${leadId}:${templateOrHash}`;
}

export interface SendEligibilityInput {
  sendingEnabled: boolean;
  consent: { status: "granted" | "revoked" | "none"; evidence: string | null } | null;
  suppressed: boolean;
  humanApproved: boolean;
  hasRepliedOrOptedOut: boolean;
  /** Fora da janela de 24h de atendimento é obrigatório usar template aprovado. */
  insideCustomerServiceWindow: boolean;
  templateName: string | null;
}

/** Envio só é permitido com opt-in verificável, aprovação humana, sem supressão. Etapa "Autorizado" do CRM NÃO é prova. */
export function checkSendEligibility(i: SendEligibilityInput): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!i.sendingEnabled) reasons.push("Envio desabilitado no workspace");
  if (!i.consent || i.consent.status !== "granted") reasons.push("Sem opt-in registrado");
  else if (!i.consent.evidence?.trim()) reasons.push("Opt-in sem evidência verificável");
  if (i.suppressed) reasons.push("Número na lista de supressão");
  if (!i.humanApproved) reasons.push("Mensagem não aprovada por um humano");
  if (i.hasRepliedOrOptedOut) reasons.push("Contato respondeu ou pediu para sair — sequência interrompida");
  if (!i.insideCustomerServiceWindow && !i.templateName) reasons.push("Fora da janela de 24h: template aprovado obrigatório");
  return { ok: reasons.length === 0, reasons };
}
