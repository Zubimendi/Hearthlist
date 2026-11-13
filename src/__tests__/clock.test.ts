import { now } from '../lib/clock';

describe('clock', () => {
  it('returns a positive number', () => {
    const t = now();
    expect(typeof t).toBe('number');
    expect(t).toBeGreaterThan(0);
  });

  it('is monotonic: successive calls never decrease or equal', () => {
    const readings: number[] = [];
    for (let i = 0; i < 1000; i++) {
      readings.push(now());
    }

    for (let i = 1; i < readings.length; i++) {
      expect(readings[i]).toBeGreaterThan(readings[i - 1]);
    }
  });
});
