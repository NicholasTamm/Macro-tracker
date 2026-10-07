import type { SeedStore, StagedSeed } from './types';

type StoredSeed = StagedSeed & { bytes: Uint8Array; staged: boolean };

export class InMemorySeedStore implements SeedStore {
  private readonly seeds = new Map<string, StoredSeed>();
  private activePointer: string | null;
  private nextId = 1;
  failActivation = false;

  constructor(initial?: { id?: string; seedVersion: string; bytes: Uint8Array }) {
    if (initial) {
      const id = initial.id ?? 'initial';
      this.seeds.set(id, { ...initial, id, bytes: initial.bytes.slice(), staged: false });
      this.activePointer = id;
    } else {
      this.activePointer = null;
    }
  }

  async stageBytes(bytes: Uint8Array, seedVersion: string): Promise<StagedSeed> {
    const staged = { id: `staged-${this.nextId++}`, seedVersion };
    this.seeds.set(staged.id, { ...staged, bytes: bytes.slice(), staged: true });
    return staged;
  }

  async readActivePointer(): Promise<string | null> {
    return this.activePointer;
  }

  async atomicSwapActivePointer(
    staged: StagedSeed,
    expectedPrevious: string | null,
  ): Promise<void> {
    if (this.activePointer !== expectedPrevious) throw new Error('active seed changed');
    const stored = this.seeds.get(staged.id);
    if (!stored?.staged) throw new Error('staged seed missing');
    if (this.failActivation) throw new Error('injected activation failure');
    stored.staged = false;
    this.activePointer = staged.id;
  }

  async deleteStaged(staged: StagedSeed): Promise<void> {
    const stored = this.seeds.get(staged.id);
    if (stored?.staged) this.seeds.delete(staged.id);
  }

  hasSeed(id: string): boolean {
    return this.seeds.has(id);
  }

  stagedCount(): number {
    return [...this.seeds.values()].filter((seed) => seed.staged).length;
  }

  bytesFor(id: string): Uint8Array | null {
    return this.seeds.get(id)?.bytes.slice() ?? null;
  }
}
