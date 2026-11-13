// src/db/repositories/household.ts
// Repository for household and member records.

import { eq } from 'drizzle-orm';
import { db } from '../client';
import {
  households,
  members,
  lists,
  items,
  outbox,
  syncState,
  type Household,
  type Member,
} from '../schema';
import { tryCatch, type Result } from '../../api/errors';

export interface SaveHouseholdParams {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: number;
}

export async function saveHousehold(params: SaveHouseholdParams): Promise<Result<Household>> {
  return tryCatch(async () => {
    db.insert(households)
      .values({
        id: params.id,
        name: params.name,
        inviteCode: params.inviteCode,
        createdAt: params.createdAt,
      })
      .onConflictDoUpdate({
        target: households.id,
        set: {
          name: params.name,
          inviteCode: params.inviteCode,
        },
      })
      .run();

    const result = db.select().from(households).where(eq(households.id, params.id)).get();
    if (!result) throw new Error('Failed to save household');
    return result;
  });
}

export async function getHousehold(): Promise<Result<Household | null>> {
  return tryCatch(async () => {
    const list = db.select().from(households).all();
    return list.length > 0 ? list[0] : null;
  });
}

export interface SaveMemberParams {
  id: string;
  householdId: string;
  displayName: string;
}

export async function saveMembers(memberList: SaveMemberParams[]): Promise<Result<void>> {
  return tryCatch(async () => {
    db.transaction((tx) => {
      for (const m of memberList) {
        tx.insert(members)
          .values({
            id: m.id,
            householdId: m.householdId,
            displayName: m.displayName,
          })
          .onConflictDoUpdate({
            target: members.id,
            set: {
              displayName: m.displayName,
            },
          })
          .run();
      }
    });
  });
}

export async function getMembers(householdId: string): Promise<Result<Member[]>> {
  return tryCatch(async () => {
    return db.select().from(members).where(eq(members.householdId, householdId)).all();
  });
}

/**
 * Wipes local data on leaving a household or explicit sign-out.
 */
export async function clearHouseholdData(): Promise<Result<void>> {
  return tryCatch(async () => {
    db.transaction((tx) => {
      tx.delete(items).run();
      tx.delete(lists).run();
      tx.delete(members).run();
      tx.delete(households).run();
      tx.delete(outbox).run();
      tx.delete(syncState).run();
    });
  });
}
