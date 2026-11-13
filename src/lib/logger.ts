// src/lib/logger.ts
// Logger interface with a console implementation.
// A Sentry/GlitchTip implementation can be swapped in without touching call sites.
// Rule: never log item content, emails, or tokens — only IDs and error classes.

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  /** Lightweight event for sync tracing — no PII. */
  breadcrumb(msg: string, ctx?: Record<string, unknown>): void;
}

const consoleLogger: Logger = {
  debug: (msg, ctx) => __DEV__ && console.debug('[Hearthlist]', msg, ctx ?? ''),
  info: (msg, ctx) => __DEV__ && console.info('[Hearthlist]', msg, ctx ?? ''),
  warn: (msg, ctx) => console.warn('[Hearthlist]', msg, ctx ?? ''),
  error: (msg, ctx) => console.error('[Hearthlist]', msg, ctx ?? ''),
  breadcrumb: (msg, ctx) => __DEV__ && console.log('[breadcrumb]', msg, ctx ?? ''),
};

export let logger: Logger = consoleLogger;

export function setLogger(impl: Logger): void {
  logger = impl;
}
