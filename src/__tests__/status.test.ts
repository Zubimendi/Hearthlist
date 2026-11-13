import { deriveSyncStatus, getSyncChipInfo } from '../sync/status';

describe('sync status derivation', () => {
  it('returns offline when not online', () => {
    const status = deriveSyncStatus({
      isOnline: false,
      isDraining: true,
      isPulling: false,
      hasAuthIssue: false,
      parkedOpsCount: 0,
      pendingOpsCount: 5,
    });
    expect(status).toBe('offline');
    expect(getSyncChipInfo(status).label).toBe('Offline');
  });

  it('returns syncing when draining or pulling', () => {
    const statusDraining = deriveSyncStatus({
      isOnline: true,
      isDraining: true,
      isPulling: false,
      hasAuthIssue: false,
      parkedOpsCount: 0,
      pendingOpsCount: 2,
    });
    expect(statusDraining).toBe('syncing');

    const statusPulling = deriveSyncStatus({
      isOnline: true,
      isDraining: false,
      isPulling: true,
      hasAuthIssue: false,
      parkedOpsCount: 0,
      pendingOpsCount: 0,
    });
    expect(statusPulling).toBe('syncing');
  });

  it('returns issue when parked ops exist or auth needs renewal', () => {
    const statusParked = deriveSyncStatus({
      isOnline: true,
      isDraining: false,
      isPulling: false,
      hasAuthIssue: false,
      parkedOpsCount: 1,
      pendingOpsCount: 0,
    });
    expect(statusParked).toBe('issue');

    const statusAuth = deriveSyncStatus({
      isOnline: true,
      isDraining: false,
      isPulling: false,
      hasAuthIssue: true,
      parkedOpsCount: 0,
      pendingOpsCount: 0,
    });
    expect(statusAuth).toBe('issue');
  });

  it('returns pending when pending ops exist and not syncing', () => {
    const status = deriveSyncStatus({
      isOnline: true,
      isDraining: false,
      isPulling: false,
      hasAuthIssue: false,
      parkedOpsCount: 0,
      pendingOpsCount: 3,
    });
    expect(status).toBe('pending');
    expect(getSyncChipInfo(status, 3).label).toBe('3 waiting');
  });

  it('returns up_to_date when clean and online', () => {
    const status = deriveSyncStatus({
      isOnline: true,
      isDraining: false,
      isPulling: false,
      hasAuthIssue: false,
      parkedOpsCount: 0,
      pendingOpsCount: 0,
    });
    expect(status).toBe('up_to_date');
    expect(getSyncChipInfo(status).label).toBe('Up to date');
  });
});
