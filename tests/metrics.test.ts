import { describe, it, expect } from "vitest";
import { computeMetrics, dayKey, weekKey } from "@/lib/metrics";

const now = new Date("2026-11-24T15:00:00Z");
const L = (created_at: string, stage: "qualified" | "won" | "lost" | "meeting", score = 0, sim = false) => ({ created_at, stage, score, website_status: "unknown" as const, stage_changed_at: created_at, is_simulated: sim });

describe("métricas", () => {
  it("fuso de São Paulo: 01:00Z ainda é o dia anterior", () => expect(dayKey("2026-11-24T01:00:00Z")).toBe("2026-11-23"));
  it("semana começa na segunda", () => expect(weekKey("2026-11-24T15:00:00Z")).toBe("2026-11-23"));
  it("sem dados: zeros e conversão nula (não inventa números)", () => {
    const m = computeMetrics([], [], [], now);
    expect(m.kpis).toMatchObject({ total: 0, won: 0, conversion: null, revenueReal: 0, revenueEstimated: 0 });
    expect(m.daily).toHaveLength(14);
    expect(m.daily.every((d) => d.leads === 0)).toBe(true);
  });
  it("receita real e estimada separadas; simulados excluídos", () => {
    const m = computeMetrics(
      [L("2026-11-24T12:00:00Z", "won", 70), L("2026-11-23T12:00:00Z", "meeting", 40), L("2026-11-24T12:00:00Z", "qualified", 80), L("2026-11-24T12:00:00Z", "won", 90, true)],
      [{ value_cents: 150000, status: "won", closed_at: "2026-11-24T12:00:00Z", created_at: "2026-11-20T12:00:00Z" }, { value_cents: 90000, status: "open", closed_at: null, created_at: "2026-11-22T12:00:00Z" }],
      [{ provider: "google_places", units: 5, cost_cents: 100, created_at: "2026-11-24T10:00:00Z" }],
      now,
    );
    expect(m.kpis).toMatchObject({ total: 3, won: 1, qualified: 2, revenueReal: 150000, revenueEstimated: 90000, simulated: 1, requestsMonth: 5, costMonth: 100 });
    expect(m.kpis.conversion).toBeCloseTo(0.5);
    expect(m.daily.at(-1)).toMatchObject({ leads: 2, qualified: 2 });
    expect(m.revenue.at(-1)).toMatchObject({ real: 150000, estimated: 90000 });
  });
});
