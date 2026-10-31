import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const softwareRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(softwareRoot, p), 'utf8');

test('issue 126: mascot on first (adult, wave) and last (target, cheer) steps only', () => {
  assert.match(read('app/onboarding/adult.tsx'), /mascotPose="wave"/);
  assert.match(read('app/onboarding/target.tsx'), /mascotPose="cheer"/);
  const steps = readdirSync(join(softwareRoot, 'app/onboarding')).filter(
    (f) => f.endsWith('.tsx') && !['adult.tsx', 'target.tsx', 'OnboardingShell.tsx', '_layout.tsx'].includes(f),
  );
  assert.ok(steps.length >= 3, 'middle steps found');
  for (const f of steps) assert.doesNotMatch(read(`app/onboarding/${f}`), /mascotPose|<Mascot/, `${f} stays plain`);
});

test('issue 126: shell renders mascot above a Nunito display title; brand primary CTA', () => {
  const shell = read('app/onboarding/OnboardingShell.tsx');
  assert.match(shell, /mascotPose\?: MascotPose/);
  assert.ok(shell.indexOf('<Mascot pose={mascotPose}') < shell.indexOf('{title}'), 'mascot above title');
  assert.match(shell, /mascotPose \? typography\.display : typography\.section/);
  assert.match(shell, /disabled=\{primaryDisabled\}\s*variant="brand"/);
  assert.match(shell, /label=\{secondaryLabel\}\s*variant="secondary"/, 'secondary unchanged');
});

test('issue 126: disabled brand CTA uses the gated muted-on-control pair at full opacity', () => {
  const button = read('design-system/components/PrimaryButton.tsx');
  assert.match(button, /const brandDisabled = variant === 'brand' && !!disabled;/);
  assert.match(button, /const bg = brandDisabled\s*\?\s*colors\.control/);
  assert.match(button, /const fg = brandDisabled\s*\?\s*colors\.muted/);
  assert.match(button, /opacity: brandDisabled \? 1 :/);
});
