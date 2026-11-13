// src/sync/push.ts
// Outbox push / drain execution with error classification and idempotency.

import { pb } from '../api/pb';
import { db } from '../db/client';
import { lists, items } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  getPendingOps,
  markOpSuccess,
  markOpRetryableFailure,
  markOpParked,
  parkDependentChildOps,
} from '../db/repositories/outbox';
import { coalesceOutbox, type CoalescedOp } from './outbox';
import { computeBackoffDelay } from './backoff';
import { mapServerItemToLocal, mapServerListToLocal } from './merge';
import { mapError } from '../api/errors';
import { logger } from '../lib/logger';
import { now } from '../lib/clock';

export interface DrainResult {
  processed: number;
  succeeded: number;
  parked: number;
  stoppedOnRetryable: boolean;
}

export async function drainOutbox(): Promise<DrainResult> {
  const result: DrainResult = {
    processed: 0,
    succeeded: 0,
    parked: 0,
    stoppedOnRetryable: false,
  };

  const pendingResult = await getPendingOps(now());
  if (!pendingResult.ok || pendingResult.value.length === 0) {
    return result;
  }

  const coalesced = coalesceOutbox(pendingResult.value);
  logger.breadcrumb('drainOutbox:starting', { count: coalesced.length });

  for (const op of coalesced) {
    result.processed++;
    const outcome = await executeOp(op);

    if (outcome.status === 'success') {
      result.succeeded++;
      await markOpSuccess(op.originalSeqs);
    } else if (outcome.status === 'retryable') {
      result.stoppedOnRetryable = true;
      const nextDelay = computeBackoffDelay(op.attempts + 1);
      const nextAttemptAt = now() + nextDelay;

      // Update all originalSeqs with retry backoff
      for (const seq of op.originalSeqs) {
        await markOpRetryableFailure(
          seq,
          op.attempts + 1,
          nextAttemptAt,
          outcome.error.message
        );
      }

      logger.warn('drainOutbox:stopped_on_retryable', {
        entity: op.entity,
        id: op.entityId,
        delayMs: nextDelay,
      });

      // Crucial: STOP THE DRAIN on retryable error to preserve ordering
      break;
    } else if (outcome.status === 'parked') {
      result.parked++;
      for (const seq of op.originalSeqs) {
        await markOpParked(seq, outcome.error.message);
      }
      if (op.entity === 'list') {
        await parkDependentChildOps(op.entityId);
      }
      logger.error('drainOutbox:parked_op', {
        entity: op.entity,
        id: op.entityId,
        error: outcome.error.message,
      });
      // Continue with next op
    }
  }

  logger.breadcrumb('drainOutbox:completed', {
    processed: result.processed,
    succeeded: result.succeeded,
    parked: result.parked,
    stoppedOnRetryable: result.stoppedOnRetryable,
  });
  return result;
}

type OpOutcome =
  | { status: 'success' }
  | { status: 'retryable'; error: { message: string } }
  | { status: 'parked'; error: { message: string } };

async function executeOp(op: CoalescedOp): Promise<OpOutcome> {
  const collectionName = op.entity === 'list' ? 'lists' : 'items';

  try {
    if (op.op === 'create') {
      try {
        const created = await pb.collection(collectionName).create(op.payload);
        applyServerRecordLocally(op.entity, created as unknown as Record<string, unknown>);
      } catch (err: unknown) {
        const appErr = mapError(err);
        // Duplicate create (record exists): fetch with GET and treat as success
        const isDuplicate =
          appErr.class === 'validation' &&
          (String((err as { message?: string })?.message || '').toLowerCase().includes('already exists') ||
            (err as { status?: number })?.status === 400);

        if (isDuplicate) {
          try {
            const existing = await pb.collection(collectionName).getOne(op.entityId);
            applyServerRecordLocally(op.entity, existing as unknown as Record<string, unknown>);
            return { status: 'success' };
          } catch {
            return classifyError(err);
          }
        }
        return classifyError(err);
      }
    } else if (op.op === 'update') {
      try {
        const updated = await pb.collection(collectionName).update(op.entityId, op.payload);
        applyServerRecordLocally(op.entity, updated as unknown as Record<string, unknown>);
      } catch (err: unknown) {
        const appErr = mapError(err);
        // Conflict 409 stale write: GET record, apply locally, treat op as done
        if (appErr.class === 'conflict') {
          try {
            const serverRecord = await pb.collection(collectionName).getOne(op.entityId);
            applyServerRecordLocally(op.entity, serverRecord as unknown as Record<string, unknown>);
            return { status: 'success' };
          } catch {
            return classifyError(err);
          }
        }
        return classifyError(err);
      }
    } else if (op.op === 'delete') {
      try {
        // Soft delete via update on PocketBase
        const deleted = await pb.collection(collectionName).update(op.entityId, op.payload);
        applyServerRecordLocally(op.entity, deleted as unknown as Record<string, unknown>);
      } catch (err: unknown) {
        const appErr = mapError(err);
        // Delete 404: treat as success
        if (appErr.class === 'notFound') {
          return { status: 'success' };
        }
        return classifyError(err);
      }
    }

    return { status: 'success' };
  } catch (unexpected) {
    return classifyError(unexpected);
  }
}

function classifyError(raw: unknown): OpOutcome {
  const err = mapError(raw);
  if (err.class === 'network' || err.class === 'transient') {
    return { status: 'retryable', error: err };
  }
  return { status: 'parked', error: err };
}

function applyServerRecordLocally(entity: 'list' | 'item', record: Record<string, unknown>): void {
  try {
    if (entity === 'list') {
      const local = mapServerListToLocal(record);
      db.update(lists)
        .set({
          name: local.name as string,
          sortOrder: local.sortOrder as number,
          archived: local.archived as boolean,
          updatedAt: local.updatedAt as number,
          deletedAt: (local.deletedAt as number) || null,
        })
        .where(eq(lists.id, local.id as string))
        .run();
    } else {
      const local = mapServerItemToLocal(record);
      db.update(items)
        .set({
          name: local.name as string,
          quantity: (local.quantity as number) || null,
          unit: (local.unit as string) || null,
          note: (local.note as string) || null,
          category: local.category as string,
          contentAt: local.contentAt as number,
          checked: local.checked as boolean,
          checkedBy: (local.checkedBy as string) || null,
          checkedAt: (local.checkedAt as number) || null,
          deletedAt: (local.deletedAt as number) || null,
          stateAt: local.stateAt as number,
        })
        .where(eq(items.id, local.id as string))
        .run();
    }
  } catch (e) {
    logger.warn('Failed to apply server record locally', { entity, error: String(e) });
  }
}
