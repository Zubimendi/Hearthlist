// src/sync/merge.ts
// Pure merge logic for pull and realtime events

export interface MergeEntityRecord {
  id: string;
  [key: string]: unknown;
}

export interface MergeCheckParams {
  entityId: string;
  hasPendingOutbox: boolean;
}

/**
 * Determines whether a server record should be merged into local state.
 * Rule: If the entity has ANY pending outbox op, skip it — push response or
 * next pull will converge it.
 */
export function shouldMergeServerRecord(params: MergeCheckParams): boolean {
  if (params.hasPendingOutbox) {
    return false;
  }
  return true;
}

/**
 * Converts PocketBase record format to SQLite format for items.
 */
export function mapServerItemToLocal(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    listId: record.list || record.listId,
    householdId: record.household || record.householdId,
    name: record.name,
    quantity: record.quantity !== undefined ? record.quantity : null,
    unit: record.unit || null,
    note: record.note || null,
    category: record.category || 'other',
    contentAt: Number(record.content_at || record.contentAt || Date.now()),
    checked: Boolean(record.checked),
    checkedBy: record.checked_by || record.checkedBy || null,
    checkedAt: record.checked_at !== undefined ? Number(record.checked_at) : null,
    deletedAt: record.deleted_at !== undefined ? Number(record.deleted_at) : null,
    stateAt: Number(record.state_at || record.stateAt || Date.now()),
    createdBy: record.created_by || record.createdBy || '',
    createdAt: Number(record.created_at || record.createdAt || Date.now()),
  };
}

/**
 * Converts PocketBase record format to SQLite format for lists.
 */
export function mapServerListToLocal(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    householdId: record.household || record.householdId,
    name: record.name,
    sortOrder: record.sort_order !== undefined ? Number(record.sort_order) : 0,
    archived: Boolean(record.archived),
    createdBy: record.created_by || record.createdBy || '',
    createdAt: Number(record.created_at || record.createdAt || Date.now()),
    updatedAt: Number(record.client_updated_at || record.updatedAt || Date.now()),
    deletedAt: record.deleted_at !== undefined ? Number(record.deleted_at) : null,
  };
}
