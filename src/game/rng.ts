/** Deterministic RNG so a sortie seed replays the same corridor. */
export class RNG {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 1;
  }

  next(): number {
    let a = this.state | 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    this.state = a >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n: number): number {
    if (n <= 1) return 0;
    return Math.floor(this.next() * n);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }
}
