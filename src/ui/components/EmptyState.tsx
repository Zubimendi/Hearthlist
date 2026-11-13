// src/ui/components/EmptyState.tsx
// Contextual empty state with title, subtitle, and optional call to action.

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { spacing, typography, useTheme } from '../theme';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps): React.ReactElement {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="primary"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xxl,
  },
  title: {
    ...typography.heading,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  action: {
    marginTop: spacing.md,
  },
});
