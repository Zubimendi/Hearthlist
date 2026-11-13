// src/api/errors.ts
// Error taxonomy for all layers. UI code and repositories use Result<T> and AppError.
// Raw error strings from fetch or PocketBase never reach the UI.

export type ErrorClass =
  | 'network'    // fetch failed, timeout, offline
  | 'transient'  // 5xx, 429 — retry with backoff
  | 'auth'       // 401 — refresh once, then park
  | 'forbidden'  // 403 — park permanently
  | 'validation' // 400, 422 — park permanently
  | 'conflict'   // 409 stale_write — apply server record
  | 'notFound'   // 404 on delete — treat as success
  | 'local'      // SQLite failure
  | 'unknown';   // JS exceptions

export interface AppError {
  class: ErrorClass;
  message: string;
  raw?: unknown;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(cls: ErrorClass, message: string, raw?: unknown): Result<never> {
  return { ok: false, error: { class: cls, message, raw } };
}

/** Map any thrown value to a typed AppError. */
export function mapError(raw: unknown): AppError {
  if (raw instanceof Error) {
    const msg = raw.message.toLowerCase();
    if (
      msg.includes('network request failed') ||
      msg.includes('fetch') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound')
    ) {
      return { class: 'network', message: raw.message, raw };
    }
  }

  if (typeof raw === 'object' && raw !== null && 'status' in raw) {
    const status = (raw as { status: number }).status;
    const data = 'data' in raw ? (raw as { data?: Record<string, unknown> }).data : undefined;
    const code = data && 'code' in data ? String(data.code) : '';

    if (status === 401) return { class: 'auth', message: 'Unauthorized', raw };
    if (status === 403) return { class: 'forbidden', message: 'Forbidden', raw };
    if (status === 404) return { class: 'notFound', message: 'Not found', raw };
    if (status === 409 && code === 'stale_write')
      return { class: 'conflict', message: 'Stale write', raw };
    if (status === 422 || status === 400)
      return { class: 'validation', message: 'Validation error', raw };
    if (status === 429 || status >= 500)
      return { class: 'transient', message: 'Server error', raw };
  }

  return { class: 'unknown', message: String(raw), raw };
}

/** Convenience: wrap an async call and map errors to Result. */
export async function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return { ok: false, error: mapError(e) };
  }
}
