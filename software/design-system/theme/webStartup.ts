import { darkPalette, lightPalette } from '../tokens/colors';
import { WEB_THEME_PREFERENCE_STORAGE_KEY } from '../../modules/app-core/settings/themePreference';

// Used in the document head, before the static app markup or bundle is parsed.
// CSS covers system preference even when JavaScript or localStorage is disabled.
export const webStartupStyle = `
:root { --startup-canvas: ${lightPalette.canvas}; color-scheme: light; }
@media (prefers-color-scheme: dark) {
  :root { --startup-canvas: ${darkPalette.canvas}; color-scheme: dark; }
}
html, body, #root { background-color: var(--startup-canvas); }
`;

export const webStartupScript = `
try {
  var preference = localStorage.getItem(${JSON.stringify(WEB_THEME_PREFERENCE_STORAGE_KEY)});
  if (preference === 'light' || preference === 'dark') {
    document.documentElement.style.setProperty('--startup-canvas',
      preference === 'dark' ? ${JSON.stringify(darkPalette.canvas)} : ${JSON.stringify(lightPalette.canvas)});
    document.documentElement.style.colorScheme = preference;
  }
} catch (_) {}
`;
