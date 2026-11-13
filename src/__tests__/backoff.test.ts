import { computeBackoffDelay } from '../sync/backoff';

describe('computeBackoffDelay', () => {
  it('calculates exponential delay with 0 jitter', () => {
    // With randomFn returning 0.5, jitterMultiplier is 1 + (0.5 * 2 - 1) * 0.2 = 1.0
    const zeroJitter = () => 0.5;

    expect(computeBackoffDelay(0, {}, zeroJitter)).toBe(2000);
    expect(computeBackoffDelay(1, {}, zeroJitter)).toBe(4000);
    expect(computeBackoffDelay(2, {}, zeroJitter)).toBe(8000);
    expect(computeBackoffDelay(3, {}, zeroJitter)).toBe(16000);
  });

  it('caps at 300,000 ms (5 minutes)', () => {
    const zeroJitter = () => 0.5;
    expect(computeBackoffDelay(10, {}, zeroJitter)).toBe(300000);
    expect(computeBackoffDelay(20, {}, zeroJitter)).toBe(300000);
  });

  it('applies +/- 20% jitter bounds', () => {
    // Min jitter when randomFn returns 0: 1 + (-1) * 0.2 = 0.8
    // Max jitter when randomFn returns 1: 1 + (1) * 0.2 = 1.2
    const minJitter = () => 0;
    const maxJitter = () => 1;

    expect(computeBackoffDelay(1, {}, minJitter)).toBe(3200); // 4000 * 0.8
    expect(computeBackoffDelay(1, {}, maxJitter)).toBe(4800); // 4000 * 1.2
  });
});
