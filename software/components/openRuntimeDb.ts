import { openSqlJsDatabase, type SqlExecutor } from '@/modules/app-core/user-data';

const SQLJS_STORAGE_KEY = 'macro-tracker:UserData.sqljs.b64';

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function readPersistedSqlJs(): Uint8Array | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const b64 = localStorage.getItem(SQLJS_STORAGE_KEY);
    return b64 ? base64ToBytes(b64) : undefined;
  } catch {
    return undefined;
  }
}

/** Web/Node runtime: persist sql.js bytes through UserDataProvider. */
export async function openRuntimeDb(): Promise<{
  db: SqlExecutor;
  persistSqlJs: boolean;
}> {
  return {
    db: await openSqlJsDatabase(readPersistedSqlJs()),
    persistSqlJs: true,
  };
}
