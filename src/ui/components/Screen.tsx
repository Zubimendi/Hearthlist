// src/ui/components/Screen.tsx
// Screen layout wrapper with SafeAreaView, header, and SyncChip.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, minTouchTarget, useTheme } from '../theme';
import { SyncChip } from './SyncChip';
import { SyncCenterModal } from './SyncCenterModal';
import { syncEngine, type SyncEngineState } from '../../sync/engine';

export interface ScreenProps {
  title?: string;
  canGoBack?: boolean;
  showSyncChip?: boolean;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function Screen({
  title,
  canGoBack = false,
  showSyncChip = true,
  children,
  rightAction,
  style,
}: ScreenProps): React.ReactElement {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [syncState, setSyncState] = useState<SyncEngineState>(syncEngine.getState());
  const [syncCenterVisible, setSyncCenterVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
    });
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      {title || showSyncChip || canGoBack ? (
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.leftContainer}>
            {canGoBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => router.back()}
                style={styles.backBtn}
              >
                <Ionicons name="chevron-back" size={24} color={theme.text} />
              </Pressable>
            ) : null}
            {title ? (
              <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
                {title}
              </Text>
            ) : null}
          </View>

          <View style={styles.rightContainer}>
            {rightAction}
            {showSyncChip ? (
              <SyncChip
                status={syncState.status}
                pendingCount={syncState.pendingCount}
                onPress={() => setSyncCenterVisible(true)}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Screen Body */}
      <View style={[styles.content, style]}>{children}</View>

      {/* Sync Center Sheet */}
      <SyncCenterModal
        visible={syncCenterVisible}
        onClose={() => setSyncCenterVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  title: {
    ...typography.heading,
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  content: {
    flex: 1,
  },
});
