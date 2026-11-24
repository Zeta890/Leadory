import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Cliente com chave secreta (ignora RLS). Uso restrito: webhook, worker da fila e prévias públicas. */
export function createAdminClient() {
  if (!env.supabaseUrl || !env.supabaseSecretKey) return null;
  return createClient(env.supabaseUrl, env.supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
