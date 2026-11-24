import type { DiscoveredBusiness, GeoPoint } from "@/lib/domain/types";

export interface SearchPage { items: DiscoveredBusiness[]; nextPageToken: string | null }

export interface DiscoveryProvider {
  readonly name: string;
  searchText(args: { query: string; center: GeoPoint; radiusKm: number; pageToken?: string | null }): Promise<SearchPage>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status: number | null, readonly retryable: boolean) { super(message); }
}
