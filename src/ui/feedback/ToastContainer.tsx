// src/ui/feedback/ToastContainer.tsx
// Global toast overlay with spring animation, haptics, and action buttons (e.g. Undo).

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore, toast, type ToastType } from './toast';
import { spacing, radius, typography, useTheme } from '../theme';

function getIcon(type: ToastType): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case 'success':
      return { name: 'checkmark-circle', color: '#34C759' };
    case 'error':
      return { name: 'alert-circle', color: '#FF3B30' };
    case 'info':
    default:
      return { name: 'information-circle', color: '#8E8E93' };
  }
}

export function ToastContainer(): React.ReactElement | null {
  const currentToast = useToastStore((s) => s.currentToast);
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const anim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentToast) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    // Animate in
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 6,
      speed: 16,
    }).start();

    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Auto dismiss
    timerRef.current = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        toast.dismiss();
      });
    }, currentToast.duration || 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentToast, anim]);

  if (!currentToast) return null;

  const icon = getIcon(currentToast.type);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const bottomOffset = Math.max(insets.bottom + 80, 96);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.portal, { bottom: bottomOffset }]}
    >
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: isDark ? '#2C2C2E' : '#1C1C1E',
            borderColor: isDark ? '#48484A' : '#38383A',
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <Ionicons name={icon.name} size={20} color={icon.color} style={styles.icon} />
        <Text style={styles.message} numberOfLines={2}>
          {currentToast.message}
        </Text>

        {currentToast.actionLabel && currentToast.onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={currentToast.actionLabel}
            onPress={() => {
              const action = currentToast.onAction;
              toast.dismiss();
              action?.();
            }}
            hitSlop={8}
            style={styles.actionBtn}
          >
            <Text style={styles.actionText}>{currentToast.actionLabel}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
            onPress={() => toast.dismiss()}
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={16} color="#8E8E93" />
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  portal: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card * 1.5,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  icon: {
    marginRight: spacing.sm + 2,
  },
  message: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    color: '#F5F5F7',
    flex: 1,
  },
  actionBtn: {
    marginLeft: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  actionText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#34C759',
  },
  closeBtn: {
    marginLeft: spacing.sm,
    padding: 4,
  },
});
