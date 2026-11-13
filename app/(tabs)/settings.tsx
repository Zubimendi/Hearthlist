// app/(tabs)/settings.tsx
// Settings screen: Profile, Theme switcher, Network & Sync Diagnostics, and fail-safe sign-out.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, useTheme } from '@/ui/theme';
import { Screen } from '@/ui/components/Screen';
import { signOut, getCurrentUser } from '@/api/auth';
import { syncEngine, type SyncEngineState } from '@/sync/engine';
import { getAllPendingCount } from '@/db/repositories/outbox';
import { toast } from '@/ui/feedback/toast';
import { PB_URL, pb } from '@/api/pb';

export default function SettingsScreen(): React.ReactElement {
  const router = useRouter();
  const { theme, isDark, preference, setPreference } = useTheme();
  const user = getCurrentUser();

  const [syncState, setSyncState] = useState<SyncEngineState>(syncEngine.getState());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const unsub = syncEngine.subscribe(setSyncState);
    return () => unsub();
  }, []);

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await fetch(`${PB_URL}/api/health`, { method: 'GET' });
      if (res.ok) {
        setConnectionStatus('connected');
        toast.success('Connected to backend server!');
      } else {
        setConnectionStatus('error');
        toast.error(`Server returned status ${res.status}`);
      }
    } catch (e) {
      setConnectionStatus('error');
      toast.error('Cannot reach backend. Check LAN IP / Wi-Fi.');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleManualSync = async () => {
    toast.info('Starting sync...');
    try {
      await syncEngine.sync();
      const pending = await getAllPendingCount();
      if (pending === 0) {
        toast.success('Sync complete! All changes up to date.');
      } else {
        toast.info(`Sync finished. ${pending} item(s) pending.`);
      }
    } catch {
      toast.error('Sync failed. Please check network.');
    }
  };

  const handleSignOut = async (): Promise<void> => {
    const pending = await getAllPendingCount();

    if (pending > 0) {
      Alert.alert(
        'Unsynced Changes',
        `You have ${pending} change${pending > 1 ? 's' : ''} saved locally that haven't synced to the server yet.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Try sync first',
            onPress: async () => {
              toast.info('Syncing before sign out...');
              try {
                await syncEngine.sync();
                const remaining = await getAllPendingCount();
                if (remaining === 0) {
                  performSignOut();
                } else {
                  Alert.alert(
                    'Sync incomplete',
                    `Could not sync ${remaining} change(s). Sign out anyway and discard them?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sign out anyway', style: 'destructive', onPress: performSignOut },
                    ]
                  );
                }
              } catch {
                Alert.alert(
                  'Sync failed',
                  'Could not reach server. Would you like to sign out anyway?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign out anyway', style: 'destructive', onPress: performSignOut },
                  ]
                );
              }
            },
          },
          {
            text: 'Sign out anyway',
            style: 'destructive',
            onPress: performSignOut,
          },
        ]
      );
    } else {
      Alert.alert('Sign out', 'Are you sure you want to sign out of Hearthlist?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: performSignOut },
      ]);
    }
  };

  const performSignOut = async (): Promise<void> => {
    setSigningOut(true);
    try {
      syncEngine.stop();
      await signOut();
      toast.info('Signed out successfully');
      router.replace('/(auth)/welcome');
    } catch (e) {
      console.warn('Sign out error:', e);
      router.replace('/(auth)/welcome');
    } finally {
      setSigningOut(false);
    }
  };

  const initial = user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';

  return (
    <Screen title="Settings" showSyncChip>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.profileRow}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {user?.displayName || 'User'}
              </Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                {user?.email || 'Offline mode'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9' }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.statusText, { color: theme.success }]}>Active</Text>
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>APPEARANCE</Text>
          <View style={styles.themeSelectorRow}>
            {[
              { id: 'system', label: 'System', icon: 'phone-portrait-outline' },
              { id: 'light', label: 'Light', icon: 'sunny-outline' },
              { id: 'dark', label: 'Dark', icon: 'moon-outline' },
            ].map((t) => {
              const isSelected = preference === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setPreference(t.id as 'system' | 'light' | 'dark');
                    toast.info(`Theme set to ${t.label}`);
                  }}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.bg,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={t.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={isSelected ? '#FFFFFF' : theme.text}
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: isSelected ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sync & Connectivity Center */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              SYNC & BACKEND
            </Text>
            <Pressable
              onPress={testConnection}
              disabled={testingConnection}
              hitSlop={8}
              style={styles.testBtn}
            >
              {testingConnection ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={14} color={theme.primary} />
                  <Text style={[styles.testBtnText, { color: theme.primary }]}>Test URL</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={[styles.infoTile, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Ionicons name="server-outline" size={18} color={theme.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>PocketBase URL</Text>
              <Text style={[styles.tileValue, { color: theme.text }]} numberOfLines={1}>
                {PB_URL}
              </Text>
            </View>
            {connectionStatus === 'connected' && (
              <Ionicons name="checkmark-circle" size={18} color={theme.success} />
            )}
            {connectionStatus === 'error' && (
              <Ionicons name="alert-circle" size={18} color={theme.danger} />
            )}
          </View>

          <View style={[styles.infoTile, { backgroundColor: theme.bg, borderColor: theme.border, marginTop: spacing.sm }]}>
            <Ionicons name="cloud-done-outline" size={18} color={theme.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Local Outbox</Text>
              <Text style={[styles.tileValue, { color: theme.text }]}>
                {syncState.pendingCount === 0
                  ? 'All changes synchronized'
                  : `${syncState.pendingCount} pending change(s)`}
              </Text>
            </View>
            <Pressable
              onPress={handleManualSync}
              hitSlop={8}
              style={[styles.syncNowBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.syncNowBtnText}>Sync now</Text>
            </Pressable>
          </View>
        </View>

        {/* About Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>ABOUT HEARTHLIST</Text>
          <Text style={[styles.bodyText, { color: theme.text }]}>
            Built offline-first with SQLite and PocketBase. Lists update instantly on device and replicate seamlessly across your household.
          </Text>
          <View style={styles.versionRow}>
            <Text style={[styles.versionText, { color: theme.textSecondary }]}>
              Version 1.0.0 · Expo SDK 52
            </Text>
            <Text style={[styles.versionText, { color: theme.textSecondary }]}>
              SQLite Engine
            </Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out of your account"
          onPress={handleSignOut}
          disabled={signingOut}
          style={({ pressed }) => [
            styles.signOutBtn,
            {
              backgroundColor: isDark ? 'rgba(255, 59, 48, 0.15)' : '#FEE2E2',
              borderColor: isDark ? 'rgba(255, 59, 48, 0.3)' : '#FECACA',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={theme.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={theme.danger} />
              <Text style={[styles.signOutText, { color: theme.danger }]}>Sign out of account</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  card: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  profileText: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.md,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tileValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  syncNowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  syncNowBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bodyText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
    paddingTop: spacing.sm,
  },
  versionText: {
    fontSize: 12,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
