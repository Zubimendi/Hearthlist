// src/sync/outbox.ts
// Outbox coalescing and queue operations

import type { OutboxRow } from '../db/schema';

export interface CoalescedOp {
  entity: 'list' | 'item';
  entityId: string;
  op: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  originalSeqs: number[];
  status: 'pending' | 'parked';
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: number;
}

/**
 * Coalesces raw outbox records for a batch:
 * 1. Groups by entity:entityId
 * 2. Applies state transitions:
 *    - create + updates => create with merged final payload
 *    - updates + updates => merged update payload (latest field values)
 *    - create + delete => drops both (neither needs to go to server)
 *    - update + delete => single delete
 *    - delete + undo (treated as re-create/update)
 * 3. Preserves ordering: lists before items, then by lowest seq.
 */
export function coalesceOutbox(rows: OutboxRow[]): CoalescedOp[] {
  // Group rows preserving sequence
  const groups = new Map<string, OutboxRow[]>();

  for (const row of rows) {
    const key = `${row.entity}:${row.entityId}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const result: CoalescedOp[] = [];

  for (const [, entityRows] of groups) {
    if (entityRows.length === 0) continue;

    // Sort by seq ascending
    entityRows.sort((a, b) => a.seq - b.seq);

    let currentOp: 'create' | 'update' | 'delete' | null = null;
    let mergedPayload: Record<string, unknown> = {};
    const originalSeqs: number[] = [];
    let status: 'pending' | 'parked' = 'pending';
    let attempts = 0;
    let nextAttemptAt = 0;
    let lastError: string | null = null;
    const createdAt = entityRows[0].createdAt;
    const entity = entityRows[0].entity;
    const entityId = entityRows[0].entityId;

    for (const r of entityRows) {
      originalSeqs.push(r.seq);
      if (r.status === 'parked') status = 'parked';
      attempts = Math.max(attempts, r.attempts);
      nextAttemptAt = Math.max(nextAttemptAt, r.nextAttemptAt);
      if (r.lastError) lastError = r.lastError;

      let parsedPayload: Record<string, unknown> = {};
      try {
        parsedPayload = JSON.parse(r.payload);
      } catch {
        parsedPayload = {};
      }

      if (currentOp === null) {
        currentOp = r.op;
        mergedPayload = { ...parsedPayload };
      } else if (currentOp === 'create') {
        if (r.op === 'update') {
          // Merge updates into create
          mergedPayload = { ...mergedPayload, ...parsedPayload };
        } else if (r.op === 'delete') {
          // create then delete => drop both
          currentOp = null;
          mergedPayload = {};
        }
      } else if (currentOp === 'update') {
        if (r.op === 'update') {
          // Merge consecutive updates
          mergedPayload = { ...mergedPayload, ...parsedPayload };
        } else if (r.op === 'delete') {
          // update then delete => becomes delete
          currentOp = 'delete';
          mergedPayload = { ...parsedPayload };
        }
      } else if (currentOp === 'delete') {
        if (r.op === 'create' || r.op === 'update') {
          // Undo / recreate after delete
          currentOp = r.op;
          mergedPayload = { ...parsedPayload };
        }
      }
    }

    if (currentOp !== null) {
      result.push({
        entity,
        entityId,
        op: currentOp,
        payload: mergedPayload,
        originalSeqs,
        status,
        attempts,
        nextAttemptAt,
        lastError,
        createdAt,
      });
    }
  }

  // Order: lists before items, then by lowest seq
  result.sort((a, b) => {
    if (a.entity !== b.entity) {
      return a.entity === 'list' ? -1 : 1;
    }
    const minSeqA = Math.min(...a.originalSeqs);
    const minSeqB = Math.min(...b.originalSeqs);
    return minSeqA - minSeqB;
  });

  return result;
}
