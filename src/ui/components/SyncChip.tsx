// src/ui/components/SyncChip.tsx
// Persistent save-state indicator shown in screen headers.
// Tap opens the Sync Center modal.

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, useTheme } from '../theme';
import { getSyncChipInfo, type SyncStatusType } from '../../sync/status';

export interface SyncChipProps {
  status: SyncStatusType;
  pendingCount?: number;
  onPress: () => void;
}

export function SyncChip({
  status,
  pendingCount = 0,
  onPress,
}: SyncChipProps): React.ReactElement {
  const { theme } = useTheme();
  const info = getSyncChipInfo(status, pendingCount);

  const getTextColor = (): string => {
    switch (info.colorToken) {
      case 'success':
        return theme.success;
      case 'warning':
        return theme.warning;
      case 'danger':
        return theme.danger;
      default:
        return theme.textSecondary;
    }
  };

  const textColor = getTextColor();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${info.label}. Tap to open sync center.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        {status === 'syncing' ? (
          <ActivityIndicator size={12} color={textColor} />
        ) : (
          <Ionicons
            name={info.icon as unknown as keyof typeof Ionicons.glyphMap}
            size={14}
            color={textColor}
          />
        )}
      </View>
      <Text style={[styles.label, { color: textColor }]}>{info.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '500',
  },
});
