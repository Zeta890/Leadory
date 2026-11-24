import "server-only";
import type { DiscoveredBusiness } from "@/lib/domain/types";
import { type DiscoveryProvider, ProviderError, type SearchPage } from "./provider";

/**
 * Google Places API (New) — Text Search.
 * Termos: armazenamos place_id (permitido indefinidamente) e os demais campos com validade limitada
 * (ver coluna source_expires_at). Não exportar a base derivada do Places.
 */
const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.location", "places.nationalPhoneNumber",
  "places.internationalPhoneNumber", "places.websiteUri", "places.rating", "places.userRatingCount",
  "places.businessStatus", "places.googleMapsUri", "places.types", "nextPageToken",
].join(",");

interface PlacesResponse {
  places?: {
    id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number };
    nationalPhoneNumber?: string; internationalPhoneNumber?: string; websiteUri?: string; rating?: number; userRatingCount?: number;
    businessStatus?: string; googleMapsUri?: string; types?: string[];
  }[];
  nextPageToken?: string;
}

export class GooglePlacesProvider implements DiscoveryProvider {
  readonly name = "google_places";
  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch) {
    if (!apiKey) throw new ProviderError("GOOGLE_PLACES_API_KEY ausente", null, false);
  }

  async searchText({ query, center, radiusKm, pageToken }: Parameters<DiscoveryProvider["searchText"]>[0]): Promise<SearchPage> {
    const body: Record<string, unknown> = {
      textQuery: query,
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize: 20,
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min(50_000, radiusKm * 1000) } },
    };
    if (pageToken) body.pageToken = pageToken;
    let res: Response;
    try {
      res = await this.fetchImpl("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": FIELD_MASK },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new ProviderError(`Falha de rede no Places: ${(e as Error).message}`, null, true);
    }
    if (!res.ok) {
      const txt = (await res.text().catch(() => "")).slice(0, 300);
      throw new ProviderError(`Places respondeu ${res.status}: ${txt}`, res.status, res.status === 429 || res.status >= 500);
    }
    const json = (await res.json()) as PlacesResponse;
    const items: DiscoveredBusiness[] = (json.places ?? []).map((p) => ({
      source: this.name,
      sourceId: p.id,
      sourceUrl: p.googleMapsUri ?? null,
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? null,
      location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
      phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      rating: p.rating ?? null,
      reviewCount: p.userRatingCount ?? null,
      types: p.types ?? [],
      businessStatus: p.businessStatus ?? null,
    }));
    return { items, nextPageToken: json.nextPageToken ?? null };
  }
}
