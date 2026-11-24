import { route, json, owned } from "@/lib/api";
import type { CampaignRow } from "@/lib/db-types";

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const c = await owned<CampaignRow>(ctx, "campaigns", id, "id,status,found_count,max_companies,requests_used,max_requests,rejected,last_error,started_at,finished_at");
  const { data: leads } = await ctx.supabase.from("leads").select("website_status").eq("campaign_id", id);
  const audit: Record<string, number> = { unknown: 0, inconclusive: 0, identified: 0, not_identified: 0 };
  for (const l of leads ?? []) audit[l.website_status as string] = (audit[l.website_status as string] ?? 0) + 1;
  return json({ ...c, audit, progress: Math.round((c.found_count / c.max_companies) * 100) });
});
