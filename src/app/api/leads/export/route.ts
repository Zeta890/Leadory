import { route } from "@/lib/api";

/**
 * Exportação somente de dados licenciados para exportar: campos do próprio workspace.
 * Conteúdo derivado do Google Places (endereço, telefone, avaliações) NÃO é exportado para leads com source = google_places.
 */
const csv = (v: unknown) => {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // evita CSV injection
  return `"${safe.replace(/"/g, '""')}"`;
};

export const GET = route(async (_req, ctx) => {
  const { data } = await ctx.supabase.from("leads").select("id,name,source,phone_e164,address,website,instagram,instagram_verified,website_status,score,stage,notes,created_at").eq("workspace_id", ctx.workspaceId).order("created_at");
  const header = ["id", "nome", "origem", "telefone", "endereco", "site", "instagram", "status_site", "score", "etapa", "notas", "criado_em"];
  const rows = (data ?? []).map((l) => {
    const own = l.source === "manual";
    return [l.id, l.name, l.source, own ? l.phone_e164 : "", own ? l.address : "", l.website_status === "identified" && own ? l.website : "", l.instagram_verified ? l.instagram : "", l.website_status, l.score, l.stage, l.notes, l.created_at].map(csv).join(",");
  });
  return new Response("﻿" + [header.join(","), ...rows].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leadory-leads-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
});
