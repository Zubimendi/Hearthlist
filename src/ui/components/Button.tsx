// src/ui/components/Button.tsx
// Base button component strictly adhering to design tokens and accessibility guidelines.

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors, spacing, radius, minTouchTarget, typography, useTheme } from '../theme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ButtonProps): React.ReactElement {
  const { theme } = useTheme();

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let bg: string = theme.primary;
    let borderColor: string | undefined;

    if (variant === 'secondary') {
      bg = theme.surface;
      borderColor = theme.border;
    } else if (variant === 'danger') {
      bg = theme.danger;
    } else if (variant === 'ghost') {
      bg = 'transparent';
    } else if (pressed) {
      bg = theme.primaryPressed;
    }

    if (disabled) {
      bg = variant === 'ghost' ? 'transparent' : theme.border;
    }

    return {
      backgroundColor: bg,
      borderColor,
      borderWidth: borderColor ? 1 : 0,
      opacity: pressed && variant === 'ghost' ? 0.7 : 1,
    };
  };

  const getTextStyle = (): TextStyle => {
    let color: string = theme.surface;

    if (variant === 'secondary') {
      color = theme.text;
    } else if (variant === 'ghost') {
      color = theme.primary;
    }

    if (disabled) {
      color = theme.textSecondary;
    }

    return { color };
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.base, getContainerStyle(pressed), style]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost' ? theme.primary : theme.surface}
        />
      ) : (
        <Text style={[styles.text, getTextStyle()]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    ...typography.label,
    textAlign: 'center',
  },
});
