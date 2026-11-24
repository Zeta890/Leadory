import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiCtx, type Ctx } from "@/lib/session";

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown) { super(message); }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Proteção CSRF para rotas com cookie: métodos mutáveis exigem Origin do próprio host. */
function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Origem ausente");
  try { if (new URL(origin).host !== host) throw new Error(); } catch { throw new HttpError(403, "Origem não permitida"); }
}

type Handler<P> = (req: NextRequest, ctx: Ctx, params: P) => Promise<Response>;

export function route<P = Record<string, string>>(h: Handler<P>) {
  return async (req: NextRequest, { params }: { params: Promise<P> }) => {
    try {
      assertSameOrigin(req);
      const ctx = await apiCtx();
      if (!ctx) return json({ error: "Não autenticado" }, 401);
      return await h(req, ctx, await params);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, details: e.details }, e.status);
      if (e instanceof z.ZodError) return json({ error: "Dados inválidos", details: z.flattenError(e) }, 422);
      console.error("[api]", e);
      return json({ error: "Erro interno" }, 500);
    }
  };
}

export async function body<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const raw = await req.json().catch(() => { throw new HttpError(400, "JSON inválido"); });
  return schema.parse(raw);
}

export const Uuid = z.uuid();

/** Busca linha garantindo que pertence ao workspace do usuário (além do RLS). */
export async function owned<T = Record<string, unknown>>(ctx: Ctx, table: string, id: string, columns = "*"): Promise<T> {
  if (!Uuid.safeParse(id).success) throw new HttpError(400, "ID inválido");
  const { data, error } = await ctx.supabase.from(table).select(columns).eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (error) throw new HttpError(500, "Falha ao consultar");
  if (!data) throw new HttpError(404, "Não encontrado");
  return data as T;
}

export async function logEvent(ctx: Ctx, leadId: string, type: string, payload: Record<string, unknown> = {}) {
  await ctx.supabase.from("lead_events").insert({ workspace_id: ctx.workspaceId, lead_id: leadId, type, payload });
}
