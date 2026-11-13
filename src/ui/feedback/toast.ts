// src/ui/feedback/toast.ts
// Global feedback notification engine with tactile haptics.

import { create } from 'zustand';
import * as Haptics from 'expo-haptics';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastPayload {
  id: string;
  message: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastState {
  currentToast: ToastPayload | null;
  show: (options: {
    message: string;
    type?: ToastType;
    actionLabel?: string;
    onAction?: () => void;
    duration?: number;
  }) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  currentToast: null,
  show: (options) => {
    const id = Math.random().toString(36).substring(2, 9);
    const type = options.type || 'info';

    // Trigger immediate tactile response
    try {
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Haptics fail gracefully where unsupported
    }

    set({
      currentToast: {
        id,
        message: options.message,
        type,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
        duration: options.duration || 3000,
      },
    });
  },
  dismiss: () => set({ currentToast: null }),
}));

export const toast = {
  show: (message: string, options?: Omit<Parameters<ToastState['show']>[0], 'message'>) =>
    useToastStore.getState().show({ message, ...options }),
  success: (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) =>
    useToastStore.getState().show({ message, type: 'success', ...options }),
  info: (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) =>
    useToastStore.getState().show({ message, type: 'info', ...options }),
  error: (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) =>
    useToastStore.getState().show({ message, type: 'error', ...options }),
  dismiss: () => useToastStore.getState().dismiss(),
};
