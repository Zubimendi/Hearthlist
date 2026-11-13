// app/list/[id].tsx
// List detail screen: categorized items, quick-add bar with suggestions, Done section, and undo toast.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, useTheme } from '@/ui/theme';
import { Screen } from '@/ui/components/Screen';
import { ItemRow } from '@/ui/components/ItemRow';
import { QuickAddBar } from '@/ui/components/QuickAddBar';
import { ItemSheet } from '@/ui/components/ItemSheet';
import { EmptyState } from '@/ui/components/EmptyState';
import { db } from '@/db/client';
import { lists, items, type Item, type List } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  createItem,
  updateItemContent,
  toggleItemChecked,
  deleteItem,
  undoDeleteItem,
  clearDoneItems,
} from '@/db/repositories/items';
import { syncEngine } from '@/sync/engine';
import { getCurrentUser } from '@/api/auth';
import { CATEGORIES } from '@/data/catalog';
import { toast } from '@/ui/feedback/toast';

interface SectionData {
  title: string;
  data: Item[];
}

export default function ListDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, isDark } = useTheme();

  const [currentList, setCurrentList] = useState<List | null>(null);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [doneExpanded, setDoneExpanded] = useState(false);

  // Item sheet editing
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const loadData = useCallback((): void => {
    if (!id) return;
    try {
      const listRecord = db.select().from(lists).where(eq(lists.id, id)).get();
      if (listRecord) setCurrentList(listRecord);

      const itemsList = db
        .select()
        .from(items)
        .where(and(eq(items.listId, id), isNull(items.deletedAt)))
        .all();

      setAllItems(itemsList);
    } catch (e) {
      console.warn('Error loading list items', e);
    }
  }, [id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Group active items by category
  const activeItems = useMemo(() => allItems.filter((i) => !i.checked), [allItems]);
  const doneItems = useMemo(() => allItems.filter((i) => Boolean(i.checked)), [allItems]);

  const sections: SectionData[] = useMemo(() => {
    const map = new Map<string, Item[]>();

    for (const item of activeItems) {
      const cat = item.category || 'Other';
      const list = map.get(cat) || [];
      list.push(item);
      map.set(cat, list);
    }

    const result: SectionData[] = [];
    for (const cat of CATEGORIES) {
      const itemsInCat = map.get(cat);
      if (itemsInCat && itemsInCat.length > 0) {
        result.push({ title: cat, data: itemsInCat });
      }
    }

    // Done items section
    if (doneItems.length > 0) {
      result.push({
        title: `Done (${doneItems.length})`,
        data: doneExpanded ? doneItems : [],
      });
    }

    return result;
  }, [activeItems, doneItems, doneExpanded]);

  const handleToggle = async (itemId: string, checked: boolean): Promise<void> => {
    const user = getCurrentUser();
    await toggleItemChecked({
      id: itemId,
      checked,
      checkedBy: user?.id || null,
    });
    loadData();
    syncEngine.requestSync();
  };

  const handleQuickAdd = async (params: {
    name: string;
    quantity?: number;
    unit?: string;
    category: string;
  }): Promise<void> => {
    if (!currentList) return;
    const user = getCurrentUser();

    const res = await createItem({
      listId: currentList.id,
      householdId: currentList.householdId,
      name: params.name,
      quantity: params.quantity,
      unit: params.unit,
      category: params.category,
      createdBy: user?.id || 'local_user',
    });

    if (res.ok) {
      toast.success(`Added "${params.name}"`);
    } else {
      toast.error('Could not add item');
    }

    loadData();
    syncEngine.requestSync();
  };

  const handleRowPress = (item: Item): void => {
    setSelectedItem(item);
    setSheetVisible(true);
  };

  const handleSaveItem = async (params: {
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    note: string | null;
    category: string;
  }): Promise<void> => {
    await updateItemContent(params);
    loadData();
    syncEngine.requestSync();
    toast.success(`Updated "${params.name}"`);
  };

  const handleInlineUpdate = async (itemId: string, newName: string): Promise<void> => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const targetItem = allItems.find((i) => i.id === itemId);
    if (!targetItem || targetItem.name === trimmed) return;

    await updateItemContent({
      id: itemId,
      name: trimmed,
      quantity: targetItem.quantity,
      unit: targetItem.unit,
      note: targetItem.note,
      category: targetItem.category || 'Other',
    });
    loadData();
    syncEngine.requestSync();
    toast.success(`Updated to "${trimmed}"`);
  };

  const handleDeleteItem = async (itemId: string): Promise<void> => {
    const targetItem = allItems.find((i) => i.id === itemId);
    const itemName = targetItem?.name || 'Item';

    await deleteItem(itemId);
    loadData();
    syncEngine.requestSync();

    toast.info(`Removed "${itemName}"`, {
      actionLabel: 'Undo',
      onAction: async () => {
        await undoDeleteItem(itemId);
        loadData();
        syncEngine.requestSync();
        toast.success(`Restored "${itemName}"`);
      },
      duration: 4000,
    });
  };

  const handleClearDone = async (): Promise<void> => {
    if (!id) return;
    const count = doneItems.length;
    await clearDoneItems(id);
    loadData();
    syncEngine.requestSync();
    toast.info(`Cleared ${count} completed item${count > 1 ? 's' : ''}`);
  };

  return (
    <Screen title={currentList?.name || 'List'} canGoBack showSyncChip>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            allItems.length === 0 ? styles.emptyContainer : styles.listContent
          }
          ListHeaderComponent={
            allItems.length > 0 ? (
              <View style={styles.detailHeaderBox}>
                <View style={styles.detailHeaderTop}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={[styles.listHeroTitle, { color: theme.text }]} numberOfLines={1}>
                      {currentList?.name}
                    </Text>
                    <Text style={[styles.listHeroSubtitle, { color: theme.textSecondary }]}>
                      {activeItems.length === 0
                        ? 'All items checked off! 🎉'
                        : `${activeItems.length} item${activeItems.length === 1 ? '' : 's'} remaining`}
                    </Text>
                  </View>

                  <View style={styles.detailBadgeRow}>
                    <View style={[styles.todayTag, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F8EE' }]}>
                      <Text style={[styles.todayTagText, { color: theme.primary }]}>Today</Text>
                    </View>
                    <View style={[styles.progressCountBadge, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', borderColor: theme.border }]}>
                      <Ionicons name="checkmark-done" size={12} color={theme.primary} />
                      <Text style={[styles.progressCountText, { color: theme.textSecondary }]}>
                        {doneItems.length}/{allItems.length}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={[styles.headerProgressTrack, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                  <View
                    style={[
                      styles.headerProgressFill,
                      {
                        backgroundColor: theme.primary,
                        width: `${allItems.length > 0 ? Math.round((doneItems.length / allItems.length) * 100) : 0}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              title="Nothing here yet"
              subtitle="Add your first item using the bar below."
            />
          }
          renderSectionHeader={({ section: { title, data } }) => {
            if (title.startsWith('Done')) {
              return (
                <View
                  style={[
                    styles.doneHeaderRow,
                    { backgroundColor: theme.bg, borderTopColor: theme.border },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      doneExpanded ? 'Collapse done items' : 'Expand done items'
                    }
                    onPress={() => setDoneExpanded(!doneExpanded)}
                    style={styles.doneToggle}
                  >
                    <Ionicons
                      name={doneExpanded ? 'chevron-down' : 'chevron-forward'}
                      size={18}
                      color={theme.textSecondary}
                    />
                    <Text style={[styles.doneTitle, { color: theme.textSecondary }]}>
                      {title}
                    </Text>
                  </Pressable>

                  {doneItems.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear all done items"
                      onPress={handleClearDone}
                      style={styles.clearBtn}
                    >
                      <Text style={[styles.clearText, { color: theme.textSecondary }]}>
                        Clear done
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            }

            return (
              <View style={[styles.categoryHeader, { backgroundColor: theme.bg }]}>
                <View style={styles.categoryTitleRow}>
                  <Text style={[styles.categoryTitle, { color: theme.text }]}>
                    {title}
                  </Text>
                  <View style={[styles.catCountBadge, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                    <Text style={[styles.catCountText, { color: theme.textSecondary }]}>
                      {data.length}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              onToggle={handleToggle}
              onPress={handleRowPress}
              onDelete={handleDeleteItem}
              onUpdateName={handleInlineUpdate}
            />
          )}
        />

        {/* Quick Add Bar pinned above keyboard */}
        <QuickAddBar onAdd={handleQuickAdd} />

        {/* Edit Item Sheet */}
        <ItemSheet
          item={selectedItem}
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          onSave={handleSaveItem}
          onDelete={handleDeleteItem}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  detailHeaderBox: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.12)',
  },
  detailHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  listHeroTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  listHeroSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  detailBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayTag: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  todayTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  progressCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
    marginTop: spacing.xs,
  },
  headerProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  categoryHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  catCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
  },
  catCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  doneHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    marginTop: spacing.md,
  },
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  doneTitle: {
    ...typography.label,
    fontWeight: '600',
  },
  clearBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearText: {
    ...typography.caption,
  },
  undoToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.card,
  },
  undoText: {
    ...typography.body,
  },
  undoBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  undoAction: {
    ...typography.label,
    fontWeight: '700',
  },
});
