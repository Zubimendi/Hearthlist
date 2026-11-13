// src/ui/components/QuickAddBar.tsx
// Quick-add input bar with autocomplete suggestion chips and instant local commit.

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, minTouchTarget, typography, useTheme } from '../theme';
import { Chip } from './Chip';
import { parseQuickAdd } from '../../lib/parseQuickAdd';
import { getCatalogSuggestions, predictCategory } from '../../data/catalog';

export interface QuickAddBarProps {
  onAdd: (params: {
    name: string;
    quantity?: number;
    unit?: string;
    category: string;
  }) => void;
  style?: ViewStyle;
}

export function QuickAddBar({ onAdd, style }: QuickAddBarProps): React.ReactElement {
  const { theme, isDark } = useTheme();
  const [text, setText] = useState('');

  const suggestions = text.trim().length > 1 ? getCatalogSuggestions(text, 4) : [];

  const handleSubmit = (input = text): void => {
    const raw = input.trim();
    if (!raw) return;

    const parsed = parseQuickAdd(raw);
    const category = predictCategory(parsed.name);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    onAdd({
      name: parsed.name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      category,
    });

    setText('');
  };

  const handleSelectSuggestion = (suggestionName: string): void => {
    // If the user already typed a quantity like "2kg", preserve it with suggestion name
    const parsed = parseQuickAdd(text);
    if (parsed.quantity) {
      handleSubmit(`${parsed.quantity}${parsed.unit || ''} ${suggestionName}`);
    } else {
      handleSubmit(suggestionName);
    }
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.surface, borderTopColor: theme.border }, style]}>
      {/* Autocomplete suggestion chips */}
      {suggestions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
        >
          {suggestions.map((s) => (
            <Chip
              key={s.name}
              label={s.name}
              onPress={() => handleSelectSuggestion(s.name)}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Input row */}
      <View style={styles.inputRow}>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.bg,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons
            name="add"
            size={20}
            color={theme.primary}
            style={styles.inputPrefixIcon}
          />
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder="Add item (e.g. 2kg rice, 3 apples)..."
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
            onSubmitEditing={() => handleSubmit()}
            accessibilityRole="none"
            accessibilityLabel="Add an item to the list"
          />
          {text.trim().length > 0 && (
            <Pressable
              onPress={() => setText('')}
              hitSlop={8}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add item"
          accessibilityState={{ disabled: !text.trim() }}
          disabled={!text.trim()}
          onPress={() => handleSubmit()}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: text.trim() ? theme.primary : (isDark ? '#2C2C2E' : '#E5E5EA'),
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={text.trim() ? '#FFFFFF' : theme.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  chipScroll: {
    paddingBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  inputPrefixIcon: {
    marginRight: 6,
  },
  input: {
    ...typography.body,
    fontSize: 15,
    flex: 1,
    paddingVertical: 10,
  },
  clearBtn: {
    padding: 4,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
