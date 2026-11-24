import { route, json, owned } from "@/lib/api";
import { rescoreLead } from "@/lib/services/score-lead";
import type { LeadRow } from "@/lib/db-types";

export const POST = route<{ id: string }>(async (_req, ctx, { id }) => json(await rescoreLead(ctx, await owned<LeadRow>(ctx, "leads", id))));
