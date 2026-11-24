import { route, json, owned } from "@/lib/api";
import { startCampaign } from "@/lib/services/campaign-runner";
import type { CampaignRow } from "@/lib/db-types";

export const maxDuration = 300;

export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  const c = await owned<CampaignRow>(ctx, "campaigns", id);
  return json(await startCampaign(ctx, c));
});
