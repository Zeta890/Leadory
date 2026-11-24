import { requireCtx } from "@/lib/session";
import { PageHeader } from "@/components/app/nav";
import { Kanban } from "@/components/crm/kanban";

export const metadata = { title: "CRM" };

export default async function CrmPage() {
  const ctx = await requireCtx();
  const { data } = await ctx.supabase.from("leads").select("id,name,stage,score,website_status,phone_e164,instagram,instagram_verified,distance_km,is_simulated")
    .eq("workspace_id", ctx.workspaceId).order("score", { ascending: false }).limit(1000);
  return (
    <>
      <PageHeader title="Pipeline" description="Arraste os cards entre as etapas ou use o seletor de cada card. A etapa Autorizado não substitui o registro de consentimento." />
      <Kanban initial={data ?? []} />
    </>
  );
}
