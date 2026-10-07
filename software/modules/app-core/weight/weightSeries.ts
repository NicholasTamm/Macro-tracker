/**
 * M1-17 weight helpers — pure, no RN imports.
 * Storage is canonical kilograms; display/entry follows the profile mass unit.
 */
import type { MassUnit } from '../user-data/profileTypes';
import { kgToLb, lbToKg, round1 } from '../user-data/unitConvert';
import type { WeightSample } from '../user-data/weightSampleRepo';

export const WEIGHT_WINDOW_DAYS = 30;
/** Plausibility bounds (canonical kg) to catch typos like 7240. */
export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDisplayWeight(kg: number, unit: MassUnit): number {
  return round1(unit === 'lb' ? kgToLb(kg) : kg);
}

export function fromDisplayWeight(value: number, unit: MassUnit): number {
  return unit === 'lb' ? lbToKg(value) : value;
}

export function formatWeight(kg: number, unit: MassUnit): string {
  return `${toDisplayWeight(kg, unit).toFixed(1)} ${unit}`;
}

export type ParsedWeight = { ok: true; kilograms: number } | { ok: false; error: string };

/** Parse user text (accepts `,` decimal separator) in the given unit → canonical kg. */
export function parseWeightInput(text: string, unit: MassUnit): ParsedWeight {
  const t = text.trim().replace(',', '.');
  if (t === '') return { ok: false, error: 'Enter a weight.' };
  if (!/^\d+(\.\d+)?$/.test(t)) return { ok: false, error: 'Enter a number, e.g. 72.4.' };
  const value = Number(t);
  const kilograms = fromDisplayWeight(value, unit);
  if (!(kilograms >= MIN_WEIGHT_KG && kilograms <= MAX_WEIGHT_KG)) {
    const lo = toDisplayWeight(MIN_WEIGHT_KG, unit);
    const hi = toDisplayWeight(MAX_WEIGHT_KG, unit);
    return { ok: false, error: `Weight must be between ${lo} and ${hi} ${unit}.` };
  }
  return { ok: true, kilograms };
}

/** Convert a valid draft between display units; invalid drafts cannot be preserved safely. */
export function convertWeightInput(
  text: string,
  fromUnit: MassUnit,
  toUnit: MassUnit,
): string | null {
  const parsed = parseWeightInput(text, fromUnit);
  return parsed.ok ? String(toDisplayWeight(parsed.kilograms, toUnit)) : null;
}

/** Live samples within [now - days, now], ascending by timestamp. Tombstones excluded. */
export function windowSamples(
  samples: readonly WeightSample[],
  now: Date,
  days: number = WEIGHT_WINDOW_DAYS,
): WeightSample[] {
  const end = now.getTime();
  const start = end - days * DAY_MS;
  return samples
    .filter((s) => s.deletedAt == null)
    .filter((s) => {
      const t = Date.parse(s.timestamp);
      return Number.isFinite(t) && t >= start && t <= end;
    })
    .slice()
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export type WeightSummaryState = 'empty' | 'sparse' | 'full';

export type WeightSummary = {
  state: WeightSummaryState;
  count: number;
  latestKg: number | null;
  minKg: number | null;
  maxKg: number | null;
  /** latest - earliest in window (kg); null when < 2 samples. */
  changeKg: number | null;
};

/** Summary over already-windowed samples (ascending). 0 → empty, 1–2 → sparse. */
export function summarizeWeights(windowed: readonly WeightSample[]): WeightSummary {
  const live = windowed.filter((s) => s.deletedAt == null);
  const count = live.length;
  if (count === 0) {
    return { state: 'empty', count, latestKg: null, minKg: null, maxKg: null, changeKg: null };
  }
  const kgs = live.map((s) => s.kilograms);
  const latestKg = kgs[kgs.length - 1];
  return {
    state: count <= 2 ? 'sparse' : 'full',
    count,
    latestKg,
    minKg: Math.min(...kgs),
    maxKg: Math.max(...kgs),
    changeKg: count >= 2 ? latestKg - kgs[0] : null,
  };
}

function formatChange(changeKg: number, unit: MassUnit): string {
  const d = toDisplayWeight(Math.abs(changeKg), unit);
  if (d === 0) return `no change`;
  return `${changeKg > 0 ? 'up' : 'down'} ${d.toFixed(1)} ${unit}`;
}

/** Screen-reader (and visible) text summary of the 30-day chart. */
export function weightSummaryText(
  summary: WeightSummary,
  unit: MassUnit,
  days: number = WEIGHT_WINDOW_DAYS,
): string {
  if (summary.state === 'empty' || summary.latestKg == null) {
    return `No weights logged in the last ${days} days. Log a weight to start your chart.`;
  }
  const latest = formatWeight(summary.latestKg, unit);
  if (summary.count === 1) {
    return `1 weight in the last ${days} days: ${latest}. Log another to see a change.`;
  }
  const parts = [
    `${summary.count} weights in the last ${days} days.`,
    `Latest ${latest}.`,
    `Lowest ${formatWeight(summary.minKg!, unit)}, highest ${formatWeight(summary.maxKg!, unit)}.`,
    `Change ${formatChange(summary.changeKg!, unit)}.`,
  ];
  if (summary.state === 'sparse') parts.push('Log more weights for a clearer trend.');
  return parts.join(' ');
}

export type ChartPoint = {
  id: string;
  /** 0 = window start, 1 = now. */
  x: number;
  /** 0 = bottom (min), 1 = top (max). Single value / flat series → 0.5. */
  y: number;
  kilograms: number;
};

/** Normalized chart coordinates for windowed samples. */
export function chartPoints(
  windowed: readonly WeightSample[],
  now: Date,
  days: number = WEIGHT_WINDOW_DAYS,
): ChartPoint[] {
  const live = windowed.filter((s) => s.deletedAt == null);
  if (live.length === 0) return [];
  const end = now.getTime();
  const start = end - days * DAY_MS;
  const kgs = live.map((s) => s.kilograms);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const span = max - min;
  return live.map((s) => {
    const x = Math.min(1, Math.max(0, (Date.parse(s.timestamp) - start) / (end - start)));
    const y = span === 0 ? 0.5 : (s.kilograms - min) / span;
    return { id: s.id, x, y, kilograms: s.kilograms };
  });
}
