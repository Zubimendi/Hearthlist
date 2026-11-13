// src/api/auth.ts
// Authentication operations against PocketBase.
// Session tokens are handled securely via AsyncAuthStore in pb.ts.

import { pb } from './pb';
import { tryCatch, type Result } from './errors';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  householdId?: string | null;
}

export interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
}

export async function signUp(params: SignUpParams): Promise<Result<UserProfile>> {
  return tryCatch(async () => {
    // 1. Create user record
    await pb.collection('users').create({
      email: params.email.trim(),
      password: params.password,
      passwordConfirm: params.password,
      display_name: params.displayName.trim(),
    });

    // 2. Authenticate
    const authData = await pb
      .collection('users')
      .authWithPassword(params.email.trim(), params.password);

    const rec = authData.record as unknown as Record<string, unknown>;

    return {
      id: authData.record.id,
      email: String(rec.email || params.email.trim()),
      displayName: String(rec.display_name || params.displayName.trim()),
      householdId: rec.household ? String(rec.household) : null,
    };
  });
}

export interface SignInParams {
  email: string;
  password: string;
}

export async function signIn(params: SignInParams): Promise<Result<UserProfile>> {
  return tryCatch(async () => {
    const authData = await pb
      .collection('users')
      .authWithPassword(params.email.trim(), params.password);

    const rec = authData.record as unknown as Record<string, unknown>;

    return {
      id: authData.record.id,
      email: String(rec.email || params.email.trim()),
      displayName: String(rec.display_name || ''),
      householdId: rec.household ? String(rec.household) : null,
    };
  });
}

export async function refreshAuth(): Promise<Result<UserProfile>> {
  return tryCatch(async () => {
    const authData = await pb.collection('users').authRefresh();
    const rec = authData.record as unknown as Record<string, unknown>;

    return {
      id: authData.record.id,
      email: String(rec.email || ''),
      displayName: String(rec.display_name || ''),
      householdId: rec.household ? String(rec.household) : null,
    };
  });
}

export async function signOut(): Promise<Result<void>> {
  return tryCatch(async () => {
    pb.authStore.clear();
  });
}

export function getCurrentUser(): UserProfile | null {
  const model = pb.authStore.model;
  if (!model || !pb.authStore.isValid) return null;

  const rec = model as unknown as Record<string, unknown>;
  return {
    id: model.id,
    email: String(rec.email || ''),
    displayName: String(rec.display_name || ''),
    householdId: rec.household ? String(rec.household) : null,
  };
}

export function isAuthenticated(): boolean {
  return pb.authStore.isValid;
}
