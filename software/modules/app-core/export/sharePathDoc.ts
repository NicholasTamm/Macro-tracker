/** Documented optional Expo file URI share path (M1 uses RN Share). */
export const EXPO_FILE_SHARE_PATH_DOC = [
  'Optional file URI share (not required for M1):',
  '1. Write ExportFiles.json/csv under FileSystem.cacheDirectory',
  '2. Call Sharing.shareAsync(uri) from expo-sharing',
  '3. Keep generation offline via buildUserDataExportFiles(db)',
].join('\n');
