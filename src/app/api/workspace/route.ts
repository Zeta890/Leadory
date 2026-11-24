import { z } from "zod";
import { route, json, body, HttpError } from "@/lib/api";
import { integrationStatus } from "@/lib/env";

const Patch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sender_name: z.string().trim().max(80).optional(),
  sender_role: z.string().trim().max(80).optional(),
  sending_enabled: z.boolean().optional(),
  whatsapp_template_name: z.string().trim().regex(/^[a-z0-9_]{1,512}$/).nullable().optional(),
  monthly_request_budget: z.number().int().min(0).max(100000).optional(),
});

export const GET = route(async (_req, ctx) => {
  const { data } = await ctx.supabase.from("workspaces").select("*").eq("id", ctx.workspaceId).single();
  return json({ workspace: data, role: ctx.role, integrations: integrationStatus() });
});

export const PATCH = route(async (req, ctx) => {
  if (ctx.role === "member") throw new HttpError(403, "Somente owner/admin");
  const p = await body(req, Patch);
  if (p.sending_enabled && !integrationStatus().whatsapp) throw new HttpError(412, "Configure a WhatsApp Cloud API no servidor antes de habilitar envios.");
  const { data, error } = await ctx.supabase.from("workspaces").update(p).eq("id", ctx.workspaceId).select("*").single();
  if (error) throw new HttpError(400, error.message);
  return json({ workspace: data });
});
