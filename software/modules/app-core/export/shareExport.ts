/**
 * Platform share handoff for M1-19 export.
 *
 * Prefer React Native Share (message body with JSON + CSV filenames).
 * When expo-sharing + expo-file-system are installed in a future pass,
 * callers may write temp files and share URIs; this module documents that path
 * without requiring those packages for offline generation.
 */
import { Share, Platform } from 'react-native';
import type { ExportFiles } from './types';

export type ShareExportResult =
  | { ok: true; method: 'react-native-share' | 'documented-file-path' }
  | { ok: false; reason: string };

/**
 * Share export via the platform share sheet (RN Share API).
 * Attaches JSON (and a CSV note) as the share message for M1.
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

    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message, title: 'Macro-tracker export' }
        : { message, title: 'Macro-tracker export' },
    );

    if (result.action === Share.dismissedAction) {
      return { ok: true, method: 'react-native-share' };
    }
    return { ok: true, method: 'react-native-share' };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Documented Expo file-share path (optional future):
 * 1. `expo-file-system` write `cacheDirectory + suggestedJsonName` / CSV
 * 2. `expo-sharing` `Sharing.shareAsync(uri, { mimeType, dialogTitle })`
 * M1 uses RN Share above so export works without extra native modules.
 */
export const EXPO_FILE_SHARE_PATH_DOC = [
  'Optional file URI share (not required for M1):',
  '1. Write ExportFiles.json/csv under FileSystem.cacheDirectory',
  '2. Call Sharing.shareAsync(uri) from expo-sharing',
  '3. Keep generation offline via buildUserDataExportFiles(db)',
].join('\n');
