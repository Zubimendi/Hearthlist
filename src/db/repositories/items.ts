// src/db/repositories/items.ts
// Repository for grocery items. Writes are atomic (item update + outbox insert).
// Content changes bump content_at; state changes (check, delete) bump state_at.

import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../client';
import { items, outbox, type Item, type ItemInsert } from '../schema';
import { tryCatch, type Result } from '../../api/errors';
import { newId } from '../../lib/id';
import { now } from '../../lib/clock';

export interface CreateItemParams {
  listId: string;
  householdId: string;
  name: string;
  quantity?: number;
  unit?: string;
  note?: string;
  category?: string;
  createdBy: string;
}

export async function createItem(params: CreateItemParams): Promise<Result<Item>> {
  return tryCatch(async () => {
    const id = newId();
    const timestamp = now();

    const newItem: ItemInsert = {
      id,
      listId: params.listId,
      householdId: params.householdId,
      name: params.name.trim(),
      quantity: params.quantity ?? null,
      unit: params.unit?.trim() || null,
      note: params.note?.trim() || null,
      category: params.category || 'Other',
      contentAt: timestamp,
      checked: false,
      checkedBy: null,
      checkedAt: null,
      deletedAt: null,
      stateAt: timestamp,
      createdBy: params.createdBy,
      createdAt: timestamp,
    };

    db.transaction((tx) => {
      tx.insert(items).values(newItem).run();
      tx.insert(outbox)
        .values({
          entity: 'item',
          entityId: id,
          op: 'create',
          payload: JSON.stringify({
            id,
            list: params.listId,
            household: params.householdId,
            name: newItem.name,
            quantity: newItem.quantity,
            unit: newItem.unit,
            note: newItem.note,
            category: newItem.category,
            checked: false,
            checked_by: null,
            checked_at: null,
            deleted_at: null,
            content_at: timestamp,
            state_at: timestamp,
            created_by: params.createdBy,
          }),
          attempts: 0,
          nextAttemptAt: 0,
          status: 'pending',
          createdAt: timestamp,
        })
        .run();
    });

    const inserted = db.select().from(items).where(eq(items.id, id)).get();
    if (!inserted) throw new Error('Item creation failed');
    return inserted;
  });
}

export interface UpdateItemContentParams {
  id: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  category?: string;
}

export async function updateItemContent(params: UpdateItemContentParams): Promise<Result<Item>> {
  return tryCatch(async () => {
    const timestamp = now();
    const cleanName = params.name.trim();

    db.transaction((tx) => {
      tx.update(items)
        .set({
          name: cleanName,
          quantity: params.quantity ?? null,
          unit: params.unit ?? null,
          note: params.note ?? null,
          category: params.category || 'Other',
          contentAt: timestamp,
        })
        .where(eq(items.id, params.id))
        .run();

      tx.insert(outbox)
        .values({
          entity: 'item',
          entityId: params.id,
          op: 'update',
          payload: JSON.stringify({
            name: cleanName,
            quantity: params.quantity ?? null,
            unit: params.unit ?? null,
            note: params.note ?? null,
            category: params.category || 'Other',
            content_at: timestamp,
          }),
          attempts: 0,
          nextAttemptAt: 0,
          status: 'pending',
          createdAt: timestamp,
        })
        .run();
    });

    const updated = db.select().from(items).where(eq(items.id, params.id)).get();
    if (!updated) throw new Error('Item not found');
    return updated;
  });
}

export interface ToggleItemParams {
  id: string;
  checked: boolean;
  checkedBy?: string | null;
}

export async function toggleItemChecked(params: ToggleItemParams): Promise<Result<Item>> {
  return tryCatch(async () => {
    const timestamp = now();
    const checkedAt = params.checked ? timestamp : null;
    const checkedBy = params.checked ? (params.checkedBy ?? null) : null;

    db.transaction((tx) => {
      tx.update(items)
        .set({
          checked: params.checked,
          checkedAt,
          checkedBy,
          stateAt: timestamp,
        })
        .where(eq(items.id, params.id))
        .run();

      tx.insert(outbox)
        .values({
          entity: 'item',
          entityId: params.id,
          op: 'update',
          payload: JSON.stringify({
            checked: params.checked,
            checked_at: checkedAt,
            checked_by: checkedBy,
            state_at: timestamp,
          }),
          attempts: 0,
          nextAttemptAt: 0,
          status: 'pending',
          createdAt: timestamp,
        })
        .run();
    });

    const updated = db.select().from(items).where(eq(items.id, params.id)).get();
    if (!updated) throw new Error('Item not found');
    return updated;
  });
}

export async function deleteItem(id: string): Promise<Result<void>> {
  return tryCatch(async () => {
    const timestamp = now();

    db.transaction((tx) => {
      tx.update(items)
        .set({
          deletedAt: timestamp,
          stateAt: timestamp,
        })
        .where(eq(items.id, id))
        .run();

      tx.insert(outbox)
        .values({
          entity: 'item',
          entityId: id,
          op: 'delete',
          payload: JSON.stringify({
            deleted_at: timestamp,
            state_at: timestamp,
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

export async function undoDeleteItem(id: string): Promise<Result<Item>> {
  return tryCatch(async () => {
    const timestamp = now();

    db.transaction((tx) => {
      tx.update(items)
        .set({
          deletedAt: null,
          stateAt: timestamp,
        })
        .where(eq(items.id, id))
        .run();

      tx.insert(outbox)
        .values({
          entity: 'item',
          entityId: id,
          op: 'update',
          payload: JSON.stringify({
            deleted_at: null,
            state_at: timestamp,
          }),
          attempts: 0,
          nextAttemptAt: 0,
          status: 'pending',
          createdAt: timestamp,
        })
        .run();
    });

    const restored = db.select().from(items).where(eq(items.id, id)).get();
    if (!restored) throw new Error('Item not found');
    return restored;
  });
}

export async function clearDoneItems(listId: string): Promise<Result<string[]>> {
  return tryCatch(async () => {
    const timestamp = now();
    const doneItems = db
      .select()
      .from(items)
      .where(and(eq(items.listId, listId), eq(items.checked, true), isNull(items.deletedAt)))
      .all();

    const ids = doneItems.map((i) => i.id);

    db.transaction((tx) => {
      for (const id of ids) {
        tx.update(items)
          .set({
            deletedAt: timestamp,
            stateAt: timestamp,
          })
          .where(eq(items.id, id))
          .run();

        tx.insert(outbox)
          .values({
            entity: 'item',
            entityId: id,
            op: 'delete',
            payload: JSON.stringify({
              deleted_at: timestamp,
              state_at: timestamp,
            }),
            attempts: 0,
            nextAttemptAt: 0,
            status: 'pending',
            createdAt: timestamp,
          })
          .run();
      }
    });

    return ids;
  });
}

export async function getItemsByList(listId: string): Promise<Result<Item[]>> {
  return tryCatch(async () => {
    return db
      .select()
      .from(items)
      .where(and(eq(items.listId, listId), isNull(items.deletedAt)))
      .all();
  });
}

export async function getItemById(id: string): Promise<Result<Item | null>> {
  return tryCatch(async () => {
    const item = db.select().from(items).where(eq(items.id, id)).get();
    return item || null;
  });
}
