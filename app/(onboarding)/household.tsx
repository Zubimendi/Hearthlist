// app/(onboarding)/household.tsx
// Household onboarding: Create a home or join family with an invite code.
// Designed with crafted, premium typography, domestic aesthetic, and safe logout options.

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, useTheme, type ThemeColors } from '@/ui/theme';
import { TextField } from '@/ui/components/TextField';
import { createHousehold, joinHousehold } from '@/api/household';
import { syncEngine } from '@/sync/engine';
import { signOut, refreshAuth, getCurrentUser } from '@/api/auth';
import { clearHouseholdData, saveHousehold } from '@/db/repositories/household';
import { pb } from '@/api/pb';
import { toast } from '@/ui/feedback/toast';

export default function HouseholdOnboardingScreen(): React.ReactElement {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingServer, setCheckingServer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // On mount: check if the user is ALREADY associated with a household on the server
  useEffect(() => {
    async function checkServerHousehold(): Promise<void> {
      setCheckingServer(true);
      try {
        const refreshed = await refreshAuth();
        const hhId = refreshed.ok ? refreshed.value.householdId : getCurrentUser()?.householdId;

        if (hhId) {
          const serverHh = await pb.collection('households').getOne(hhId);
          const raw = serverHh as unknown as Record<string, unknown>;
          await saveHousehold({
            id: serverHh.id,
            name: String(raw.name || 'My Household'),
            inviteCode: String(raw.invite_code || ''),
            createdAt: Date.now(),
          });
          syncEngine.start();
          syncEngine.requestSync();
          router.replace('/(tabs)');
          return;
        }
      } catch (err) {
        console.warn('Check server household on onboarding mount:', err);
      } finally {
        setCheckingServer(false);
      }
    }

    checkServerHousehold();
  }, [router]);

  const handleSignOut = async (): Promise<void> => {
    try {
      syncEngine.stop();
      await signOut();
      await clearHouseholdData();
      router.replace('/(auth)/welcome');
    } catch (e) {
      console.warn('Sign out error:', e);
      router.replace('/(auth)/welcome');
    }
  };

  const handleCreate = async (): Promise<void> => {
    setErrorMessage(null);
    const trimmed = householdName.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a name for your home (e.g. The Offiong Home).');
      return;
    }

    setLoading(true);
    try {
      const res = await createHousehold(trimmed);
    if (res.ok) {
      await refreshAuth();
      syncEngine.start();
      syncEngine.requestSync();
      toast.success(`Welcome to ${trimmed}!`);
      router.replace('/(tabs)');
      return;
    }

    if (!res.ok) {
      // If already in a household, recover it from server
      if (res.error.message?.toLowerCase().includes('already in a household')) {
        const refreshed = await refreshAuth();
        if (refreshed.ok && refreshed.value.householdId) {
          const serverHh = await pb.collection('households').getOne(refreshed.value.householdId);
          const raw = serverHh as unknown as Record<string, unknown>;
          await saveHousehold({
            id: serverHh.id,
            name: String(raw.name || trimmed),
            inviteCode: String(raw.invite_code || ''),
            createdAt: Date.now(),
          });
          syncEngine.start();
          syncEngine.requestSync();
          toast.success(`Connected to ${raw.name || trimmed}`);
          router.replace('/(tabs)');
          return;
        }
      }
      setErrorMessage(res.error.message || 'Could not create household. Please try again.');
      toast.error(res.error.message || 'Could not create household.');
      return;
    }
    } catch {
      setErrorMessage('Network error. Check your connection to PocketBase.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (): Promise<void> => {
    setErrorMessage(null);
    const code = inviteCode.trim().toUpperCase();
    if (code.length !== 6) {
      setErrorMessage('Invite codes are exactly 6 characters (e.g. ABC234).');
      return;
    }

    setLoading(true);
    try {
      const res = await joinHousehold(code);
      if (!res.ok) {
        setErrorMessage(res.error.message || "That invite code wasn't found. Please check with your household.");
        toast.error("Invite code wasn't found");
        return;
      }

      await refreshAuth();
      syncEngine.start();
      syncEngine.requestSync();
      toast.success('Joined household successfully!');
      router.replace('/(tabs)');
    } catch {
      setErrorMessage('Could not connect to verify invite code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top action bar with Sign Out */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="home-outline" size={18} color={theme.primary} />
          <Text style={styles.topBarTitle}>Household Setup</Text>
        </View>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sign out of account"
        >
          <Ionicons name="log-out-outline" size={16} color={theme.danger} />
          <Text style={styles.signOutBtnText}>Log out</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero section ── */}
          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <Ionicons name="home" size={32} color={theme.surface} />
            </View>
            <Text style={styles.heroTitle}>Your shared home</Text>
            <Text style={styles.heroSubtitle}>
              Create a shared space for your groceries, or join an existing household.
            </Text>
          </View>

          {/* ── Segmented Selector ── */}
          <View style={styles.segmentContainer}>
            <Pressable
              style={[styles.segmentBtn, mode === 'create' && styles.segmentBtnActive]}
              onPress={() => {
                setMode('create');
                setErrorMessage(null);
              }}
              accessibilityRole="tab"
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={mode === 'create' ? theme.primary : theme.textSecondary}
              />
              <Text style={[styles.segmentText, mode === 'create' && styles.segmentTextActive]}>
                Start fresh
              </Text>
            </Pressable>

            <Pressable
              style={[styles.segmentBtn, mode === 'join' && styles.segmentBtnActive]}
              onPress={() => {
                setMode('join');
                setErrorMessage(null);
              }}
              accessibilityRole="tab"
            >
              <Ionicons
                name="key-outline"
                size={18}
                color={mode === 'join' ? theme.primary : theme.textSecondary}
              />
              <Text style={[styles.segmentText, mode === 'join' && styles.segmentTextActive]}>
                Join with code
              </Text>
            </Pressable>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>
            {checkingServer ? (
              <View style={styles.checkingBox}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={styles.checkingText}>Checking your account for existing households...</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.danger} />
                <Text style={styles.errorBoxText}>{errorMessage}</Text>
              </View>
            ) : null}

            {mode === 'create' ? (
              <View>
                <View style={styles.infoRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.infoText}>
                    You’ll get an invite code to share with anyone who buys groceries with you.
                  </Text>
                </View>

                <TextField
                  label="Household name"
                  value={householdName}
                  onChangeText={setHouseholdName}
                  placeholder="e.g. The Offiong Home, Lagos Flat 4"
                  autoCapitalize="words"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />

                <Pressable
                  onPress={handleCreate}
                  disabled={loading}
                  style={[styles.actionBtn, loading && styles.btnDisabled]}
                  accessibilityRole="button"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.actionBtnText}>Create household</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <View>
                <View style={styles.infoRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.infoText}>
                    Ask someone in your house to check the "Household" tab for the 6-character code.
                  </Text>
                </View>

                <TextField
                  label="6-character invite code"
                  value={inviteCode}
                  onChangeText={(t) => setInviteCode(t.toUpperCase())}
                  placeholder="e.g. FQGV4G"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleJoin}
                />

                <Pressable
                  onPress={handleJoin}
                  disabled={loading}
                  style={[styles.actionBtn, loading && styles.btnDisabled]}
                  accessibilityRole="button"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.actionBtnText}>Join household</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    topBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    topBarTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      backgroundColor: isDark ? 'rgba(185, 28, 28, 0.25)' : '#FEE2E2',
      gap: 4,
    },
    signOutBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.danger,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      justifyContent: 'center',
    },
    hero: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    iconCircle: {
      width: 68,
      height: 68,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: spacing.xs,
    },
    heroSubtitle: {
      ...typography.body,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: spacing.md,
    },
    segmentContainer: {
      flexDirection: 'row',
      backgroundColor: theme.border,
      borderRadius: radius.pill,
      padding: 3,
      marginBottom: spacing.lg,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: radius.pill,
      gap: spacing.xs,
    },
    segmentBtnActive: {
      backgroundColor: theme.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    segmentTextActive: {
      color: theme.text,
      fontWeight: '600',
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 3,
    },
    checkingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(48, 209, 88, 0.15)' : '#E8F5E9',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(48, 209, 88, 0.3)' : '#C8E6C9',
      borderRadius: 10,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    checkingText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '500',
      flex: 1,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.bg,
      borderRadius: radius.card,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.primary,
      marginTop: 7,
    },
    infoText: {
      ...typography.caption,
      color: theme.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(185, 28, 28, 0.15)' : '#FEF2F2',
      borderColor: isDark ? '#7F1D1D' : '#FECACA',
      borderWidth: 1,
      borderRadius: 10,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    errorBoxText: {
      ...typography.caption,
      color: theme.danger,
      flex: 1,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      minHeight: 52,
      borderRadius: radius.input,
      marginTop: spacing.sm,
      gap: spacing.sm,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 4,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    actionBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
  });
}
