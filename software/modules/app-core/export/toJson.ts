import type { ExportFiles, UserDataExport } from './types';

export function exportToJsonString(payload: UserDataExport): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseExportJson(raw: string): UserDataExport {
  const parsed = JSON.parse(raw) as UserDataExport;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Export JSON root must be an object');
  }
  if (!parsed.provenance || parsed.provenance.formatVersion !== 1) {
    throw new Error('Unsupported or missing export formatVersion');
  }
  if (!Array.isArray(parsed.diaryEntries)) {
    throw new Error('Export JSON missing diaryEntries array');
  }
  if (!Array.isArray(parsed.weights)) {
    throw new Error('Export JSON missing weights array');
  }
  if (!Array.isArray(parsed.targets)) {
    throw new Error('Export JSON missing targets array');
  }
  return parsed;
}

export function suggestedExportFilenames(exportedAt: string): {
  json: string;
  csv: string;
} {
  const stamp = exportedAt.replace(/[:.]/g, '-');
  return {
    json: `macro-tracker-export-${stamp}.json`,
    csv: `macro-tracker-export-${stamp}.csv`,
  };
}

export function buildExportFiles(payload: UserDataExport, csv: string): ExportFiles {
  const names = suggestedExportFilenames(payload.provenance.exportedAt);
  return {
    json: exportToJsonString(payload),
    csv,
    suggestedJsonName: names.json,
    suggestedCsvName: names.csv,
  };
}
