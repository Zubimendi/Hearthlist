// app/(auth)/welcome.tsx
// Sign-in and sign-up screen. Designed to feel crafted, not generated.

import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Animated,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, typography, minTouchTarget, useTheme, type ThemeColors } from '@/ui/theme';
import { signIn, signUp } from '@/api/auth';
import { syncEngine } from '@/sync/engine';
import { toast } from '@/ui/feedback/toast';

// ─── Field component ──────────────────────────────────────────────────────────

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  isPassword?: boolean;
}

function Field({ label, error, isPassword, ...inputProps }: FieldProps): React.ReactElement {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? theme.danger : theme.border, error ? theme.danger : theme.primary],
  });

  return (
    <View style={fieldStyles.wrapper}>
      <Text style={[fieldStyles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Animated.View
        style={[
          fieldStyles.inputRow,
          {
            backgroundColor: theme.surface,
            borderColor,
          },
        ]}
      >
        <TextInput
          style={[fieldStyles.input, { color: theme.text }]}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={isPassword && !visible}
          onFocus={onFocus}
          onBlur={onBlur}
          autoCorrect={false}
          {...inputProps}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setVisible(v => !v)}
            hitSlop={8}
            style={fieldStyles.eyeBtn}
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={focused ? theme.primary : theme.textSecondary}
            />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <Text style={[fieldStyles.errorText, { color: theme.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  eyeBtn: {
    paddingLeft: spacing.sm,
    minWidth: 32,
    alignItems: 'center',
  },
  errorText: {
    ...typography.caption,
    marginTop: 4,
  },
});

// ─── Submit button ─────────────────────────────────────────────────────────────

interface SubmitButtonProps {
  label: string;
  onPress: () => void;
  loading: boolean;
}

function SubmitButton({ label, onPress, loading }: SubmitButtonProps): React.ReactElement {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={loading}
        style={[
          submitStyles.btn,
          {
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ busy: loading }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={submitStyles.label}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const submitStyles = StyleSheet.create({
  btn: {
    borderRadius: radius.input,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }): React.ReactElement {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        bannerStyles.row,
        {
          backgroundColor: isDark ? 'rgba(185, 28, 28, 0.15)' : '#FEF2F2',
          borderColor: isDark ? '#7F1D1D' : '#FECACA',
        },
      ]}
    >
      <Ionicons
        name="alert-circle-outline"
        size={16}
        color={theme.danger}
        style={bannerStyles.icon}
      />
      <Text style={[bannerStyles.text, { color: theme.danger }]} accessibilityRole="alert">
        {message}
      </Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WelcomeScreen(): React.ReactElement {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'signup';

  const switchMode = () => {
    setMode(m => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
  };

  const validate = (): string | null => {
    if (isSignUp && !displayName.trim()) return 'Please enter your name.';
    if (!email.trim() || !email.includes('@')) return 'Enter a valid email address.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  };

  const handleSubmit = async (): Promise<void> => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const res = await signUp({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
        if (!res.ok) {
          const msg = res.error.message || 'Could not create account. Try again.';
          setError(msg);
          toast.error(msg);
          return;
        }
        syncEngine.start();
        toast.success(`Welcome to Hearthlist, ${displayName.trim()}!`);
        router.replace('/(onboarding)/household');
      } else {
        const res = await signIn({ email: email.trim(), password });
        if (!res.ok) {
          setError('Incorrect email or password.');
          toast.error('Incorrect email or password.');
          return;
        }
        syncEngine.start();
        toast.success(`Welcome back, ${res.value.displayName || 'friend'}!`);
        router.replace(res.value.householdId ? '/(tabs)' : '/(onboarding)/household');
      }
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
      toast.error("Can't reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand mark ── */}
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Ionicons name="home" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.appName}>Hearthlist</Text>
            <Text style={styles.tagline}>Your household, in sync.</Text>
          </View>

          {/* ── Tab switcher ── */}
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, mode === 'signin' && styles.tabActive]}
              onPress={() => { setMode('signin'); setError(null); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'signin' }}
            >
              <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>
                Sign in
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); setError(null); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'signup' }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                Create account
              </Text>
            </Pressable>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>
            {error ? <ErrorBanner message={error} /> : null}

            {isSignUp ? (
              <Field
                label="Your name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Francis"
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
              />
            ) : null}

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
            />

            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={isSignUp ? 'At least 8 characters' : '••••••••'}
              isPassword
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <SubmitButton
              label={isSignUp ? 'Create account' : 'Sign in'}
              onPress={handleSubmit}
              loading={loading}
            />
          </View>

          {/* ── Mode switch link ── */}
          <View style={styles.switchRow}>
            <Text style={styles.switchPrompt}>
              {isSignUp ? 'Already have an account?' : 'New to Hearthlist?'}
            </Text>
            <Pressable onPress={switchMode} hitSlop={8} accessibilityRole="button">
              <Text style={styles.switchLink}>
                {isSignUp ? ' Sign in' : ' Create account'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
      justifyContent: 'center',
    },

    // Brand
    brand: {
      alignItems: 'center',
      marginBottom: spacing.xxl + spacing.lg,
    },
    logoMark: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    appName: {
      fontSize: 26,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    tagline: {
      ...typography.body,
      color: theme.textSecondary,
    },

    // Tabs
    tabRow: {
      flexDirection: 'row',
      backgroundColor: theme.border,
      borderRadius: radius.pill,
      padding: 3,
      marginBottom: spacing.xl,
    },
    tab: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: radius.pill,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: theme.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.text,
      fontWeight: '600',
    },

    // Card
    card: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
      marginBottom: spacing.xl,
    },

    // Switch
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: minTouchTarget,
    },
    switchPrompt: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    switchLink: {
      ...typography.caption,
      color: theme.primary,
      fontWeight: '600',
    },
  });
}
