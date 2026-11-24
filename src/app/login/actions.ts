"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const Creds = z.object({ email: z.email().max(200), password: z.string().min(8).max(200), next: z.string().optional() });

const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard");

export async function signIn(_: unknown, form: FormData) {
  const parsed = Creds.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "E-mail ou senha inválidos (mínimo 8 caracteres)." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado." };
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: "Não foi possível entrar. Verifique as credenciais ou confirme seu e-mail." };
  redirect(safeNext(parsed.data.next));
}

export async function signUp(_: unknown, form: FormData) {
  const parsed = Creds.extend({ name: z.string().trim().min(1).max(80) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Preencha nome, e-mail e senha (mínimo 8 caracteres)." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado." };
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name }, emailRedirectTo: `${env.appUrl}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { ok: "Conta criada. Confirme o e-mail enviado para continuar." };
}
