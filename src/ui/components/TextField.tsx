// src/ui/components/TextField.tsx
// Accessible input with animated focus border and optional trailing icon slot.

import React, { useState, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Pressable,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, spacing, radius, typography, useTheme } from '../theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Render a trailing element (e.g. eye icon) inside the input border. */
  trailing?: ReactNode;
  containerStyle?: ViewStyle;
}

export function TextField({
  label,
  error,
  hint,
  trailing,
  containerStyle,
  ...inputProps
}: TextFieldProps): React.ReactElement {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
    inputProps.onFocus?.({} as never);
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    inputProps.onBlur?.({} as never);
  };

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? theme.danger : theme.border,
      error ? theme.danger : theme.primary,
    ],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Animated.View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.surface,
            borderColor,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={label}
          onFocus={onFocus}
          onBlur={onBlur}
          {...inputProps}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </Animated.View>
      {error ? (
        <Text style={[styles.hint, { color: theme.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

// Convenience wrapper: password field with built-in eye toggle
export interface PasswordFieldProps extends Omit<TextFieldProps, 'trailing' | 'secureTextEntry'> {}

export function PasswordField(props: PasswordFieldProps): React.ReactElement {
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();

  // We import Ionicons lazily to avoid issues if vector-icons isn't resolved
  // In this codebase @expo/vector-icons is a direct dep — safe to use.
  const { Ionicons } = require('@expo/vector-icons');

  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          onPress={() => setVisible(v => !v)}
          hitSlop={8}
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          accessibilityRole="button"
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.textSecondary}
          />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderRadius: radius.input,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.sm,
  },
  trailing: {
    paddingLeft: spacing.sm,
  },
  hint: {
    ...typography.caption,
    marginTop: 4,
  },
});
