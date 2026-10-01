export function newEntityId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  throw new Error('crypto.randomUUID unavailable');
}

export function nowIso(): string {
  return new Date().toISOString();
}
