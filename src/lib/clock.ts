// src/lib/clock.ts
// Monotonic per-device millisecond clock.
// Always advances by at least 1 ms so concurrent local writes never share a timestamp.
// Never call Date.now() directly for stored timestamps — use now() from here.

let last = 0;

export function now(): number {
  const t = Date.now();
  last = Math.max(t, last + 1);
  return last;
}
