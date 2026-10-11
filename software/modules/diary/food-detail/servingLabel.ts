import type { ServingChoice } from './resolveAmount';

function cleanLabelPart(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function comparisonText(value: string): string {
  return cleanLabelPart(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Format a serving unit while removing repeated or overlapping modifier text. */
export function formatServingUnitLabel(
  serving: Pick<ServingChoice, 'unit' | 'modifier'>,
): string {
  const unit = cleanLabelPart(serving.unit);
  const modifier = serving.modifier ? cleanLabelPart(serving.modifier) : '';
  if (!modifier) return unit;

  const unitComparison = comparisonText(unit);
  const modifierComparison = comparisonText(modifier);
  if (
    !modifierComparison ||
    modifierComparison === unitComparison ||
    unitComparison.endsWith(` ${modifierComparison}`)
  ) {
    return unit;
  }

  // Catalog modifiers sometimes repeat the unit before adding useful detail,
  // e.g. unit="cup" and modifier="cup, mashed".
  if (modifierComparison.startsWith(`${unitComparison} `)) {
    const unitWords = unitComparison.split(' ').length;
    const detail = modifier
      .split(/\s+/)
      .slice(unitWords)
      .join(' ')
      .replace(/^[,;:()\-–—]+\s*/, '');
    if (detail) return `${unit} (${detail})`;
    return unit;
  }

  return `${unit} (${modifier})`;
}

/** Picker label includes a catalog quantity only when it is not one. */
export function formatServingPickerLabel(
  serving: Pick<ServingChoice, 'quantity' | 'unit' | 'modifier'>,
): string {
  const unitLabel = formatServingUnitLabel(serving);
  return serving.quantity !== 1 ? `${serving.quantity} ${unitLabel}` : unitLabel;
}
