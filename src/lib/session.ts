import "server-only";
import { redirect } from "next/navigation";
import { createClient, type ServerClient } from "@/lib/supabase/server";

export interface Ctx { supabase: ServerClient; userId: string; email: string | null; workspaceId: string; role: "owner" | "admin" | "member" }

/** Sessão + workspace ativo. Redireciona para /setup ou /login quando necessário. */
export async function requireCtx(): Promise<Ctx> {
  const supabase = await createClient();
  if (!supabase) redirect("/setup");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: m } = await supabase.from("workspace_members").select("workspace_id, role").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!m) redirect("/login?error=workspace");
  return { supabase, userId: user.id, email: user.email ?? null, workspaceId: m.workspace_id, role: m.role };
}

/** Variante para rotas de API: retorna null em vez de redirecionar. */
export async function apiCtx(): Promise<Ctx | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: m } = await supabase.from("workspace_members").select("workspace_id, role").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!m) return null;
  return { supabase, userId: user.id, email: user.email ?? null, workspaceId: m.workspace_id, role: m.role };
}
