import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";

/** Retenção diária: expira conteúdo derivado do Places e limpa eventos antigos de webhook. */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) return new NextResponse("unauthorized", { status: 401 });
  const sb = createAdminClient();
  if (!sb) return new NextResponse("not configured", { status: 503 });
  const { data, error } = await sb.rpc("purge_expired_source_data");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ purged: data });
}
