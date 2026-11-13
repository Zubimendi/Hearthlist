// src/sync/pull.ts
// Cursor-based pull sync from PocketBase to local SQLite.

import { pb } from '../api/pb';
import { db } from '../db/client';
import { lists, items, syncState, outbox } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  shouldMergeServerRecord,
  mapServerItemToLocal,
  mapServerListToLocal,
} from './merge';
import { logger } from '../lib/logger';

const PAGE_SIZE = 200;

export interface PullStats {
  listsUpdated: number;
  itemsUpdated: number;
}

export async function pullChanges(): Promise<PullStats> {
  const stats: PullStats = { listsUpdated: 0, itemsUpdated: 0 };

  try {
    // 1. Pull lists first (parents before items)
    stats.listsUpdated = await pullCollection('lists', async (record, hasPending) => {
      const recordId = String(record.id);
      if (!shouldMergeServerRecord({ entityId: recordId, hasPendingOutbox: hasPending })) {
        return;
      }
      const local = mapServerListToLocal(record);
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
    });

    // 2. Pull items
    stats.itemsUpdated = await pullCollection('items', async (record, hasPending) => {
      const recordId = String(record.id);
      if (!shouldMergeServerRecord({ entityId: recordId, hasPendingOutbox: hasPending })) {
        return;
      }
      const local = mapServerItemToLocal(record);
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
    });

    logger.breadcrumb('pullChanges:completed', {
      listsUpdated: stats.listsUpdated,
      itemsUpdated: stats.itemsUpdated,
    });
  } catch (err) {
    logger.warn('pullChanges:failed', { error: String(err) });
  }

  return stats;
}

async function pullCollection(
  collectionName: 'lists' | 'items',
  applyFn: (record: Record<string, unknown>, hasPending: boolean) => Promise<void>
): Promise<number> {
  const cursorKey = `cursor:${collectionName}`;
  const cursorRow = db.select().from(syncState).where(eq(syncState.key, cursorKey)).get();
  const cursor = cursorRow ? Number(cursorRow.value) : 0;

  let page = 1;
  let totalProcessed = 0;
  let latestTimestamp = cursor;

  while (true) {
    const queryOptions: Record<string, string | number> = {
      sort: collectionName === 'lists' ? 'client_updated_at,id' : 'content_at,id',
    };

    if (cursor > 0) {
      if (collectionName === 'lists') {
        queryOptions.filter = `client_updated_at >= ${cursor}`;
      } else {
        queryOptions.filter = `content_at >= ${cursor} || state_at >= ${cursor}`;
      }
    }

    const result = await pb.collection(collectionName).getList(page, PAGE_SIZE, queryOptions);

    if (result.items.length === 0) break;

    const pendingOps = db.select().from(outbox).where(eq(outbox.status, 'pending')).all();
    const pendingEntityIds = new Set(pendingOps.map((o) => o.entityId));

    db.transaction((tx) => {
      for (const item of result.items) {
        const raw = item as unknown as Record<string, unknown>;
        const hasPending = pendingEntityIds.has(item.id);
        applyFn(raw, hasPending);

        const recTime =
          collectionName === 'lists'
            ? Number(raw.client_updated_at || 0)
            : Math.max(Number(raw.content_at || 0), Number(raw.state_at || 0));

        if (recTime > latestTimestamp) {
          latestTimestamp = recTime;
        }
      }

      if (latestTimestamp > 0) {
        tx.insert(syncState)
          .values({ key: cursorKey, value: String(latestTimestamp) })
          .onConflictDoUpdate({
            target: syncState.key,
            set: { value: String(latestTimestamp) },
          })
          .run();
      }
    });

    totalProcessed += result.items.length;
    if (page >= result.totalPages) break;
    page++;
  }

  return totalProcessed;
}
