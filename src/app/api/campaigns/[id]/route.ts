import { route, json, body, owned, HttpError } from "@/lib/api";
import { CampaignInput } from "../schemas";
import type { CampaignRow } from "@/lib/db-types";

type P = { id: string };

export const GET = route<P>(async (_req, ctx, { id }) => json({ campaign: await owned(ctx, "campaigns", id) }));

export const PATCH = route<P>(async (req, ctx, { id }) => {
  const c = await owned<CampaignRow>(ctx, "campaigns", id);
  if (c.status === "running") throw new HttpError(409, "Pause a campanha antes de editar");
  const patch = await body(req, CampaignInput.partial());
  const { data, error } = await ctx.supabase.from("campaigns").update(patch).eq("id", id).eq("workspace_id", ctx.workspaceId).select("*").single();
  if (error) return json({ error: error.message }, 400);
  return json({ campaign: data });
});

export const DELETE = route<P>(async (_req, ctx, { id }) => {
  await owned(ctx, "campaigns", id);
  const { data } = await ctx.supabase.from("campaigns").delete().eq("id", id).eq("workspace_id", ctx.workspaceId).select("id");
  if (!data?.length) return json({ error: "Somente owner/admin pode excluir" }, 403);
  return json({ ok: true });
});
