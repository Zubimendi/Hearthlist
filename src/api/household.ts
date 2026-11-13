// src/api/household.ts
// Household management calling custom PocketBase endpoints.

import { pb } from './pb';
import { tryCatch, type Result } from './errors';
import { saveHousehold, saveMembers } from '../db/repositories/household';

export interface HouseholdResponse {
  id: string;
  name: string;
  inviteCode: string;
}

interface RawHouseholdPayload {
  id: string;
  name: string;
  invite_code?: string;
  inviteCode?: string;
}

export async function createHousehold(name: string): Promise<Result<HouseholdResponse>> {
  return tryCatch(async () => {
    const res = await pb.send<RawHouseholdPayload>('/api/hearthlist/households', {
      method: 'POST',
      body: { name: name.trim() },
    });

    const inviteCode = res.inviteCode || res.invite_code || '';
    const household: HouseholdResponse = {
      id: res.id,
      name: res.name,
      inviteCode,
    };

    // Cache locally in SQLite
    await saveHousehold({
      id: household.id,
      name: household.name,
      inviteCode,
      createdAt: Date.now(),
    });

    return household;
  });
}

export async function joinHousehold(code: string): Promise<Result<HouseholdResponse>> {
  return tryCatch(async () => {
    const res = await pb.send<RawHouseholdPayload>('/api/hearthlist/join', {
      method: 'POST',
      body: { code: code.trim().toUpperCase() },
    });

    const inviteCode = res.inviteCode || res.invite_code || code.trim().toUpperCase();
    const household: HouseholdResponse = {
      id: res.id,
      name: res.name,
      inviteCode,
    };

    // Cache locally in SQLite
    await saveHousehold({
      id: household.id,
      name: household.name,
      inviteCode,
      createdAt: Date.now(),
    });

    return household;
  });
}

export interface MemberResponse {
  id: string;
  displayName: string;
}

export async function fetchHouseholdMembers(householdId: string): Promise<Result<MemberResponse[]>> {
  return tryCatch(async () => {
    const records = await pb.collection('users').getFullList({
      filter: `household = "${householdId}"`,
    });

    const members = records.map((r) => {
      const rec = r as unknown as Record<string, unknown>;
      return {
        id: r.id,
        displayName: String(rec.display_name || rec.name || 'Household member'),
      };
    });

    await saveMembers(
      members.map((m) => ({
        id: m.id,
        householdId,
        displayName: m.displayName,
      }))
    );

    return members;
  });
}
