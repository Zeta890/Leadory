import type { DiscoveredBusiness } from "./types";

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const NAME_NOISE = /\b(ltda|me|eireli|epp|s\/?a|clinica|clinicas|consultorio|odontologia|odontologica|odonto|dr|dra)\b/g;

export function normalizeName(name: string): string {
  return strip(name.toLowerCase()).replace(/[^a-z0-9 ]+/g, " ").replace(NAME_NOISE, " ").replace(/\s+/g, " ").trim();
}

export function normalizeAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  return strip(addr.toLowerCase())
    .replace(/\b(rua|r\.)\b/g, "r")
    .replace(/\b(avenida|av\.)\b/g, "av")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza telefone brasileiro para E.164 (+55DDXXXXXXXXX).
 * Retorna null se não for um número BR plausível. Telefone ≠ WhatsApp.
 */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.startsWith("0") && (d.length === 11 || d.length === 12)) d = d.slice(1);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (d.length === 11 && d[2] !== "9") return null;
  return `+55${d}`;
}

export function isMobileBR(e164: string): boolean {
  return /^\+55\d{2}9\d{8}$/.test(e164);
}

export function formatPhoneBR(e164: string | null): string {
  if (!e164) return "—";
  const d = e164.replace(/^\+55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

/** Chaves de deduplicação: identificador da fonte, telefone normalizado e nome+endereço normalizados. */
export function dedupeKeys(b: Pick<DiscoveredBusiness, "source" | "sourceId" | "name" | "address" | "phone">): string[] {
  const keys: string[] = [];
  if (b.sourceId) keys.push(`src:${b.source}:${b.sourceId}`);
  const phone = normalizePhoneBR(b.phone);
  if (phone) keys.push(`tel:${phone}`);
  const n = normalizeName(b.name);
  const a = normalizeAddress(b.address);
  if (n && a) keys.push(`na:${n}|${a}`);
  return keys;
}

export class Deduper {
  private seen = new Set<string>();
  constructor(existing: Iterable<string> = []) {
    for (const k of existing) this.seen.add(k);
  }
  /** Retorna true se o item é novo (e o registra). */
  add(b: Parameters<typeof dedupeKeys>[0]): boolean {
    const keys = dedupeKeys(b);
    if (keys.length === 0) return false;
    if (keys.some((k) => this.seen.has(k))) return false;
    keys.forEach((k) => this.seen.add(k));
    return true;
  }
}

export function normalizeInstagram(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/)?@?([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/);
  if (!m?.[1]) return null;
  const handle = m[1].toLowerCase();
  if (["p", "reel", "explore", "stories", "accounts"].includes(handle)) return null;
  return handle;
}
