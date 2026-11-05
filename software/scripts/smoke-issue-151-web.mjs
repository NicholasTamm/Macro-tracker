// Production biometrics screen, shell and brand CTA through React Native Web.
// Isolate app persistence, router, safe area and native theme context only.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2]);
mkdirSync(out, { recursive: true });
await build({
  stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {flushSync} from 'react-dom';
    import Biometrics from './app/onboarding/biometrics';
    import {lightPalette, darkPalette} from './design-system/tokens';
    const root = createRoot(document.getElementById('root'));
    const check = (ok, message) => {if (!ok) throw new Error(message)};
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    const button = () => document.querySelector('[aria-label="Continue"]');
    const field = label => document.querySelector('input[aria-label="' + label + '"]');
    const edit = async (label, value) => {
      const input = field(label);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', {bubbles:true}));
      await tick();
    };
    const rgb = hex => 'rgb(' + hex.slice(1).match(/../g).map(x=>parseInt(x,16)).join(', ') + ')';
    (async () => {try {
      for (const scheme of ['light','dark']) for (const imperial of [false,true]) {
        window.smokeScheme = scheme;
        window.profile = {birthYear:null,heightCm:null,weightKg:null,heightUnit:imperial?'in':'cm',massUnit:imperial?'lb':'kg'};
        window.calls = [];
        flushSync(() => root.render(<Biometrics key={scheme + imperial}/>));
        await tick();
        const colors = scheme === 'dark' ? darkPalette : lightPalette;
        check([...document.querySelectorAll('input')].every(x=>x.value === ''), 'fresh fields blank');
        check(button().getAttribute('aria-disabled') === 'true', 'empty disabled');
        check(getComputedStyle(button()).backgroundColor === rgb(colors.control), 'disabled control fill');
        check(getComputedStyle(button().firstElementChild).color === rgb(colors.muted), 'disabled muted label');
        check(getComputedStyle(button()).opacity === '1', 'disabled full opacity');
        button().click(); await tick();
        check(window.calls.length === 0, 'disabled cannot submit');
        const height = imperial ? 'Height in in' : 'Height in cm';
        const weight = imperial ? 'Weight in lb' : 'Weight in kg';
        await edit('Birth year','1990'); await edit(height,imperial?'67':'170');
        check(button().getAttribute('aria-disabled') === 'true', 'weight required');
        await edit(weight,imperial?'154':'70');
        check(button().getAttribute('aria-disabled') !== 'true', 'valid enabled');
        for (const [label,value] of [['Birth year',String(new Date().getFullYear()-17)],[height,'0'],[weight,'-1'],[weight,'']]) {
          const previous = field(label).value;
          await edit(label,value);
          check(button().getAttribute('aria-disabled') === 'true', 'invalid blocked '+label+' '+value);
          button().click(); await tick();
          check(window.calls.length === 0, 'invalid never saves');
          await edit(label,previous);
        }
        check(getComputedStyle(button()).backgroundColor === rgb(colors.brand), 'enabled brand fill');
        button().click(); await tick();
        check(JSON.stringify(window.calls) === JSON.stringify([
          ['save',{sex:'unspecified',birthYear:1990,heightCm:imperial?170.2:170,weightKg:imperial?69.9:70}],
          ['refresh'],['push','/onboarding/goal']
        ]), 'valid saves canonical values and advances: '+JSON.stringify(window.calls));
      }
      document.body.dataset.result='PASS';
    } catch(error) {document.body.dataset.result='FAIL'; document.body.append(String(error));}})();
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  alias: { 'react-native': 'react-native-web', '@': process.cwd() },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: resolve(out, 'bundle.js'),
  plugins: [{ name: 'smoke-boundaries', setup(builder) {
    const virtual = {
      design: `export {PrimaryButton} from './design-system/components/PrimaryButton';
        export {Card} from './design-system/components/Card';
        export const Mascot = () => null;
        export {useTheme} from 'smoke-theme';`,
      theme: `import {lightPalette,darkPalette,Spacing,Radius,SystemTypography} from './design-system/tokens';
        export const useTheme=()=>({colors:window.smokeScheme==='dark'?darkPalette:lightPalette,spacing:Spacing,radius:Radius,typography:SystemTypography,font:weight=>({fontWeight:weight})});`,
      data: `export {cmToIn,inToCm,kgToLb,lbToKg,round1} from './modules/app-core/user-data/unitConvert';
        export const saveBiometrics=(_,bio)=>window.calls.push(['save',bio]);`,
      provider: `export const useUserData=()=>({db:{},snapshot:{profile:window.profile},refresh:()=>window.calls.push(['refresh'])});`,
      router: `export const router={push:route=>window.calls.push(['push',route]),back:()=>window.calls.push(['back'])};`,
      safe: `export {View as SafeAreaView} from 'react-native';`,
    };
    builder.onResolve({filter:/^(@\/design-system|\.\.\/theme|smoke-theme|@\/modules\/app-core\/user-data|@\/modules\/app-core\/settings|@\/components\/UserDataProvider|expo-router|react-native-safe-area-context)$/}, args => {
      if (args.path.endsWith('/settings')) return {path:resolve('modules/app-core/settings/unitDisplay.ts')};
      const key = {'@/design-system':'design','../theme':'theme','smoke-theme':'theme','@/modules/app-core/user-data':'data','@/components/UserDataProvider':'provider','expo-router':'router','react-native-safe-area-context':'safe'}[args.path];
      return {path:key,namespace:'smoke'};
    });
    builder.onLoad({filter:/.*/,namespace:'smoke'}, args=>({contents:virtual[args.path],resolveDir:process.cwd(),loader:'js'}));
  }}],
});
writeFileSync(resolve(out, 'index.html'), '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="root"></div><script src="bundle.js"></script>');

// CDP pipe gives a bounded result without depending on Chrome's dump-dom load wait.
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', [
  '--headless', '--no-sandbox', '--disable-gpu', '--disable-extensions',
  '--disable-background-networking', '--no-first-run', '--remote-debugging-pipe',
  `--user-data-dir=${resolve(out, 'chrome')}`,
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let sequence = 0, buffer = '';
const pending = new Map();
chrome.stdio[4].on('data', chunk => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(timer);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  }
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await send('Page.navigate', { url: pathToFileURL(resolve(out, 'index.html')).href }, sessionId);
  let result;
  for (let attempt = 0; attempt < 100; attempt++) {
    const evaluated = await send('Runtime.evaluate', { expression: 'document.body?.dataset.result', returnByValue: true }, sessionId);
    result = evaluated.result.value;
    if (result) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (result !== 'PASS') {
    const dom = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true }, sessionId);
    throw new Error(`Browser smoke ${result}: ${dom.result.value}`);
  }
  console.log('PASS: Chrome at 390x844, production biometrics + shell + brand CTA, light/dark, metric/imperial, empty/invalid blocked, valid canonical save and Goal navigation');
} finally {
  chrome.kill();
}
