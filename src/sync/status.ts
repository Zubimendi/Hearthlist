// src/sync/status.ts
// Sync status derivation based on network connectivity, engine activity, and outbox state.

export type SyncStatusType = 'offline' | 'syncing' | 'issue' | 'pending' | 'up_to_date';

export interface SyncStateSnapshot {
  isOnline: boolean;
  isDraining: boolean;
  isPulling: boolean;
  hasAuthIssue: boolean;
  parkedOpsCount: number;
  pendingOpsCount: number;
}

/**
 * Derives the high-level sync status according to architecture rules:
 * 1. Offline: NetInfo reports no connection
 * 2. Syncing: Engine drain or pull in progress
 * 3. Issue: Parked ops exist or auth needs renewal
 * 4. Pending: Pending ops exist and not syncing
 * 5. Up to date: None of the above
 */
export function deriveSyncStatus(state: SyncStateSnapshot): SyncStatusType {
  if (!state.isOnline) {
    return 'offline';
  }

  if (state.isDraining || state.isPulling) {
    return 'syncing';
  }

  if (state.hasAuthIssue || state.parkedOpsCount > 0) {
    return 'issue';
  }

  if (state.pendingOpsCount > 0) {
    return 'pending';
  }

  return 'up_to_date';
}

export interface SyncChipInfo {
  status: SyncStatusType;
  label: string;
  icon: string;
  colorToken: 'success' | 'warning' | 'danger' | 'textSecondary';
}

export function getSyncChipInfo(status: SyncStatusType, pendingCount = 0): SyncChipInfo {
  switch (status) {
    case 'up_to_date':
      return {
        status,
        label: 'Up to date',
        icon: 'checkmark-circle-outline',
        colorToken: 'success',
      };
    case 'syncing':
      return {
        status,
        label: 'Syncing',
        icon: 'sync-outline',
        colorToken: 'warning',
      };
    case 'pending':
      return {
        status,
        label: pendingCount === 1 ? '1 waiting' : `${pendingCount} waiting`,
        icon: 'cloud-upload-outline',
        colorToken: 'warning',
      };
    case 'offline':
      return {
        status,
        label: 'Offline',
        icon: 'cloud-offline-outline',
        colorToken: 'textSecondary',
      };
    case 'issue':
      return {
        status,
        label: 'Sync issue',
        icon: 'alert-circle-outline',
        colorToken: 'danger',
      };
  }
}
