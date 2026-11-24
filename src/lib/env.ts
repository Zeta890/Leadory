import "server-only";

/** Leitura centralizada de variáveis. Secrets só existem no servidor — nunca prefixe com NEXT_PUBLIC_. */
const read = (k: string) => {
  const v = process.env[k]?.trim();
  return v ? v : undefined;
};

export const env = {
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: read("SUPABASE_SECRET_KEY"),
  googlePlacesKey: read("GOOGLE_PLACES_API_KEY"),
  braveKey: read("BRAVE_SEARCH_API_KEY"),
  aiKey: read("AI_API_KEY"),
  aiModel: read("AI_MODEL") ?? "claude-haiku-5-5",
  waToken: read("WHATSAPP_ACCESS_TOKEN"),
  waPhoneId: read("WHATSAPP_PHONE_NUMBER_ID"),
  waAppSecret: read("WHATSAPP_APP_SECRET"),
  waVerifyToken: read("WHATSAPP_VERIFY_TOKEN"),
  waGraphVersion: read("WHATSAPP_GRAPH_VERSION") ?? "v23.0",
  cronSecret: read("CRON_SECRET"),
  appUrl: read("APP_URL") ?? "http://localhost:3000",
  placesCostCentsPerRequest: Number(read("PLACES_COST_CENTS_PER_REQUEST") ?? "20"),
};

export function integrationStatus() {
  return {
    supabase: Boolean(env.supabaseUrl && env.supabasePublishableKey),
    supabaseServer: Boolean(env.supabaseSecretKey),
    places: Boolean(env.googlePlacesKey),
    webSearch: Boolean(env.braveKey),
    ai: Boolean(env.aiKey),
    whatsapp: Boolean(env.waToken && env.waPhoneId && env.waAppSecret && env.waVerifyToken),
    cron: Boolean(env.cronSecret),
  };
}
export type IntegrationStatus = ReturnType<typeof integrationStatus>;
