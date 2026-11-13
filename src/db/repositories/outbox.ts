// src/db/repositories/outbox.ts
// Outbox repository for reading and managing queued sync operations.

import { eq, and, lte } from 'drizzle-orm';
import { db } from '../client';
import { outbox, type OutboxRow } from '../schema';
import { tryCatch, type Result } from '../../api/errors';
import { now } from '../../lib/clock';

export async function getPendingOps(currentTime: number = now()): Promise<Result<OutboxRow[]>> {
  return tryCatch(async () => {
    return db
      .select()
      .from(outbox)
      .where(and(eq(outbox.status, 'pending'), lte(outbox.nextAttemptAt, currentTime)))
      .all();
  });
}

export async function getParkedOps(): Promise<Result<OutboxRow[]>> {
  return tryCatch(async () => {
    return db.select().from(outbox).where(eq(outbox.status, 'parked')).all();
  });
}

export async function getAllPendingCount(): Promise<number> {
  try {
    const rows = db.select().from(outbox).where(eq(outbox.status, 'pending')).all();
    return rows.length;
  } catch {
    return 0;
  }
}

export async function getParkedCount(): Promise<number> {
  try {
    const rows = db.select().from(outbox).where(eq(outbox.status, 'parked')).all();
    return rows.length;
  } catch {
    return 0;
  }
}

export async function markOpSuccess(originalSeqs: number[]): Promise<Result<void>> {
  return tryCatch(async () => {
    for (const seq of originalSeqs) {
      db.delete(outbox).where(eq(outbox.seq, seq)).run();
    }
  });
}

export async function markOpRetryableFailure(
  seq: number,
  attempts: number,
  nextAttemptAt: number,
  errorMessage: string
): Promise<Result<void>> {
  return tryCatch(async () => {
    db.update(outbox)
      .set({
        attempts,
        nextAttemptAt,
        lastError: errorMessage,
      })
      .where(eq(outbox.seq, seq))
      .run();
  });
}

export async function markOpParked(seq: number, errorMessage: string): Promise<Result<void>> {
  return tryCatch(async () => {
    db.update(outbox)
      .set({
        status: 'parked',
        lastError: errorMessage,
      })
      .where(eq(outbox.seq, seq))
      .run();
  });
}

export async function parkDependentChildOps(parentEntityId: string): Promise<Result<void>> {
  return tryCatch(async () => {
    // If a list is parked, park its items' pending ops
    const rows = db.select().from(outbox).where(eq(outbox.status, 'pending')).all();
    for (const row of rows) {
      if (row.entity === 'item') {
        try {
          const payload = JSON.parse(row.payload);
          if (payload.listId === parentEntityId || payload.list === parentEntityId) {
            db.update(outbox)
              .set({
                status: 'parked',
                lastError: `Parent list ${parentEntityId} is parked`,
              })
              .where(eq(outbox.seq, row.seq))
              .run();
          }
        } catch {
          // Ignore JSON parse errors for payload check
        }
      }
    }
  });
}

export async function discardOp(seq: number): Promise<Result<void>> {
  return tryCatch(async () => {
    db.delete(outbox).where(eq(outbox.seq, seq)).run();
  });
}

export async function retryOp(seq: number): Promise<Result<void>> {
  return tryCatch(async () => {
    db.update(outbox)
      .set({
        status: 'pending',
        attempts: 0,
        nextAttemptAt: 0,
        lastError: null,
      })
      .where(eq(outbox.seq, seq))
      .run();
  });
}
