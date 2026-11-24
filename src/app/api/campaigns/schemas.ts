import { z } from "zod";

export const CampaignInput = z.object({
  name: z.string().trim().min(1).max(120),
  niche: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  center_lat: z.number().min(-90).max(90),
  center_lng: z.number().min(-180).max(180),
  radius_km: z.number().int().min(1).max(50),
  max_companies: z.number().int().min(1).max(100),
  prioritize_no_website: z.boolean().default(true),
  require_instagram: z.boolean().default(false),
  require_business_phone: z.boolean().default(true),
  priority_keywords: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  query_variants: z.array(z.string().trim().min(3).max(120)).max(30).default([]),
  max_requests: z.number().int().min(1).max(500).default(60),
});
