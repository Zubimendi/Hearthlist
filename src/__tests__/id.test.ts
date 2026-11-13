import { newId } from '../lib/id';

describe('newId', () => {
  it('generates 15-character lowercase alphanumeric IDs', () => {
    const id = newId();
    expect(id).toHaveLength(15);
    expect(id).toMatch(/^[0-9a-z]{15}$/);
  });

  it('generates unique IDs across 1,000 invocations', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = newId();
      expect(set.has(id)).toBe(false);
      set.add(id);
    }
    expect(set.size).toBe(1000);
  });
});
