// app/(tabs)/index.tsx
// Home screen: displays grocery lists with open item counts, pull-to-refresh sync, and offline CRUD.
// Replicates the tactile, polished UX of top-tier consumer apps (Linear, Things 3, Apple Reminders).

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, typography, useTheme } from '@/ui/theme';
import { Screen } from '@/ui/components/Screen';
import { TextField } from '@/ui/components/TextField';
import { db } from '@/db/client';
import { lists, items, households, type List } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { createList, deleteList, renameList } from '@/db/repositories/lists';
import { syncEngine } from '@/sync/engine';
import { getCurrentUser } from '@/api/auth';
import { toast } from '@/ui/feedback/toast';

interface ListWithDetails extends List {
  openCount: number;
  totalCount: number;
  previewItems: string[];
}

const TEMPLATE_SUGGESTIONS = [
  { name: 'Market run', icon: 'basket-outline' },
  { name: 'Supermarket', icon: 'cart-outline' },
  { name: 'Pantry staples', icon: 'nutrition-outline' },
  { name: 'Household supplies', icon: 'cube-outline' },
];

function getListIcon(name: string): keyof typeof Ionicons.glyphMap {
  const lower = name.toLowerCase();
  if (lower.includes('market')) return 'basket-outline';
  if (lower.includes('supermarket') || lower.includes('store') || lower.includes('grocer')) return 'cart-outline';
  if (lower.includes('pantry') || lower.includes('food') || lower.includes('staple')) return 'nutrition-outline';
  if (lower.includes('party') || lower.includes('drink') || lower.includes('wine')) return 'wine-outline';
  if (lower.includes('pharma') || lower.includes('chemist') || lower.includes('med')) return 'medkit-outline';
  return 'receipt-outline';
}

export default function ListsScreen(): React.ReactElement {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [householdName, setHouseholdName] = useState('Our Home');
  const [inviteCode, setInviteCode] = useState('');
  const [listData, setListData] = useState<ListWithDetails[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Dialogs
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [editName, setEditName] = useState('');

  const loadData = useCallback((): void => {
    try {
      // 1. Get household name and invite code
      const hh = db.select().from(households).get();
      if (hh) {
        setHouseholdName(hh.name);
        setInviteCode(hh.inviteCode);
      }

      // 2. Get active lists
      const rawLists = db
        .select()
        .from(lists)
        .where(isNull(lists.deletedAt))
        .all();

      // 3. Compute open item counts & previews per list
      const combined: ListWithDetails[] = rawLists.map((l) => {
        const listItems = db
          .select()
          .from(items)
          .where(and(eq(items.listId, l.id), isNull(items.deletedAt)))
          .all();

        const open = listItems.filter((it) => !it.checked);
        const previews = open.slice(0, 3).map((it) => it.name);

        return {
          ...l,
          openCount: open.length,
          totalCount: listItems.length,
          previewItems: previews,
        };
      });

      setListData(combined);
    } catch (e) {
      console.warn('Error loading lists', e);
    }
  }, []);

  useEffect(() => {
    loadData();
    syncEngine.start();
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const stats = useMemo(() => {
    let totalNeeded = 0;
    let totalDone = 0;
    listData.forEach((l) => {
      totalNeeded += l.openCount;
      totalDone += l.totalCount - l.openCount;
    });
    return { totalNeeded, totalDone, listCount: listData.length };
  }, [listData]);

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    await syncEngine.sync();
    loadData();
    setRefreshing(false);
    toast.success('Household lists updated');
  };

  const handleCopyInviteCode = async (): Promise<void> => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
    toast.success('Invite code copied to clipboard!');
  };

  const submitCreateList = async (name: string): Promise<void> => {
    const clean = name.trim();
    if (!clean) {
      setCreateError('Please give your list a name.');
      return;
    }

    setCreateError(null);
    let hh = db.select().from(households).get();
    const user = getCurrentUser();

    // Ensure local household row exists to avoid FK error
    if (!hh) {
      const fallbackId = user?.householdId || 'hh_local';
      db.insert(households)
        .values({
          id: fallbackId,
          name: 'Our Home',
          inviteCode: 'HEARTH',
          createdAt: Date.now(),
        })
        .onConflictDoNothing()
        .run();
      hh = db.select().from(households).get();
    }

    const householdId = hh?.id || 'hh_local';
    const createdBy = user?.id || 'local_user';

    const res = await createList({
      householdId,
      name: clean,
      createdBy,
    });

    if (res.ok) {
      setNewListName('');
      setCreateSheetVisible(false);
      toast.success(`List "${res.value.name}" created!`);
      loadData();
      syncEngine.requestSync();
      router.push(`/list/${res.value.id}`);
    } else {
      console.error('List creation failed:', res.error);
      setCreateError(res.error.message || 'Could not save list. Try again.');
      toast.error(res.error.message || 'Could not save list. Try again.');
    }
  };

  const handleRenameList = async (): Promise<void> => {
    if (!selectedList || !editName.trim()) return;

    const newName = editName.trim();
    await renameList({
      id: selectedList.id,
      name: newName,
    });

    setRenameModalVisible(false);
    setSelectedList(null);
    toast.success(`List renamed to "${newName}"`);
    loadData();
    syncEngine.requestSync();
  };

  const handleDeleteList = async (): Promise<void> => {
    if (!selectedList) return;

    const listName = selectedList.name;
    const listId = selectedList.id;

    Alert.alert(
      'Delete list?',
      `Are you sure you want to remove "${listName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteList(listId);
            setActionSheetVisible(false);
            setSelectedList(null);
            toast.info(`Deleted "${listName}"`);
            loadData();
            syncEngine.requestSync();
          },
        },
      ]
    );
  };

  const renderEmptyState = (): React.ReactElement => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9' }]}>
        <Ionicons name="basket-outline" size={38} color={theme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No grocery lists yet</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Create a list for your household, add items together, and watch checks sync in real time.
      </Text>

      <Text style={[styles.suggestionsHeader, { color: theme.textSecondary }]}>POPULAR STARTERS</Text>
      <View style={styles.templatesContainer}>
        {TEMPLATE_SUGGESTIONS.map((tpl) => (
          <Pressable
            key={tpl.name}
            style={({ pressed }) => [
              styles.templateChip,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9', borderColor: theme.primary },
            ]}
            onPress={() => submitCreateList(tpl.name)}
          >
            <Ionicons name={tpl.icon as keyof typeof Ionicons.glyphMap} size={16} color={theme.primary} />
            <Text style={[styles.templateChipText, { color: theme.text }]}>{tpl.name}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.emptyHouseholdBtn, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderColor: theme.border }]}
        onPress={() => router.push('/(tabs)/household')}
      >
        <Ionicons name="people-outline" size={18} color={theme.primary} />
        <Text style={[styles.emptyHouseholdBtnText, { color: theme.primary }]}>
          View Household & Invite Code ({inviteCode || '------'})
        </Text>
      </Pressable>
    </View>
  );

  return (
    <Screen
      title={householdName}
      showSyncChip
      rightAction={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={() => router.push('/(tabs)/household')}
            style={[styles.headerIconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityLabel="Household details"
            hitSlop={8}
          >
            <Ionicons name="home-outline" size={18} color={theme.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            style={[styles.headerIconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityLabel="Settings"
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={18} color={theme.text} />
          </Pressable>
        </View>
      }
    >
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={listData.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          listData.length > 0 ? (
            <View style={styles.heroSection}>
              {/* Household summary banner */}
              <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Pressable
                  style={styles.summaryTop}
                  onPress={() => router.push('/(tabs)/household')}
                >
                  <View style={styles.summaryHomeInfo}>
                    <View style={[styles.homeBadge, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9' }]}>
                      <Ionicons name="home" size={14} color={theme.primary} />
                    </View>
                    <Text style={[styles.summaryHomeName, { color: theme.text }]} numberOfLines={1}>
                      {householdName}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
                  </View>

                  {inviteCode ? (
                    <Pressable
                      style={[styles.codePill, { backgroundColor: theme.bg, borderColor: theme.border }]}
                      onPress={handleCopyInviteCode}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={copiedCode ? 'checkmark-outline' : 'key-outline'}
                        size={12}
                        color={copiedCode ? theme.success : theme.textSecondary}
                      />
                      <Text style={[styles.codePillText, { color: copiedCode ? theme.success : theme.textSecondary }]}>
                        {copiedCode ? 'Copied!' : inviteCode}
                      </Text>
                    </Pressable>
                  ) : null}
                </Pressable>

                {/* Stats row */}
                <View style={[styles.statsRow, { backgroundColor: theme.bg }]}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: theme.text }]}>{stats.listCount}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                      {stats.listCount === 1 ? 'List' : 'Lists'}
                    </Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: stats.totalNeeded > 0 ? theme.primary : theme.text }]}>
                      {stats.totalNeeded}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>To buy</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: theme.success }]}>
                      {stats.totalDone}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Checked</Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>YOUR LISTS</Text>
                <Pressable
                  onPress={() => setCreateSheetVisible(true)}
                  style={styles.newLink}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={16} color={theme.primary} />
                  <Text style={[styles.newLinkText, { color: theme.primary }]}>New list</Text>
                </Pressable>
              </View>
            </View>
          ) : undefined
        }
        ListEmptyComponent={renderEmptyState}
        renderItem={({ item }) => {
          const icon = getListIcon(item.name);
          const isAllDone = item.totalCount > 0 && item.openCount === 0;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.openCount} items to buy`}
              onPress={() => router.push(`/list/${item.id}`)}
              onLongPress={() => {
                setSelectedList(item);
                setEditName(item.name);
                setActionSheetVisible(true);
              }}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
                pressed && styles.cardPressed,
              ]}
            >
              {/* Left icon badge */}
              <View
                style={[
                  styles.cardIconBox,
                  { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9' },
                  isAllDone && { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.2)' : '#E8F5E9' },
                ]}
              >
                <Ionicons
                  name={isAllDone ? 'checkmark-circle-outline' : icon}
                  size={24}
                  color={isAllDone ? theme.success : theme.primary}
                />
              </View>

              {/* Card body */}
              <View style={styles.cardInfo}>
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {isAllDone ? (
                    <View style={[styles.doneBadge, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.2)' : '#E8F5E9' }]}>
                      <Ionicons name="checkmark" size={12} color={theme.success} />
                      <Text style={[styles.doneBadgeText, { color: theme.success }]}>All done</Text>
                    </View>
                  ) : (
                    <View style={[styles.countBadge, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9' }]}>
                      <Text style={[styles.countBadgeText, { color: theme.primary }]}>
                        {item.openCount === 1 ? '1 item' : `${item.openCount} items`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Progress bar */}
                {item.totalCount > 0 ? (
                  <View style={[styles.progressTrack, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: isAllDone ? theme.success : theme.primary,
                          width: `${Math.round(((item.totalCount - item.openCount) / item.totalCount) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                ) : null}

                {/* Live item preview tags */}
                {item.previewItems.length > 0 ? (
                  <View style={styles.previewPillsRow}>
                    {item.previewItems.map((pName, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.previewPill,
                          {
                            backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                            borderColor: isDark ? '#38383A' : '#E5E5EA',
                          },
                        ]}
                      >
                        <Text
                          style={[styles.previewPillText, { color: theme.textSecondary }]}
                          numberOfLines={1}
                        >
                          {pName}
                        </Text>
                      </View>
                    ))}
                    {item.totalCount > item.previewItems.length && (
                      <Text style={[styles.moreCountText, { color: theme.textSecondary }]}>
                        +{item.totalCount - item.previewItems.length} more
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={[styles.previewEmptyText, { color: theme.textSecondary }]}>
                    {item.totalCount === 0 ? 'Empty list • tap to add items' : 'All items checked off'}
                  </Text>
                )}
              </View>

              {/* Overflow action trigger */}
              <Pressable
                onPress={() => {
                  setSelectedList(item);
                  setEditName(item.name);
                  setActionSheetVisible(true);
                }}
                hitSlop={12}
                style={styles.moreBtn}
                accessibilityRole="button"
                accessibilityLabel="List options"
              >
                <Ionicons name="ellipsis-vertical" size={18} color={theme.textSecondary} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      {/* Floating Action Button (FAB) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create new grocery list"
        onPress={() => {
          setCreateError(null);
          setNewListName('');
          setCreateSheetVisible(true);
        }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.primary, shadowColor: theme.primary },
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.fabLabel}>New list</Text>
      </Pressable>

      {/* Create List Bottom Sheet */}
      <Modal
        visible={createSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateSheetVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setCreateSheetVisible(false)}
          />
          <View style={[styles.bottomSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#38383A' : '#D1D5DB' }]} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Create grocery list</Text>
              <Pressable
                onPress={() => setCreateSheetVisible(false)}
                hitSlop={8}
                style={[styles.closeBtn, { backgroundColor: theme.bg }]}
              >
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.quickLabel, { color: theme.textSecondary }]}>QUICK SUGGESTIONS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickScroll}
            >
              {TEMPLATE_SUGGESTIONS.map((tpl) => (
                <Pressable
                  key={tpl.name}
                  style={[styles.quickChip, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.12)' : '#E8F5E9' }]}
                  onPress={() => setNewListName(tpl.name)}
                >
                  <Ionicons name={tpl.icon as keyof typeof Ionicons.glyphMap} size={14} color={theme.primary} />
                  <Text style={[styles.quickChipText, { color: theme.primary }]}>{tpl.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextField
              label="List name"
              value={newListName}
              onChangeText={setNewListName}
              placeholder="e.g. Saturday Oyingbo Market, Party Snacks"
              error={createError}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => submitCreateList(newListName)}
            />

            <View style={styles.sheetActions}>
              <Pressable
                style={[styles.sheetCancelBtn, { borderColor: theme.border }]}
                onPress={() => setCreateSheetVisible(false)}
              >
                <Text style={[styles.sheetCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.sheetConfirmBtn, { backgroundColor: theme.primary }]}
                onPress={() => submitCreateList(newListName)}
              >
                <Text style={styles.sheetConfirmText}>Create list</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* List Action Options Sheet */}
      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setActionSheetVisible(false)}
          />
          <SafeAreaView style={styles.actionSheetContainer}>
            <View style={[styles.actionSheet, { backgroundColor: theme.surface }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#38383A' : '#D1D5DB' }]} />
              <Text style={[styles.actionSheetHeader, { color: theme.text }]} numberOfLines={1}>
                {selectedList?.name}
              </Text>

              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  setActionSheetVisible(false);
                  setRenameModalVisible(true);
                }}
              >
                <View style={[styles.actionIconBox, { backgroundColor: theme.bg }]}>
                  <Ionicons name="pencil-outline" size={20} color={theme.text} />
                </View>
                <Text style={[styles.actionText, { color: theme.text }]}>Rename list</Text>
              </Pressable>

              <Pressable
                style={styles.actionRow}
                onPress={handleDeleteList}
              >
                <View style={[styles.actionIconBox, { backgroundColor: isDark ? 'rgba(255, 69, 58, 0.15)' : '#FEE2E2' }]}>
                  <Ionicons name="trash-outline" size={20} color={theme.danger} />
                </View>
                <Text style={[styles.actionText, { color: theme.danger }]}>Delete list</Text>
              </Pressable>

              <Pressable
                style={[styles.actionRowCancel, { backgroundColor: theme.bg }]}
                onPress={() => setActionSheetVisible(false)}
              >
                <Text style={[styles.actionCancelText, { color: theme.textSecondary }]}>Done</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlayCenter}
        >
          <View style={[styles.dialogCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Rename list</Text>
            <TextField
              label="New name"
              value={editName}
              onChangeText={setEditName}
              placeholder="List name"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRenameList}
            />

            <View style={styles.dialogButtons}>
              <Pressable
                style={[styles.dialogBtnSecondary, { borderColor: theme.border }]}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={[styles.dialogBtnSecondaryText, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.dialogBtnPrimary, { backgroundColor: theme.primary }]}
                onPress={handleRenameList}
              >
                <Text style={styles.dialogBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 96,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: 64,
  },

  // ── Hero & Stats ──
  heroSection: {
    marginBottom: spacing.lg,
  },
  summaryCard: {
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: spacing.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyHouseholdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
    gap: 8,
  },
  emptyHouseholdBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryHomeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  homeBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHomeName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    gap: 5,
    borderWidth: 1,
  },
  codePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  newLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  newLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Cards ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md + 2,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: spacing.xs,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    gap: 3,
  },
  doneBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    height: 3.5,
    borderRadius: 2,
    marginVertical: 6,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  previewPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  previewPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 110,
  },
  previewPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  moreCountText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 2,
  },
  previewEmptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  moreBtn: {
    paddingLeft: spacing.sm,
    paddingVertical: spacing.sm,
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    gap: spacing.xs,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  suggestionsHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  templatesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  templateChipText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Bottom Sheets ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  quickScroll: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  sheetCancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheetConfirmBtn: {
    flex: 2,
    minHeight: 48,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  sheetConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Action Sheet ──
  actionSheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  actionSheet: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  actionSheetHeader: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionRowCancel: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.input,
  },
  actionCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Dialog ──
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  dialogCard: {
    borderRadius: 20,
    padding: spacing.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dialogBtnSecondary: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dialogBtnPrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
