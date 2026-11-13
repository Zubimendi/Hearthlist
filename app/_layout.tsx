// app/_layout.tsx
// Root application layout with DB initialization, SecureStore auth rehydration, and ErrorBoundary.

import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, ActivityIndicator, Appearance } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

if (typeof globalThis.crypto === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).crypto = Crypto;
}
import { colors, typography, spacing, useThemeStore, useTheme } from '@/ui/theme';
import { ToastContainer } from '@/ui/feedback/ToastContainer';
import { Button } from '@/ui/components/Button';
import { initAuth, isAuthenticated, pb } from '@/api/pb';
import { getCurrentUser, refreshAuth } from '@/api/auth';
import { db } from '@/db/client';
import { households } from '@/db/schema';
import { saveHousehold } from '@/db/repositories/household';
import { sql } from 'drizzle-orm';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }): React.ReactElement {
  const { theme } = useTheme();

  return (
    <View style={[styles.errorContainer, { backgroundColor: theme.bg }]}>
      <Text style={[styles.errorTitle, { color: theme.danger }]}>Something went wrong</Text>
      <Text style={[styles.errorDetails, { color: theme.textSecondary }]}>
        {error.message || 'An unexpected error occurred.'}
      </Text>
      <Button label="Restart" onPress={retry} variant="primary" style={styles.retryBtn} />
    </View>
  );
}

export default function RootLayout(): React.ReactElement {
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useTheme();

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare(): Promise<void> {
      try {
        // 1. Create SQLite tables if not yet created (direct schema creation for reliable offline start)
        db.run(sql`
          CREATE TABLE IF NOT EXISTS households (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            invite_code TEXT NOT NULL,
            created_at INTEGER NOT NULL
          );
        `);

        db.run(sql`
          CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            household_id TEXT NOT NULL REFERENCES households(id),
            display_name TEXT NOT NULL
          );
        `);

        db.run(sql`
          CREATE TABLE IF NOT EXISTS lists (
            id TEXT PRIMARY KEY,
            household_id TEXT NOT NULL REFERENCES households(id),
            name TEXT NOT NULL,
            sort_order REAL NOT NULL DEFAULT 0,
            archived INTEGER NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER
          );
        `);

        db.run(sql`
          CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            list_id TEXT NOT NULL REFERENCES lists(id),
            household_id TEXT NOT NULL,
            name TEXT NOT NULL,
            quantity REAL,
            unit TEXT,
            note TEXT,
            category TEXT NOT NULL DEFAULT 'other',
            content_at INTEGER NOT NULL,
            checked INTEGER NOT NULL DEFAULT 0,
            checked_by TEXT,
            checked_at INTEGER,
            deleted_at INTEGER,
            state_at INTEGER NOT NULL,
            created_by TEXT NOT NULL,
            created_at INTEGER NOT NULL
          );
        `);

        db.run(sql`CREATE INDEX IF NOT EXISTS idx_items_list ON items(list_id, deleted_at, checked);`);
        db.run(sql`CREATE INDEX IF NOT EXISTS idx_items_household_name ON items(household_id, name COLLATE NOCASE);`);

        db.run(sql`
          CREATE TABLE IF NOT EXISTS outbox (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            entity TEXT NOT NULL CHECK (entity IN ('list','item')),
            entity_id TEXT NOT NULL,
            op TEXT NOT NULL CHECK (op IN ('create','update','delete')),
            payload TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            next_attempt_at INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','parked')),
            last_error TEXT,
            created_at INTEGER NOT NULL
          );
        `);

        db.run(sql`
          CREATE TABLE IF NOT EXISTS sync_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `);

        // 2. Rehydrate session from SecureStore and theme
        await initAuth();
        await useThemeStore.getState().loadInitialPreference();
        Appearance.addChangeListener(({ colorScheme }) => {
          useThemeStore.getState().setSystemScheme(colorScheme);
        });

        // 3. Reconcile household from server if local DB doesn't have it yet
        if (isAuthenticated()) {
          const localHh = db.select().from(households).get();
          if (!localHh) {
            const refreshRes = await refreshAuth();
            const hhId = refreshRes.ok ? refreshRes.value.householdId : getCurrentUser()?.householdId;
            if (hhId) {
              try {
                const serverHh = await pb.collection('households').getOne(hhId);
                const rawHh = serverHh as unknown as Record<string, unknown>;
                await saveHousehold({
                  id: serverHh.id,
                  name: String(rawHh.name || 'My Household'),
                  inviteCode: String(rawHh.invite_code || ''),
                  createdAt: Date.now(),
                });
              } catch (hhErr) {
                console.warn('[init] Could not pull server household:', hhErr);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Initialization error', e);
      } finally {
        setIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const authenticated = isAuthenticated();

    if (!authenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (authenticated) {
      // Check if user has household set up
      const hh = db.select().from(households).get();
      const user = getCurrentUser();
      const hasHousehold = Boolean(hh?.id || user?.householdId);

      if (!hasHousehold && segments[0] !== '(onboarding)') {
        router.replace('/(onboarding)/household');
      } else if (hasHousehold && (inAuthGroup || segments[0] === '(onboarding)')) {
        router.replace('/(tabs)');
      }
    }
  }, [isReady, segments, router]);

  if (!isReady) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="list/[id]" />
        </Stack>
        <ToastContainer />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.heading,
    marginBottom: spacing.xs,
  },
  errorDetails: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryBtn: {
    minWidth: 140,
  },
});
