import type { GeoPoint } from "./types";

const EARTH_RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distância de grande círculo (Haversine) em km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function withinRadius(center: GeoPoint, p: GeoPoint | null, radiusKm: number): boolean {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
  return haversineKm(center, p) <= radiusKm;
}
