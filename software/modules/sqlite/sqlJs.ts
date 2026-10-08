import initSqlJs, { type SqlJsStatic } from 'sql.js';

export const SQL_JS_WASM_FILENAME = 'sql-wasm-browser.wasm';

/** Resolve the public sql.js asset independently of the current Expo Router path. */
export function resolveSqlJsWasmUrl(pageUrl: string, baseUrl = ''): string {
  const origin = new URL(pageUrl).origin;
  const basePath = baseUrl.replace(/^\/+|\/+$/g, '');
  const assetPath = `/${basePath ? `${basePath}/` : ''}${SQL_JS_WASM_FILENAME}`;
  return new URL(assetPath, origin).href;
}

let sqlJsInitialization: Promise<SqlJsStatic> | undefined;

/** Initialize the shared sql.js runtime with Expo's deployment base path on web. */
export async function initializeSqlJs(purpose: string): Promise<SqlJsStatic> {
  const pageUrl = globalThis.location?.href;
  const wasmUrl = pageUrl
    ? resolveSqlJsWasmUrl(pageUrl, process.env.EXPO_BASE_URL)
    : undefined;

  try {
    sqlJsInitialization ??= initSqlJs(
      wasmUrl ? { locateFile: () => wasmUrl } : undefined,
    );
    return await sqlJsInitialization;
  } catch (cause) {
    sqlJsInitialization = undefined;
    const location = wasmUrl ?? `the installed ${SQL_JS_WASM_FILENAME} asset`;
    throw new Error(
      `Unable to initialize ${purpose}: sql.js WebAssembly could not be loaded from ${location}. Verify the web WASM asset is installed and served at the Expo base URL.`,
      { cause },
    );
  }
}
