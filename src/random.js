// Deterministic random numbers: the scene must build identically on every load so the shot is reproducible.

// mulberry32: a small fast PRNG with a 32-bit state.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A deterministic 0..1 value for integer coordinates and a seed (a hash, not a sequence).
export function hash2(i, j, seed = 0) {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Random helpers over a generator: uniform in [a, b), and a symmetric jitter of +-amount.
export function uniform(rand, a, b) {
  return a + (b - a) * rand();
}
export function jitter(rand, amount) {
  return (rand() * 2 - 1) * amount;
}
