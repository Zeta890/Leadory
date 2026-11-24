import type { Stage, WebsiteStatus } from "@/lib/domain/types";
import type { ScoreBreakdownItem } from "@/lib/domain/score";

export interface Workspace { id: string; name: string; sender_name: string; sender_role: string; sending_enabled: boolean; whatsapp_template_name: string | null; monthly_request_budget: number }

export interface CampaignRow {
  id: string; workspace_id: string; name: string; niche: string; city: string; center_lat: number; center_lng: number; radius_km: number;
  max_companies: number; prioritize_no_website: boolean; require_instagram: boolean; require_business_phone: boolean;
  priority_keywords: string[]; query_variants: string[]; status: "draft" | "running" | "paused" | "completed" | "failed";
  max_requests: number; requests_used: number; found_count: number; rejected: Record<string, number>; last_error: string | null;
  started_at: string | null; finished_at: string | null; created_at: string;
}

export interface LeadRow {
  id: string; workspace_id: string; campaign_id: string | null; name: string; address: string | null; lat: number | null; lng: number | null;
  distance_km: number | null; phone_e164: string | null; phone_verified: boolean; website: string | null; website_status: WebsiteStatus;
  instagram: string | null; instagram_verified: boolean; rating: number | null; review_count: number | null; types: string[];
  source: string; source_id: string | null; source_url: string | null; source_retrieved_at: string | null; score: number;
  score_breakdown: ScoreBreakdownItem[]; stage: Stage; stage_changed_at: string; notes: string; confirmed_services: string[];
  is_simulated: boolean; created_at: string; updated_at: string;
}

export interface MessageRow {
  id: string; lead_id: string; direction: "outbound" | "inbound"; body: string; template_name: string | null;
  status: "draft" | "approved" | "scheduled" | "sending" | "sent" | "delivered" | "read" | "failed" | "cancelled" | "received";
  approved_at: string | null; scheduled_for: string | null; attempts: number; last_error: string | null; created_at: string;
}

export interface DealRow { id: string; lead_id: string; value_cents: number; status: "open" | "won" | "lost"; closed_at: string | null; created_at: string }
