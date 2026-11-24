import { requireCtx } from "@/lib/session";
import { integrationStatus } from "@/lib/env";
import { FLORIPA_DENTAL_CAMPAIGN } from "@/lib/discovery/engine";
import { PageHeader } from "@/components/app/nav";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export const metadata = { title: "Nova campanha" };

export default async function NewCampaignPage() {
  await requireCtx();
  const t = FLORIPA_DENTAL_CAMPAIGN;
  return (
    <>
      <PageHeader title="Nova campanha" description="Pré-configurada para clínicas odontológicas em Florianópolis, SC. Ajuste para outros nichos e cidades." />
      <CampaignForm placesReady={integrationStatus().places} template={{
        name: "Clínicas odontológicas, Florianópolis", niche: t.niche, city: t.city, center_lat: t.center.lat, center_lng: t.center.lng,
        radius_km: t.radiusKm, max_companies: t.maxCompanies, prioritize_no_website: t.prioritizeNoWebsite, require_instagram: t.requireInstagram,
        require_business_phone: t.requireBusinessPhone, priority_keywords: t.priorityKeywords, query_variants: t.queryVariants, max_requests: 60,
      }} />
    </>
  );
}
