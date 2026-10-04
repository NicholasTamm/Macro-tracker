/**
 * Platform share handoff for M1-19 export.
 * Imported by Settings UI only — not part of the pure export barrel
 * (avoids loading react-native in Node unit tests).
 */
import { Share, Platform } from 'react-native';
import type { ExportFiles } from './types';
import { EXPO_FILE_SHARE_PATH_DOC } from './sharePathDoc';

export type ShareExportResult =
  | { ok: true; method: 'react-native-share' | 'documented-file-path' }
  | { ok: false; reason: string };

export { EXPO_FILE_SHARE_PATH_DOC };

/**
 * Share export via the platform share sheet (RN Share API).
 * Attaches JSON + CSV text for M1; optional expo-file-system URI path is documented.
 */
export async function shareExportViaPlatform(
  files: ExportFiles,
): Promise<ShareExportResult> {
  try {
    const message = [
      `Macro-tracker offline export`,
      `JSON file: ${files.suggestedJsonName}`,
      `CSV file: ${files.suggestedCsvName}`,
      '',
      '--- JSON ---',
      files.json,
      '',
      '--- CSV ---',
      files.csv,
    ].join('\n');

    await Share.share(
      Platform.OS === 'ios'
        ? { message, title: 'Macro-tracker export' }
        : { message, title: 'Macro-tracker export' },
    );
    return { ok: true, method: 'react-native-share' };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
