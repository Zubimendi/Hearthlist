import {
  shouldMergeServerRecord,
  mapServerItemToLocal,
  mapServerListToLocal,
} from '../sync/merge';

describe('merge rules', () => {
  it('skips server record if local outbox has pending ops for entity', () => {
    const shouldMerge = shouldMergeServerRecord({
      entityId: 'item-1',
      hasPendingOutbox: true,
    });
    expect(shouldMerge).toBe(false);
  });

  it('allows merge if entity has no pending outbox ops', () => {
    const shouldMerge = shouldMergeServerRecord({
      entityId: 'item-1',
      hasPendingOutbox: false,
    });
    expect(shouldMerge).toBe(true);
  });

  it('correctly maps PocketBase item to local schema format', () => {
    const pbRecord = {
      id: 'abc123456789012',
      list: 'list12345678901',
      household: 'hh1234567890123',
      name: 'Yam',
      quantity: 3,
      unit: 'tubers',
      note: 'Large ones',
      category: 'Produce',
      checked: true,
      checked_by: 'user1',
      checked_at: 1700000000,
      content_at: 1699999000,
      state_at: 1700000000,
      deleted_at: null,
      created_by: 'user1',
      created_at: 1699990000,
    };

    const local = mapServerItemToLocal(pbRecord);
    expect(local.id).toBe('abc123456789012');
    expect(local.listId).toBe('list12345678901');
    expect(local.householdId).toBe('hh1234567890123');
    expect(local.name).toBe('Yam');
    expect(local.quantity).toBe(3);
    expect(local.unit).toBe('tubers');
    expect(local.checked).toBe(true);
  });

  it('correctly maps PocketBase list to local schema format', () => {
    const pbList = {
      id: 'list12345678901',
      household: 'hh1234567890123',
      name: 'Weekend Market',
      sort_order: 1.5,
      archived: false,
      created_by: 'user1',
      created_at: 1699990000,
      client_updated_at: 1699995000,
      deleted_at: null,
    };

    const local = mapServerListToLocal(pbList);
    expect(local.id).toBe('list12345678901');
    expect(local.name).toBe('Weekend Market');
    expect(local.updatedAt).toBe(1699995000);
    expect(local.archived).toBe(false);
  });
});
