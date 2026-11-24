import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function isCronAuthorized(header: string | null): boolean {
  if (!env.cronSecret || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(env.cronSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}
