import { route, json, owned } from "@/lib/api";
import { auditLead } from "@/lib/services/audit-lead";
import type { CampaignRow, LeadRow } from "@/lib/db-types";

export const maxDuration = 300;

/** Audita em lote os leads ainda não auditados (chame repetidamente até remaining = 0). */
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const c = await owned<CampaignRow>(ctx, "campaigns", id);
  const limit = Math.min(25, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 10)));
  const { data: batch } = await ctx.supabase.from("leads").select("*").eq("campaign_id", id).eq("website_status", "unknown").limit(limit);
  const list = (batch ?? []) as LeadRow[];
  const results: { id: string; status: string }[] = [];
  for (let i = 0; i < list.length; i += 4) {
    results.push(...(await Promise.all(list.slice(i, i + 4).map(async (l) => ({ id: l.id, status: (await auditLead(ctx, l, c.city)).status })))));
  }
  const { count } = await ctx.supabase.from("leads").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("website_status", "unknown");
  return json({ audited: results.length, remaining: count ?? 0, results });
});
