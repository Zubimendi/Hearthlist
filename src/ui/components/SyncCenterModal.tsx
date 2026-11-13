// src/ui/components/SyncCenterModal.tsx
// Sync Center modal sheet for diagnostic details, manual sync trigger, and managing parked ops.

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, minTouchTarget, useTheme } from '../theme';
import { Button } from './Button';
import { syncEngine, type SyncEngineState } from '../../sync/engine';
import { getParkedOps, retryOp, discardOp } from '../../db/repositories/outbox';
import type { OutboxRow } from '../../db/schema';
import { toast } from '../feedback/toast';

export interface SyncCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SyncCenterModal({ visible, onClose }: SyncCenterModalProps): React.ReactElement {
  const { theme } = useTheme();
  const [syncState, setSyncState] = useState<SyncEngineState>(syncEngine.getState());
  const [parkedOps, setParkedOps] = useState<OutboxRow[]>([]);
  const [loadingActionSeq, setLoadingActionSeq] = useState<number | null>(null);

  const loadParked = async (): Promise<void> => {
    const res = await getParkedOps();
    if (res.ok) {
      setParkedOps(res.value);
    }
  };

  useEffect(() => {
    if (!visible) return;

    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
    });

    loadParked();
    return () => unsubscribe();
  }, [visible]);

  const handleSyncNow = async (): Promise<void> => {
    if (!syncState.isOnline) {
      toast.info("You're offline. Changes are saved locally.");
      return;
    }
    await syncEngine.sync();
    await loadParked();
    toast.success('Sync complete!');
  };

  const handleRetry = async (seq: number): Promise<void> => {
    setLoadingActionSeq(seq);
    await retryOp(seq);
    await loadParked();
    syncEngine.requestSync();
    setLoadingActionSeq(null);
    toast.info('Queued change for retry');
  };

  const handleDiscard = async (seq: number): Promise<void> => {
    setLoadingActionSeq(seq);
    await discardOp(seq);
    await loadParked();
    syncEngine.refreshCounts();
    setLoadingActionSeq(null);
    toast.info('Discarded item');
  };

  const formatLastSynced = (): string => {
    if (!syncState.lastSyncedAt) return 'Never';
    const seconds = Math.floor((Date.now() - syncState.lastSyncedAt) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hr ago`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>Sync Center</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close sync center"
                onPress={onClose}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              {/* Status Summary Card */}
              <View style={[styles.statusCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Status</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {syncState.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Last synced</Text>
                  <Text style={[styles.statValue, { color: theme.textSecondary }]}>
                    {formatLastSynced()}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Waiting to sync</Text>
                  <Text style={[styles.statValue, { color: theme.textSecondary }]}>
                    {syncState.pendingCount}
                  </Text>
                </View>
              </View>

              {/* Offline note */}
              {!syncState.isOnline ? (
                <View style={[styles.banner, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Ionicons name="cloud-offline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.bannerText, { color: theme.textSecondary }]}>
                    You&apos;re offline. Your changes are saved on this phone and will sync when you&apos;re back.
                  </Text>
                </View>
              ) : null}

              {/* Sync Now button */}
              <Button
                label={syncState.isDraining ? 'Syncing...' : 'Sync now'}
                onPress={handleSyncNow}
                disabled={!syncState.isOnline || syncState.isDraining}
                loading={syncState.isDraining}
                variant="primary"
                style={styles.syncBtn}
              />

              {/* Problem / Parked items */}
              {parkedOps.length > 0 ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.danger }]}>
                    Changes needing review ({parkedOps.length})
                  </Text>
                  {parkedOps.map((op) => (
                    <View
                      key={op.seq}
                      style={[styles.parkedCard, { borderColor: theme.border, backgroundColor: theme.bg }]}
                    >
                      <Text style={[styles.opTitle, { color: theme.text }]}>
                        {op.op.toUpperCase()} {op.entity.toUpperCase()} ({op.entityId})
                      </Text>
                      <Text style={[styles.opError, { color: theme.textSecondary }]}>
                        {op.lastError || 'Unable to sync with server'}
                      </Text>
                      <View style={styles.opActions}>
                        <Button
                          label="Retry"
                          variant="secondary"
                          loading={loadingActionSeq === op.seq}
                          onPress={() => handleRetry(op.seq)}
                          style={styles.smallBtn}
                        />
                        <Button
                          label="Discard"
                          variant="danger"
                          loading={loadingActionSeq === op.seq}
                          onPress={() => handleDiscard(op.seq)}
                          style={styles.smallBtn}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.cleanState}>
                  <Ionicons name="shield-checkmark" size={32} color={theme.success} />
                  <Text style={[styles.cleanText, { color: theme.textSecondary }]}>
                    Everything is safe and up to date.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '85%',
  },
  sheet: {
    borderTopLeftRadius: radius.card * 2,
    borderTopRightRadius: radius.card * 2,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
  },
  closeBtn: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  statusCard: {
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  statLabel: {
    ...typography.body,
  },
  statValue: {
    ...typography.body,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bannerText: {
    ...typography.caption,
    marginLeft: spacing.sm,
    flex: 1,
  },
  syncBtn: {
    marginBottom: spacing.lg,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  parkedCard: {
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  opTitle: {
    ...typography.label,
    fontWeight: '600',
  },
  opError: {
    ...typography.caption,
    marginVertical: spacing.xs,
  },
  opActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  smallBtn: {
    flex: 1,
    minHeight: 40,
    paddingVertical: spacing.xs,
  },
  cleanState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  cleanText: {
    ...typography.body,
    textAlign: 'center',
  },
});
