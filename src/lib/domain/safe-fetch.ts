import "server-only";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import type { LookupFunction } from "node:net";
import { assertSafeUrl, isPublicIp, UnsafeUrlError } from "./ssrf";

export interface SafeFetchResult { finalUrl: string; status: number; contentType: string; body: string; redirects: string[] }

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

/** lookup que valida o IP efetivamente usado na conexão — impede DNS rebinding. */
const guardedLookup: LookupFunction = (hostname, options, cb) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, "", 4);
    const list = (Array.isArray(addresses) ? addresses : [{ address: addresses as unknown as string, family: 4 }]) as dns.LookupAddress[];
    const bad = list.find((a) => !isPublicIp(a.address));
    if (bad || list.length === 0) return cb(new UnsafeUrlError("Destino resolve para IP não público"), "", 4);
    if ((options as dns.LookupOptions).all) return (cb as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    const first = list[0]!;
    cb(null, first.address, first.family);
  });
};

function once(url: URL): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: { "User-Agent": "LeadoryAudit/1.0 (+auditoria de presenca digital)", Accept: "text/html,application/xhtml+xml" },
      },
      (res) => {
        const ct = String(res.headers["content-type"] ?? "");
        const isRedirect = (res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400;
        if (isRedirect || !/text\/html|application\/xhtml/i.test(ct)) {
          res.resume();
          return resolve({ status: res.statusCode ?? 0, headers: res.headers, body: "" });
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) { req.destroy(); return; }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** GET seguro para conteúdo HTML externo. Conteúdo retornado deve ser tratado como dado não confiável. */
export async function safeFetchHtml(raw: string): Promise<SafeFetchResult> {
  let url = assertSafeUrl(raw);
  const redirects: string[] = [];
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const r = await once(url);
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      url = assertSafeUrl(new URL(r.headers.location, url).toString());
      redirects.push(url.toString());
      continue;
    }
    return { finalUrl: url.toString(), status: r.status, contentType: String(r.headers["content-type"] ?? ""), body: r.body, redirects };
  }
  throw new UnsafeUrlError("Redirecionamentos demais");
}
