import type { ServingChoice } from './resolveAmount';

const SERVING_IDENTITY_PREFIX = 'serving:v1:';

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
    let detail = modifier
      .split(/\s+/)
      .slice(unitWords)
      .join(' ')
      .replace(/^[,;:\-–—]+\s*/, '');
    // Unwrap a leading parenthesized segment before adding our outer pair.
    // This also handles suffixes such as "(8 fl oz), drained".
    detail = detail.replace(/^\(([^()]*)\)(.*)$/, '$1$2').trim();
    if (detail) return `${unit} (${detail})`;
    return unit;
  }

  return `${unit} (${modifier})`;
}

/** Use the same canonical unit label everywhere the serving is displayed. */
export function formatServingPickerLabel(
  serving: Pick<ServingChoice, 'unit' | 'modifier'>,
): string {
  return formatServingUnitLabel(serving);
}

/** Catalog-row-independent identity used to remember a serving choice safely. */
export function servingIdentityKey(
  serving: Pick<
    ServingChoice,
    'quantity' | 'unit' | 'modifier' | 'gramWeight'
  >,
): string {
  return `${SERVING_IDENTITY_PREFIX}${JSON.stringify([
    serving.quantity,
    cleanLabelPart(serving.unit),
    serving.modifier ? cleanLabelPart(serving.modifier) : null,
    serving.gramWeight,
  ])}`;
}

export function isServingIdentityKey(value: string): boolean {
  return value.startsWith(SERVING_IDENTITY_PREFIX);
}
