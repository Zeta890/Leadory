import { route, json, owned } from "@/lib/api";

export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  await owned(ctx, "campaigns", id);
  await ctx.supabase.from("campaigns").update({ status: "paused" }).eq("id", id).eq("workspace_id", ctx.workspaceId).eq("status", "running");
  return json({ ok: true });
});
