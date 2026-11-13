// src/db/repositories/lists.ts
// Repository for grocery lists. Writes are atomic (list update + outbox insert).

import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../client';
import { lists, outbox, households, type List, type ListInsert } from '../schema';
import { tryCatch, type Result } from '../../api/errors';
import { newId } from '../../lib/id';
import { now } from '../../lib/clock';

export interface CreateListParams {
  householdId: string;
  name: string;
  createdBy: string;
  sortOrder?: number;
}

export async function createList(params: CreateListParams): Promise<Result<List>> {
  return tryCatch(async () => {
    const id = newId();
    const timestamp = now();

    // Ensure the household exists in SQLite to avoid FOREIGN KEY constraint error
    const existingHh = db.select().from(households).where(eq(households.id, params.householdId)).get();
    if (!existingHh) {
      const anyHh = db.select().from(households).get();
      if (anyHh) {
        params.householdId = anyHh.id;
      } else {
        db.insert(households)
          .values({
            id: params.householdId,
            name: 'Our Home',
            inviteCode: 'HEARTH',
            createdAt: timestamp,
          })
          .onConflictDoNothing()
          .run();
      }
    }

    const newList: ListInsert = {
      id,
      householdId: params.householdId,
      name: params.name.trim(),
      sortOrder: params.sortOrder ?? 0,
      archived: false,
      createdBy: params.createdBy,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    // One transaction: insert entity + insert outbox
    db.transaction((tx) => {
      tx.insert(lists).values(newList).run();
      tx.insert(outbox)
        .values({
          entity: 'list',
          entityId: id,
          op: 'create',
          payload: JSON.stringify({
            id,
            household: params.householdId,
            name: newList.name,
            sort_order: newList.sortOrder,
            archived: false,
            created_by: params.createdBy,
            client_updated_at: timestamp,
          }),
          attempts: 0,
          nextAttemptAt: 0,
          status: 'pending',
          createdAt: timestamp,
        })
        .run();
    });

    const inserted = db.select().from(lists).where(eq(lists.id, id)).get();
    if (!inserted) throw new Error('List creation failed');
    return inserted;
  });
}

export interface RenameListParams {
  id: string;
  name: string;
}

export async function renameList(params: RenameListParams): Promise<Result<List>> {
  return tryCatch(async () => {
    const timestamp = now();
    const cleanName = params.name.trim();

    db.transaction((tx) => {
      tx.update(lists)
        .set({
          name: cleanName,
          updatedAt: timestamp,
        })
        .where(eq(lists.id, params.id))
        .run();

      tx.insert(outbox)
        .values({
          entity: 'list',
          entityId: params.id,
          op: 'update',
          payload: JSON.stringify({
            name: cleanName,
            client_updated_at: timestamp,
          }),
          attempts: 0,
          nextAttemptAt: 0,
          status: 'pending',
          createdAt: timestamp,
        })
        .run();
    });

    const updated = db.select().from(lists).where(eq(lists.id, params.id)).get();
    if (!updated) throw new Error('List not found');
    return updated;
  });
}

export interface ArchiveListParams {
  id: string;
  archived: boolean;
}

export async function archiveList(params: ArchiveListParams): Promise<Result<List>> {
  return tryCatch(async () => {
    const timestamp = now();

    db.transaction((tx) => {
      tx.update(lists)
        .set({
          archived: params.archived,
          updatedAt: timestamp,
        })
        .where(eq(lists.id, params.id))
        .run();

      tx.insert(outbox)
        .values({
          entity: 'list',
          entityId: params.id,
          op: 'update',
          payload: JSON.stringify({
            archived: params.archived,
            client_updated_at: timestamp,
          }),
          attempts: 0,
          nextAttemptAt: 0,
          status: 'pending',
          createdAt: timestamp,
        })
        .run();
    });

    const updated = db.select().from(lists).where(eq(lists.id, params.id)).get();
    if (!updated) throw new Error('List not found');
    return updated;
  });
}

export async function deleteList(id: string): Promise<Result<void>> {
  return tryCatch(async () => {
    const timestamp = now();

    db.transaction((tx) => {
      tx.update(lists)
        .set({
          deletedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(lists.id, id))
        .run();

      tx.insert(outbox)
        .values({
          entity: 'list',
          entityId: id,
          op: 'delete',
          payload: JSON.stringify({
            deleted_at: timestamp,
            client_updated_at: timestamp,
          }),
          attempts: 0,
          nextAttemptAt: 0,
          status: 'pending',
          createdAt: timestamp,
        })
        .run();
    });
  });
}

export async function getLists(householdId: string): Promise<Result<List[]>> {
  return tryCatch(async () => {
    return db
      .select()
      .from(lists)
      .where(and(eq(lists.householdId, householdId), isNull(lists.deletedAt)))
      .all();
  });
}

export async function getListById(id: string): Promise<Result<List | null>> {
  return tryCatch(async () => {
    const list = db.select().from(lists).where(eq(lists.id, id)).get();
    return list || null;
  });
}
