import type { UserDataExport } from './types';

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cells: Array<string | number | boolean | null | undefined>): string {
  return cells.map(csvEscape).join(',');
}

/**
 * Multi-section CSV: provenance, profile, goals, targets, diary, weights, custom foods.
 * Diary rows embed nutrition_snapshot_json and source/license provenance per entry.
 */
export function exportToCsvString(payload: UserDataExport): string {
  const lines: string[] = [];

  lines.push('# section:provenance');
  lines.push(row(['key', 'value']));
  lines.push(row(['exportedAt', payload.provenance.exportedAt]));
  lines.push(row(['appId', payload.provenance.appId]));
  lines.push(row(['schemaVersion', payload.provenance.schemaVersion]));
  lines.push(row(['formatVersion', payload.provenance.formatVersion]));
  lines.push(row(['note', payload.provenance.note]));
  lines.push('');

  lines.push('# section:profile');
  lines.push(
    row([
      'id',
      'isAdultConfirmed',
      'massUnit',
      'heightUnit',
      'energyUnit',
      'sex',
      'birthYear',
      'heightCm',
      'weightKg',
      'exclusions_json',
      'onboardingStep',
      'onboardingCompletedAt',
    ]),
  );
  if (payload.profile) {
    const p = payload.profile;
    lines.push(
      row([
        p.id,
        p.isAdultConfirmed,
        p.massUnit,
        p.heightUnit,
        p.energyUnit,
        p.sex,
        p.birthYear,
        p.heightCm,
        p.weightKg,
        JSON.stringify(p.exclusions),
        p.onboardingStep,
        p.onboardingCompletedAt,
      ]),
    );
  }
  lines.push('');

  lines.push('# section:goals');
  lines.push(row(['id', 'profileId', 'goalKind', 'rateKgPerWeek', 'isActive']));
  for (const g of payload.goals) {
    lines.push(row([g.id, g.profileId, g.goalKind, g.rateKgPerWeek, g.isActive]));
  }
  lines.push('');

  lines.push('# section:targets');
  lines.push(
    row([
      'id',
      'profileId',
      'energyKcal',
      'proteinG',
      'carbohydrateG',
      'fatG',
      'source',
      'effectiveFrom',
    ]),
  );
  for (const t of payload.targets) {
    lines.push(
      row([
        t.id,
        t.profileId,
        t.energyKcal,
        t.proteinG,
        t.carbohydrateG,
        t.fatG,
        t.source,
        t.effectiveFrom,
      ]),
    );
  }
  lines.push('');

  lines.push('# section:diary_entries');
  lines.push(
    row([
      'id',
      'timestamp',
      'localDayKey',
      'timezoneIdentifier',
      'mealSlotId',
      'foodKind',
      'foodStableId',
      'foodDisplayName',
      'foodLicenseTag',
      'quantity',
      'unitLabel',
      'grams',
      'nutrition_snapshot_json',
      'sourceDisplayName',
      'licenseTag',
      'deletedAt',
    ]),
  );
  for (const e of payload.diaryEntries) {
    lines.push(
      row([
        e.id,
        e.timestamp,
        e.localDayKey,
        e.timezoneIdentifier,
        e.mealSlotId,
        e.foodKind,
        e.foodStableId,
        e.foodDisplayName,
        e.foodLicenseTag,
        e.quantity,
        e.unitLabel,
        e.grams,
        JSON.stringify(e.nutritionSnapshot),
        e.sourceDisplayName,
        e.licenseTag,
        e.deletedAt,
      ]),
    );
  }
  lines.push('');

  lines.push('# section:weights');
  lines.push(
    row(['id', 'timestamp', 'kilograms', 'source', 'confirmedOutlier', 'deletedAt']),
  );
  for (const w of payload.weights) {
    lines.push(
      row([
        w.id,
        w.timestamp,
        w.kilograms,
        w.source,
        w.confirmedOutlier,
        w.deletedAt,
      ]),
    );
  }
  lines.push('');

  lines.push('# section:custom_foods');
  lines.push(
    row([
      'id',
      'name',
      'brand',
      'barcodeGtin14',
      'basisKind',
      'basisAmount',
      'basisUnit',
      'gramWeightForBasis',
      'nutrients_json',
      'isArchived',
      'deletedAt',
    ]),
  );
  for (const f of payload.customFoods) {
    lines.push(
      row([
        f.id,
        f.name,
        f.brand,
        f.barcodeGtin14,
        f.basisKind,
        f.basisAmount,
        f.basisUnit,
        f.gramWeightForBasis,
        JSON.stringify(f.nutrients),
        f.isArchived,
        f.deletedAt,
      ]),
    );
  }
  lines.push('');

  return lines.join('\n');
}
