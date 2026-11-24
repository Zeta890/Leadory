"use client";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { signIn, signUp } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { error?: string; ok?: string } | undefined;

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState<State, FormData>(mode === "in" ? signIn : signUp, initialError ? { error: initialError } : undefined);
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? ""} />
          {mode === "up" && (
            <div className="grid gap-1.5"><Label htmlFor="name">Nome</Label><Input id="name" name="name" autoComplete="name" required maxLength={80} /></div>
          )}
          <div className="grid gap-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="grid gap-1.5"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} required /></div>
          {state?.error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{state.error}</p>}
          {state?.ok && <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary-strong">{state.ok}</p>}
          <Button disabled={pending}>{pending && <Loader2 className="animate-spin" />}{mode === "in" ? "Entrar" : "Criar conta"}</Button>
          <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-xs text-muted hover:text-primary-strong">
            {mode === "in" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
