/**
 * Recalculate diary nutrition from the entry's immutable snapshot when qty changes.
 * Never re-reads seed catalog or custom_food — history stays frozen to logged values.
 */

import type { NutrientMap } from '../../app-core/user-data';
import { isValidQuantity } from '../food-detail/parseQuantity';
import { scaleNutrientsByFactor } from '../food-detail/scaleNutrients';

export type SnapshotQtySource = {
  quantity: number;
  grams: number | null;
  nutritionSnapshot: NutrientMap;
};

export type ScaledQtyResult = {
  quantity: number;
  grams: number | null;
  nutritionSnapshot: NutrientMap;
  factor: number;
};

function roundGrams(grams: number): number {
  return Math.round(grams * 1000) / 1000;
}

/**
 * Scale `entry` nutrition/grams by (newQuantity / entry.quantity).
 * Null nutrients stay null. Grams stay null when the original had no grams.
 */
export function scaleSnapshotForQuantity(
  entry: SnapshotQtySource,
  newQuantity: number,
): ScaledQtyResult {
  if (!isValidQuantity(newQuantity)) {
    throw new Error('scaleSnapshotForQuantity: newQuantity must be a positive finite number');
  }
  if (!isValidQuantity(entry.quantity)) {
    throw new Error('scaleSnapshotForQuantity: entry.quantity must be a positive finite number');
  }
  const factor = newQuantity / entry.quantity;
  const nutritionSnapshot = scaleNutrientsByFactor(entry.nutritionSnapshot, factor);
  const grams =
    entry.grams != null && entry.grams > 0 ? roundGrams(entry.grams * factor) : null;
  return {
    quantity: newQuantity,
    grams,
    nutritionSnapshot,
    factor,
  };
}
