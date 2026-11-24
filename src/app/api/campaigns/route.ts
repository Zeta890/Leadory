import { route, json, body } from "@/lib/api";
import { CampaignInput } from "./schemas";

export const GET = route(async (_req, ctx) => {
  const { data, error } = await ctx.supabase.from("campaigns").select("*").eq("workspace_id", ctx.workspaceId).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ campaigns: data });
});

export const POST = route(async (req, ctx) => {
  const input = await body(req, CampaignInput);
  const { data, error } = await ctx.supabase.from("campaigns").insert({ ...input, workspace_id: ctx.workspaceId }).select("*").single();
  if (error) return json({ error: error.message }, 400);
  return json({ campaign: data }, 201);
});
