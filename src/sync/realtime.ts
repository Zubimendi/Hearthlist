// src/sync/realtime.ts
// PocketBase Realtime SSE subscription for lists and items.

import { pb } from '../api/pb';
import { db } from '../db/client';
import { lists, items, outbox } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  shouldMergeServerRecord,
  mapServerItemToLocal,
  mapServerListToLocal,
} from './merge';
import { logger } from '../lib/logger';

let isSubscribed = false;

export async function subscribeRealtime(): Promise<() => void> {
  if (isSubscribed) {
    return () => {};
  }

  try {
    // 1. Subscribe to lists collection
    await pb.collection('lists').subscribe('*', (e) => {
      handleListEvent(e.action, e.record as unknown as Record<string, unknown>);
    });

    // 2. Subscribe to items collection
    await pb.collection('items').subscribe('*', (e) => {
      handleItemEvent(e.action, e.record as unknown as Record<string, unknown>);
    });

    isSubscribed = true;
    logger.breadcrumb('realtime:subscribed');
  } catch (err) {
    logger.warn('realtime:subscribe_failed', { error: String(err) });
  }

  return () => {
    unsubscribeRealtime();
  };
}

export async function unsubscribeRealtime(): Promise<void> {
  try {
    await pb.collection('lists').unsubscribe('*');
    await pb.collection('items').unsubscribe('*');
    isSubscribed = false;
    logger.breadcrumb('realtime:unsubscribed');
  } catch (err) {
    logger.warn('realtime:unsubscribe_failed', { error: String(err) });
  }
}

function handleListEvent(action: string, record: Record<string, unknown>): void {
  try {
    const listId = record.id as string;
    const pendingOps = db
      .select()
      .from(outbox)
      .where(eq(outbox.entityId, listId))
      .all();

    if (!shouldMergeServerRecord({ entityId: listId, hasPendingOutbox: pendingOps.length > 0 })) {
      return;
    }

    const local = mapServerListToLocal(record);

    if (action === 'delete') {
      db.update(lists)
        .set({ deletedAt: Date.now() })
        .where(eq(lists.id, listId))
        .run();
    } else {
      db.insert(lists)
        .values({
          id: local.id as string,
          householdId: local.householdId as string,
          name: local.name as string,
          sortOrder: local.sortOrder as number,
          archived: local.archived as boolean,
          createdBy: local.createdBy as string,
          createdAt: local.createdAt as number,
          updatedAt: local.updatedAt as number,
          deletedAt: (local.deletedAt as number) || null,
        })
        .onConflictDoUpdate({
          target: lists.id,
          set: {
            name: local.name as string,
            sortOrder: local.sortOrder as number,
            archived: local.archived as boolean,
            updatedAt: local.updatedAt as number,
            deletedAt: (local.deletedAt as number) || null,
          },
        })
        .run();
    }
  } catch (err) {
    logger.warn('handleListEvent:failed', { error: String(err) });
  }
}

function handleItemEvent(action: string, record: Record<string, unknown>): void {
  try {
    const itemId = record.id as string;
    const pendingOps = db
      .select()
      .from(outbox)
      .where(eq(outbox.entityId, itemId))
      .all();

    if (!shouldMergeServerRecord({ entityId: itemId, hasPendingOutbox: pendingOps.length > 0 })) {
      return;
    }

    const local = mapServerItemToLocal(record);

    if (action === 'delete') {
      db.update(items)
        .set({ deletedAt: Date.now() })
        .where(eq(items.id, itemId))
        .run();
    } else {
      db.insert(items)
        .values({
          id: local.id as string,
          listId: local.listId as string,
          householdId: local.householdId as string,
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
          createdBy: local.createdBy as string,
          createdAt: local.createdAt as number,
        })
        .onConflictDoUpdate({
          target: items.id,
          set: {
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
          },
        })
        .run();
    }
  } catch (err) {
    logger.warn('handleItemEvent:failed', { error: String(err) });
  }
}
