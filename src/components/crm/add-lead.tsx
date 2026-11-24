"use client";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { api } from "@/lib/client-api";
import type { LeadRow } from "@/lib/db-types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Cadastro manual — preserva a funcionalidade do piloto. */
export function AddLeadDialog({ onCreated }: { onCreated: (l: LeadRow) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const { lead } = await api<{ lead: LeadRow }>("/api/leads", { method: "POST", json: f });
      onCreated(lead); setOpen(false);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />Novo lead</Button></DialogTrigger>
      <DialogContent title="Cadastrar lead manualmente" description="Use apenas dados que você tem o direito de armazenar.">
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="nl-name">Nome comercial</Label><Input id="nl-name" name="name" required maxLength={120} /></div>
          <div className="grid gap-1.5"><Label htmlFor="nl-phone">Telefone comercial (opcional)</Label><Input id="nl-phone" name="phone" type="tel" placeholder="(48) 3222-1234" /></div>
          <div className="grid gap-1.5"><Label htmlFor="nl-site">Site</Label>
            <NativeSelect id="nl-site" name="website_status" defaultValue="inconclusive">
              <option value="inconclusive">Inconclusivo</option><option value="not_identified">Nenhum site identificado</option><option value="identified">Site identificado</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="nl-ig">Instagram (opcional)</Label><Input id="nl-ig" name="instagram" placeholder="@clinica" /></div>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <Button disabled={busy}>{busy && <Loader2 className="animate-spin" />}Cadastrar lead</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
