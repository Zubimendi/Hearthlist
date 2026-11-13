// src/ui/components/ItemSheet.tsx
// Item detail bottom sheet for editing name, quantity, unit, note, and category.
// Autosaves changes on dismiss.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, minTouchTarget, typography, useTheme } from '../theme';
import { TextField } from './TextField';
import { Chip } from './Chip';
import { Button } from './Button';
import { CATEGORIES, COMMON_UNITS } from '../../data/catalog';
import type { Item } from '../../db/schema';

export interface ItemSheetProps {
  item: Item | null;
  visible: boolean;
  onClose: () => void;
  onSave: (params: {
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    note: string | null;
    category: string;
  }) => void;
  onDelete: (id: string) => void;
}

export function ItemSheet({
  item,
  visible,
  onClose,
  onSave,
  onDelete,
}: ItemSheetProps): React.ReactElement {
  const { theme } = useTheme();

  const [name, setName] = useState('');
  const [quantityStr, setQuantityStr] = useState('');
  const [unit, setUnit] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('Other');
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantityStr(item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '');
      setUnit(item.unit || null);
      setNote(item.note || '');
      setCategory(item.category || 'Other');
      setNameError(null);
    }
  }, [item]);

  const handleDismiss = (): void => {
    if (!item) {
      onClose();
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      // Revert name if left empty
      setName(item.name);
      onClose();
      return;
    }

    const parsedQty = quantityStr.trim() ? parseFloat(quantityStr.trim()) : null;

    onSave({
      id: item.id,
      name: trimmedName,
      quantity: isNaN(parsedQty as number) ? null : parsedQty,
      unit: unit || null,
      note: note.trim() || null,
      category,
    });

    onClose();
  };

  const handleDelete = (): void => {
    if (item) {
      onDelete(item.id);
      onClose();
    }
  };

  if (!item) return <Modal visible={false} />;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>Edit Item</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close item sheet"
                onPress={handleDismiss}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              {/* Item Name */}
              <TextField
                label="Item Name"
                value={name}
                onChangeText={(val) => {
                  setName(val);
                  if (val.trim()) setNameError(null);
                }}
                error={nameError}
                placeholder="e.g. Rice (ofada)"
              />

              {/* Quantity */}
              <TextField
                label="Quantity"
                value={quantityStr}
                onChangeText={setQuantityStr}
                keyboardType="decimal-pad"
                placeholder="e.g. 2.5"
              />

              {/* Common Unit Chips */}
              <Text style={[styles.label, { color: theme.textSecondary }]}>Unit</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {COMMON_UNITS.map((u) => (
                  <Chip
                    key={u}
                    label={u}
                    selected={unit === u}
                    onPress={() => setUnit(unit === u ? null : u)}
                  />
                ))}
              </ScrollView>

              {/* Note */}
              <TextField
                label="Note"
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Large red ones, check freshness"
                multiline
              />

              {/* Category Picker */}
              <Text style={[styles.label, { color: theme.textSecondary }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <Chip
                    key={cat}
                    label={cat}
                    selected={category === cat}
                    onPress={() => setCategory(cat)}
                  />
                ))}
              </View>

              {/* Actions */}
              <Button
                label="Save changes"
                variant="primary"
                onPress={handleDismiss}
                style={styles.saveBtn}
              />

              {/* Delete button */}
              <Button
                label="Delete item"
                variant="danger"
                onPress={handleDelete}
                style={styles.deleteBtn}
              />
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '90%',
  },
  sheet: {
    borderTopLeftRadius: radius.card * 2,
    borderTopRightRadius: radius.card * 2,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
  },
  closeBtn: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  saveBtn: {
    marginTop: spacing.md,
  },
  deleteBtn: {
    marginTop: spacing.sm,
  },
});
