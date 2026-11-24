import ipaddr from "ipaddr.js";

/** Somente endereços unicast públicos. Bloqueia loopback, privados, link-local (metadata 169.254.169.254), CGNAT, multicast, reservados. */
export function isPublicIp(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false;
  let addr = ipaddr.parse(ip);
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) addr = v6.toIPv4Address();
  }
  return addr.range() === "unicast";
}

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home", ".corp"];

export class UnsafeUrlError extends Error {}

/** Validação sintática (sem DNS). A validação de IP acontece no momento da conexão (ver safe-fetch). */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError("URL inválida");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Protocolo não permitido");
  if (url.username || url.password) throw new UnsafeUrlError("Credenciais em URL não permitidas");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Porta não permitida");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) throw new UnsafeUrlError("Host não permitido");
  if (ipaddr.isValid(host) && !isPublicIp(host)) throw new UnsafeUrlError("IP não público");
  if (!host.includes(".") && !ipaddr.isValid(host)) throw new UnsafeUrlError("Host sem domínio");
  return url;
}
