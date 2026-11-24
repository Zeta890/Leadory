import { route, json, owned } from "@/lib/api";
import { auditLead } from "@/lib/services/audit-lead";
import type { LeadRow } from "@/lib/db-types";

export const maxDuration = 60;

export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  const lead = await owned<LeadRow>(ctx, "leads", id);
  let city = "Florianópolis, SC";
  if (lead.campaign_id) {
    const { data } = await ctx.supabase.from("campaigns").select("city").eq("id", lead.campaign_id).maybeSingle();
    if (data?.city) city = data.city;
  }
  return json(await auditLead(ctx, lead, city));
});
