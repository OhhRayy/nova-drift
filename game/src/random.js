// NOVA DRIFT — a tiny seeded random generator (mulberry32).
// One file, one job: deterministic randomness, so a fixed seed always plays
// the same field, which is what the screenshot scenes rely on.

/**
 * Make a generator from a 32-bit seed. Every call returns a float in [0, 1).
 * The same seed always gives the same sequence.
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max) from the generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max] from the generator. */
export function rangeInt(random, min, max) {
  return Math.floor(range(random, min, max + 1));
}

/** Pick one element of an array with the generator. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** A random angle in radians. */
export function angle(random) {
  return random() * Math.PI * 2;
}
