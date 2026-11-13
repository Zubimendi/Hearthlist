// src/ui/components/ItemRow.tsx
// High-craft item row with inline text editing, inline delete button, swipe-to-delete,
// 48dp touch target checkbox, quantity pill, note indicator, and tactile haptics.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, minTouchTarget, typography, useTheme } from '../theme';
import type { Item } from '../../db/schema';

export interface ItemRowProps {
  item: Item;
  onToggle: (id: string, checked: boolean) => void;
  onPress: (item: Item) => void;
  onDelete: (id: string) => void;
  onUpdateName?: (id: string, newName: string) => void;
}

const SWIPE_THRESHOLD = -70;

export const ItemRow = React.memo(function ItemRow({
  item,
  onToggle,
  onPress,
  onDelete,
  onUpdateName,
}: ItemRowProps): React.ReactElement {
  const { theme, isDark } = useTheme();
  const isChecked = Boolean(item.checked);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);

  useEffect(() => {
    setEditName(item.name);
  }, [item.name]);

  // Swipe-to-delete animation
  const panX = useRef(new Animated.Value(0)).current;
  const isSwipedOpen = useRef(false);

  const resetSwipe = useCallback(() => {
    Animated.spring(panX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start(() => {
      isSwipedOpen.current = false;
    });
  }, [panX]);

  const openSwipe = useCallback(() => {
    Animated.spring(panX, {
      toValue: -76,
      useNativeDriver: true,
      bounciness: 4,
    }).start(() => {
      isSwipedOpen.current = true;
    });
  }, [panX]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only claim horizontal gestures that exceed 10dp and are primarily horizontal
        return (
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          // Swiping left (revealing delete)
          panX.setValue(Math.max(gestureState.dx, -120));
        } else if (isSwipedOpen.current && gestureState.dx > 0) {
          // Swiping right from open state
          panX.setValue(Math.min(-76 + gestureState.dx, 0));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < SWIPE_THRESHOLD) {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
          openSwipe();
        } else {
          resetSwipe();
        }
      },
      onPanResponderTerminate: () => {
        resetSwipe();
      },
    })
  ).current;

  const handleCheckboxPress = (): void => {
    try {
      if (!isChecked) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Haptics fail gracefully where unsupported
    }
    onToggle(item.id, !isChecked);
  };

  const handleCommitInlineEdit = (): void => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== item.name) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      onUpdateName?.(item.id, trimmed);
    } else {
      setEditName(item.name);
    }
    setIsEditing(false);
  };

  const handleCancelInlineEdit = (): void => {
    setEditName(item.name);
    setIsEditing(false);
  };

  const handleDelete = (): void => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    resetSwipe();
    onDelete(item.id);
  };

  const handleStartEditing = (): void => {
    resetSwipe();
    setIsEditing(true);
  };

  const accessibilityLabel = `${item.name}${
    item.quantity ? `, ${item.quantity} ${item.unit || ''}` : ''
  }, ${isChecked ? 'checked' : 'not checked'}`;

  const isToday = useMemo(() => {
    if (!item.createdAt) return false;
    const itemDate = new Date(item.createdAt);
    const now = new Date();
    return (
      itemDate.getDate() === now.getDate() &&
      itemDate.getMonth() === now.getMonth() &&
      itemDate.getFullYear() === now.getFullYear()
    );
  }, [item.createdAt]);

  return (
    <View style={styles.container}>
      {/* Background Swipe Delete Action */}
      <View style={[styles.swipeBackground, { backgroundColor: theme.danger }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete item"
          onPress={handleDelete}
          style={styles.swipeDeleteBtn}
        >
          <Ionicons name="trash" size={20} color="#FFFFFF" />
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </Pressable>
      </View>

      {/* Foreground Interactive Row */}
      <Animated.View
        {...(!isEditing ? panResponder.panHandlers : {})}
        style={[
          styles.row,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
            transform: [{ translateX: panX }],
          },
        ]}
      >
        {/* 48dp Checkbox touch target */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isChecked ? 'Mark uncompleted' : 'Mark completed'}
          onPress={handleCheckboxPress}
          style={styles.checkboxTarget}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: isChecked ? theme.primary : (isDark ? '#48484A' : '#C7C7CC'),
                backgroundColor: isChecked ? theme.primary : 'transparent',
              },
            ]}
          >
            {isChecked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
          </View>
        </Pressable>

        {/* Item Info / Inline Edit */}
        {isEditing ? (
          <View style={styles.inlineEditContainer}>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              autoFocus
              onSubmitEditing={handleCommitInlineEdit}
              returnKeyType="done"
              style={[
                styles.inlineInput,
                {
                  color: theme.text,
                  backgroundColor: theme.bg,
                  borderColor: theme.primary,
                },
              ]}
              accessibilityLabel="Edit item name inline"
            />
            <View style={styles.inlineActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save inline name"
                onPress={handleCommitInlineEdit}
                hitSlop={8}
                style={styles.inlineActionBtn}
              >
                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel inline edit"
                onPress={handleCancelInlineEdit}
                hitSlop={8}
                style={styles.inlineActionBtn}
              >
                <Ionicons name="close-circle-outline" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={handleStartEditing}
            style={styles.textContainer}
            accessibilityRole="button"
            accessibilityLabel={`Tap to edit ${item.name}`}
          >
            <View style={styles.nameRow}>
              <Text
                numberOfLines={2}
                style={[
                  styles.name,
                  {
                    color: isChecked ? theme.textDone : theme.text,
                    textDecorationLine: isChecked ? 'line-through' : 'none',
                  },
                ]}
              >
                {item.name}
              </Text>

              {isToday && !isChecked ? (
                <View
                  style={[
                    styles.todayBadge,
                    { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F8EE' },
                  ]}
                >
                  <Text style={[styles.todayBadgeText, { color: theme.primary }]}>Today</Text>
                </View>
              ) : null}
            </View>

            {item.note ? (
              <View style={styles.noteRow}>
                <Ionicons name="document-text-outline" size={12} color={theme.textSecondary} />
                <Text
                  numberOfLines={1}
                  style={[styles.noteText, { color: theme.textSecondary }]}
                >
                  {item.note}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}

        {/* Quantity pill (if present and not editing) */}
        {!isEditing && item.quantity ? (
          <Pressable onPress={() => onPress(item)}>
            <View
              style={[
                styles.qtyPill,
                { backgroundColor: theme.bg, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.qtyText, { color: theme.textSecondary }]}>
                {item.quantity} {item.unit || ''}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* Inline Actions (Details & Delete) */}
        {!isEditing ? (
          <View style={styles.rowActions}>
            {/* Details / Edit Sheet button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit item details"
              onPress={() => onPress(item)}
              hitSlop={8}
              style={styles.actionIconBtn}
            >
              <Ionicons name="create-outline" size={18} color={theme.textSecondary} />
            </Pressable>

            {/* Direct Inline Delete button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name}`}
              onPress={handleDelete}
              hitSlop={8}
              style={styles.actionIconBtn}
            >
              <Ionicons name="trash-outline" size={18} color={theme.danger} />
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 76,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeDeleteBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  swipeDeleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingRight: spacing.md,
    borderBottomWidth: 1,
  },
  checkboxTarget: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '500',
  },
  todayBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  noteText: {
    ...typography.caption,
  },
  qtyPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginHorizontal: spacing.xs,
  },
  qtyText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionIconBtn: {
    minWidth: 36,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineEditContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
  },
  inlineInput: {
    flex: 1,
    ...typography.body,
    fontSize: 16,
    borderWidth: 1.5,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    minHeight: 40,
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.xs,
    gap: 4,
  },
  inlineActionBtn: {
    minWidth: 32,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
