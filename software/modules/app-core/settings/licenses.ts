export type BundledLicense = {
  name: string;
  license: string;
};

export const BUNDLED_LICENSES: readonly BundledLicense[] = [
  { name: 'Expo', license: 'MIT' },
  { name: 'Expo Router', license: 'MIT' },
  { name: 'Expo SQLite', license: 'MIT' },
  { name: 'React', license: 'MIT' },
  { name: 'React Native', license: 'MIT' },
  { name: 'React Navigation', license: 'MIT' },
  { name: 'sql.js', license: 'MIT' },
  { name: 'TypeScript', license: 'Apache-2.0' },
] as const;
