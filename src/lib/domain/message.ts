export const MAX_MESSAGE_CHARS = 350;

export interface MessageContext {
  senderName: string;
  senderRole: string;
  businessName: string;
  /** Só pode ser true se uma prévia publicada existir de fato. */
  previewReady: boolean;
  niche?: string;
}

/** Termos que indicam promessa de resultado — proibidos (não inventar benefícios garantidos). */
const FORBIDDEN = [/garant/i, /100\s?%/, /dobr(ar|e) (seus|o)/i, /triplic/i, /sem risco/i, /resultado(s)? (certo|imediato)/i, /lucro/i];

export function buildDefaultMessage(c: MessageContext): string {
  const who = `Olá! Sou ${c.senderName.trim()}, ${c.senderRole.trim()}.`;
  const body = c.previewReady
    ? ` Conheci a ${c.businessName.trim()} e criei uma prévia de página personalizada para apresentar os tratamentos e facilitar agendamentos. Posso te mostrar?`
    : ` Conheci a ${c.businessName.trim()} e gostaria de apresentar uma ideia de página para apresentar os tratamentos e facilitar agendamentos. Posso te mostrar?`;
  return clamp(who + body);
}

export function clamp(text: string, max = MAX_MESSAGE_CHARS): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).trimEnd() + "…";
}

export interface MessageValidation { ok: boolean; issues: string[] }

export function validateMessage(text: string, c: Pick<MessageContext, "previewReady" | "businessName">): MessageValidation {
  const issues: string[] = [];
  if (text.length > MAX_MESSAGE_CHARS) issues.push(`Excede ${MAX_MESSAGE_CHARS} caracteres`);
  if (text.trim().length < 20) issues.push("Mensagem curta demais");
  if (!c.previewReady && /pr[eé]via (de p[aá]gina )?(personalizada )?(pronta|criada)|criei uma pr[eé]via/i.test(text))
    issues.push("Afirma prévia pronta, mas nenhuma prévia publicada existe");
  if (FORBIDDEN.some((r) => r.test(text))) issues.push("Contém promessa de resultado garantido");
  if (!/\?\s*$/.test(text.trim())) issues.push("Deve terminar com uma pergunta curta");
  if (/https?:\/\//i.test(text) && !c.previewReady) issues.push("Links só após prévia publicada");
  return { ok: issues.length === 0, issues };
}
