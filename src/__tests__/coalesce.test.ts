import { coalesceOutbox } from '../sync/outbox';
import type { OutboxRow } from '../db/schema';

describe('coalesceOutbox', () => {
  const baseRow = (partial: Partial<OutboxRow>): OutboxRow => ({
    seq: 1,
    entity: 'item',
    entityId: 'item-1',
    op: 'create',
    payload: '{}',
    attempts: 0,
    nextAttemptAt: 0,
    status: 'pending',
    lastError: null,
    createdAt: 1000,
    ...partial,
  });

  it('coalesces create then updates into one create with final state', () => {
    const rows: OutboxRow[] = [
      baseRow({ seq: 1, op: 'create', payload: JSON.stringify({ name: 'Rice', quantity: 1 }) }),
      baseRow({ seq: 2, op: 'update', payload: JSON.stringify({ quantity: 2 }) }),
      baseRow({ seq: 3, op: 'update', payload: JSON.stringify({ note: 'Ofada' }) }),
    ];

    const result = coalesceOutbox(rows);
    expect(result).toHaveLength(1);
    expect(result[0].op).toBe('create');
    expect(result[0].payload).toEqual({
      name: 'Rice',
      quantity: 2,
      note: 'Ofada',
    });
    expect(result[0].originalSeqs).toEqual([1, 2, 3]);
  });

  it('coalesces consecutive updates into one update', () => {
    const rows: OutboxRow[] = [
      baseRow({ seq: 10, op: 'update', payload: JSON.stringify({ checked: true, checkedAt: 1234 }) }),
      baseRow({ seq: 11, op: 'update', payload: JSON.stringify({ checked: false, checkedAt: null }) }),
    ];

    const result = coalesceOutbox(rows);
    expect(result).toHaveLength(1);
    expect(result[0].op).toBe('update');
    expect(result[0].payload).toEqual({
      checked: false,
      checkedAt: null,
    });
  });

  it('drops both create and delete for unsynced entity', () => {
    const rows: OutboxRow[] = [
      baseRow({ seq: 1, op: 'create', payload: JSON.stringify({ name: 'Milk' }) }),
      baseRow({ seq: 2, op: 'delete', payload: JSON.stringify({ deletedAt: 2000 }) }),
    ];

    const result = coalesceOutbox(rows);
    expect(result).toHaveLength(0);
  });

  it('turns update then delete into a single delete', () => {
    const rows: OutboxRow[] = [
      baseRow({ seq: 1, op: 'update', payload: JSON.stringify({ name: 'Milk 2L' }) }),
      baseRow({ seq: 2, op: 'delete', payload: JSON.stringify({ deletedAt: 3000 }) }),
    ];

    const result = coalesceOutbox(rows);
    expect(result).toHaveLength(1);
    expect(result[0].op).toBe('delete');
    expect(result[0].payload).toEqual({ deletedAt: 3000 });
  });

  it('orders lists before items', () => {
    const rows: OutboxRow[] = [
      baseRow({ seq: 1, entity: 'item', entityId: 'i1', op: 'create', payload: '{}' }),
      baseRow({ seq: 2, entity: 'list', entityId: 'l1', op: 'create', payload: '{}' }),
    ];

    const result = coalesceOutbox(rows);
    expect(result).toHaveLength(2);
    expect(result[0].entity).toBe('list');
    expect(result[1].entity).toBe('item');
  });
});
