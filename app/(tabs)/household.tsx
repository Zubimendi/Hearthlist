// app/(tabs)/household.tsx
// Household screen: displays household name, invite code with copy/share, and member list.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, radius, typography, useTheme } from '@/ui/theme';
import { Screen } from '@/ui/components/Screen';
import { Button } from '@/ui/components/Button';
import { db } from '@/db/client';
import { households, members, type Household, type Member } from '@/db/schema';
import { clearHouseholdData } from '@/db/repositories/household';
import { fetchHouseholdMembers } from '@/api/household';
import { getCurrentUser } from '@/api/auth';
import { syncEngine } from '@/sync/engine';
import { toast } from '@/ui/feedback/toast';

export default function HouseholdScreen(): React.ReactElement {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [household, setHousehold] = useState<Household | null>(null);
  const [memberList, setMemberList] = useState<Member[]>([]);
  const currentUser = getCurrentUser();

  const loadData = useCallback((): void => {
    try {
      const hh = db.select().from(households).get();
      if (hh) {
        setHousehold(hh);
        const mems = db.select().from(members).all();
        setMemberList(mems);
      }
    } catch (e) {
      console.warn('Error loading household data', e);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Fetch latest members from server if online
    if (household?.id) {
      fetchHouseholdMembers(household.id).then(() => {
        loadData();
      });
    }
  }, [household?.id, loadData]);

  const handleCopyCode = async (): Promise<void> => {
    if (!household?.inviteCode) return;
    await Clipboard.setStringAsync(household.inviteCode);
    toast.success('Invite code copied to clipboard!');
  };

  const handleShareCode = async (): Promise<void> => {
    if (!household?.inviteCode) return;
    try {
      await Share.share({
        message: `Join my household "${household.name}" on Hearthlist using invite code: ${household.inviteCode}`,
      });
    } catch {
      // Ignored
    }
  };

  const handleLeaveHousehold = (): void => {
    Alert.alert(
      'Leave Household',
      'Are you sure you want to leave this household? Your local lists will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            syncEngine.stop();
            await clearHouseholdData();
            toast.info('Left household');
            router.replace('/(onboarding)/household');
          },
        },
      ]
    );
  };

  return (
    <Screen title="Household" showSyncChip>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Household Info Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.hhHeaderRow}>
            <View style={[styles.homeIconCircle, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9' }]}>
              <Ionicons name="home" size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>YOUR HOME</Text>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {household?.name || 'Our Home'}
              </Text>
            </View>
            <View style={[styles.livePill, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9' }]}>
              <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.liveText, { color: theme.success }]}>In Sync</Text>
            </View>
          </View>

          {/* Invite Code Showcase */}
          <View style={[styles.codeBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Pressable onPress={handleCopyCode} style={{ flex: 1 }}>
              <Text style={[styles.codeLabel, { color: theme.textSecondary }]}>
                HOUSEHOLD INVITE CODE
              </Text>
              <Text style={[styles.codeValue, { color: theme.text }]}>
                {household?.inviteCode || '------'}
              </Text>
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy invite code"
                onPress={handleCopyCode}
                style={({ pressed }) => [
                  styles.shareBtn,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderWidth: 1,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="copy-outline" size={15} color={theme.text} />
                <Text style={[styles.shareText, { color: theme.text }]}>Copy</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share invite code"
                onPress={handleShareCode}
                style={({ pressed }) => [
                  styles.shareBtn,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="share-outline" size={15} color="#FFFFFF" />
                <Text style={[styles.shareText, { color: '#FFFFFF' }]}>Share</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Member List */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.membersHeaderRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              FAMILY MEMBERS ({memberList.length || 1})
            </Text>
            <Ionicons name="people" size={16} color={theme.textSecondary} />
          </View>

          {memberList.length > 0 ? (
            memberList.map((m, idx) => {
              const isYou = currentUser?.id === m.id || m.displayName === currentUser?.displayName;
              const isLast = idx === memberList.length - 1;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.memberRow,
                    { borderBottomColor: theme.border, borderBottomWidth: isLast ? 0 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: isYou ? theme.primary : (isDark ? '#2C2C2E' : '#E5E5EA'),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        { color: isYou ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      {m.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.memberName, { color: theme.text }]}>
                    {m.displayName}
                  </Text>
                  {isYou ? (
                    <View
                      style={[
                        styles.youBadge,
                        {
                          backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9',
                          borderColor: theme.primary,
                        },
                      ]}
                    >
                      <Text style={[styles.youText, { color: theme.primary }]}>You</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={[styles.memberRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                <Text style={[styles.avatarText, { color: '#FFFFFF' }]}>
                  {currentUser?.displayName?.charAt(0).toUpperCase() || 'Y'}
                </Text>
              </View>
              <Text style={[styles.memberName, { color: theme.text }]}>
                {currentUser?.displayName || 'You'}
              </Text>
              <View
                style={[
                  styles.youBadge,
                  {
                    backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9',
                    borderColor: theme.primary,
                  },
                ]}
              >
                <Text style={[styles.youText, { color: theme.primary }]}>You</Text>
              </View>
            </View>
          )}
        </View>

        {/* Leave Household */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave household"
          onPress={handleLeaveHousehold}
          style={({ pressed }) => [
            styles.leaveBtn,
            {
              backgroundColor: isDark ? 'rgba(255, 59, 48, 0.12)' : '#FEE2E2',
              borderColor: isDark ? 'rgba(255, 59, 48, 0.25)' : '#FECACA',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="exit-outline" size={16} color={theme.danger} />
          <Text style={[styles.leaveBtnText, { color: theme.danger }]}>Leave household</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  card: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  hhHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  homeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
  },
  membersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  codeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  codeValue: {
    fontSize: 22,
    letterSpacing: 2.5,
    fontWeight: '800',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  shareText: {
    fontSize: 12,
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  youText: {
    fontSize: 11,
    fontWeight: '700',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    marginTop: spacing.xs,
  },
  leaveBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
