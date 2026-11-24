import "server-only";
import { computeLeadScore } from "@/lib/domain/score";
import type { Ctx } from "@/lib/session";
import type { LeadRow } from "@/lib/db-types";

export async function rescoreLead(ctx: Ctx, lead: LeadRow) {
  let keywords: string[] = [];
  if (lead.campaign_id) {
    const { data } = await ctx.supabase.from("campaigns").select("priority_keywords").eq("id", lead.campaign_id).maybeSingle();
    keywords = (data?.priority_keywords as string[] | undefined) ?? [];
  }
  const { score, breakdown } = computeLeadScore({
    websiteStatus: lead.website_status,
    instagramActiveVerified: Boolean(lead.instagram && lead.instagram_verified),
    reviewCount: lead.review_count,
    rating: lead.rating,
    phoneVerified: lead.phone_verified,
    name: lead.name,
    types: [...lead.types, ...lead.confirmed_services],
    priorityKeywords: keywords,
  });
  await ctx.supabase.from("leads").update({ score, score_breakdown: breakdown }).eq("id", lead.id).eq("workspace_id", ctx.workspaceId);
  return { score, breakdown };
}
