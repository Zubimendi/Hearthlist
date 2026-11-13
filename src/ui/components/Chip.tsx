// src/ui/components/Chip.tsx
// Suggestion / Filter chip with pill radius and token styles.

import React from 'react';
import { Pressable, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, spacing, radius, typography, useTheme } from '../theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function Chip({ label, selected = false, onPress, style }: ChipProps): React.ReactElement {
  const { theme, isDark } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? theme.primary
            : (isDark ? '#2C2C2E' : '#F2F2F7'),
          borderColor: selected
            ? theme.primary
            : (isDark ? '#38383A' : '#E5E5EA'),
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected ? '#FFFFFF' : theme.text,
            fontWeight: selected ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
  },
});
