# Hearthlist: Agent Context (Cursor)

Read this file, `docs/architecture.md`, `docs/prd.md` and `docs/design.md` before writing code. Work one task at a time from section 12. After each task, stop, summarize what changed, and wait for the next instruction.

## 1. Project snapshot

Hearthlist is an offline-first shared household grocery list. React Native (Expo, TypeScript strict). SQLite (Drizzle) is the source of truth. A custom outbox sync engine talks to a PocketBase backend. No paid services.

## 2. Non-negotiable rules

1. UI code never calls the network. Only the sync engine and the auth and household modules in `src/api/` touch PocketBase.
2. UI code never writes tables directly. All writes go through repository functions in `src/db/repositories/`.
3. Every repository write updates the entity table and inserts the outbox row in **one transaction**.
4. UI reads data through Drizzle live queries (`useLiveQuery`), not through fetch calls.
5. Tokens live in `expo-secure-store`, never in AsyncStorage or plain state.
6. No new dependency without a one-line justification and my approval.
7. No paid SDKs or services. No analytics SDKs.
8. No raw color, spacing or font-size literals in components. Use tokens from `src/ui/theme`.
9. No `any`. No `// @ts-ignore` without an explanatory comment and my approval.
10. When editing existing files, make minimal diffs. Do not rewrite whole files or reformat unrelated code.
11. Do not invent library APIs. If unsure, read the package's installed types in `node_modules` or its docs, and say what you checked.
12. Do not leave silent TODOs. If something is deferred, say so in your summary.

## 3. Tech stack and install policy

- Expo (current SDK) with Expo Router, TypeScript strict
- Install Expo-compatible packages with `npx expo install <pkg>` so versions match the SDK
- Data: `expo-sqlite`, `drizzle-orm`, `drizzle-kit`. Open the database with change listeners enabled (`enableChangeListener: true`) so live queries work (verify against the installed versions)
- Migrations: follow Drizzle's Expo SQLite guide (generated SQL migrations, migrator hook at app start; needs the Babel inline-import plugin and Metro `sql` source extension)
- UI state: Zustand (UI-only: sheet visibility, theme preference, toast queue)
- Lists and motion: `@shopify/flash-list`, `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`
- Network: PocketBase JS SDK, `@react-native-community/netinfo`, URL polyfill, an EventSource polyfill for realtime (for example `react-native-sse`; verify)
- Secure storage: `expo-secure-store` with a PocketBase async auth store
- IDs: 15-character lowercase alphanumeric strings (PocketBase-compatible), generated with a small `nanoid` custom alphabet; IDs are not secrets
- Tests: Jest (`jest-expo` for RN pieces; plain Jest for pure logic and sync engine), `better-sqlite3` for DB tests if Drizzle types are compatible (verify; otherwise test pure logic only)
- Lint and format: ESLint, Prettier

## 4. Folder structure

```text
app/                         routes only; no business logic
  (auth)/welcome.tsx
  (onboarding)/household.tsx
  (tabs)/index.tsx           Lists
  (tabs)/household.tsx
  (tabs)/settings.tsx
  list/[id].tsx
src/
  db/
    schema.ts                Drizzle tables
    client.ts                database handle
    migrations/              generated SQL
    repositories/            lists.ts, items.ts, household.ts, outbox.ts
  sync/
    engine.ts                orchestration and triggers
    outbox.ts                coalescing and queue ops
    push.ts                  drain logic
    pull.ts                  cursor-based pull
    realtime.ts              SSE subscription
    backoff.ts               pure function
    merge.ts                 pure apply rules
    status.ts                derived sync status
  api/
    pb.ts                    PocketBase client and auth store
    auth.ts                  sign up, sign in, refresh, sign out
    household.ts             create and join (custom routes)
    errors.ts                error taxonomy mapping
  features/                  hooks and components per feature
  ui/                        theme tokens and shared components
  lib/                       id.ts, clock.ts, logger.ts, parseQuickAdd.ts
  data/catalog.ts            categories, units, common items (include Nigerian staples)
backend/
  pb_hooks/                  custom routes and conflict guards
  pb_migrations/             collections and API rules as code
docs/
```

## 5. Architecture rules (data flow)

- **Read path:** screen hook, Drizzle live query on SQLite, render.
- **Write path:** UI action, repository function, one transaction (entity update plus outbox insert), live query emits instantly, `requestSync()` called (debounced).
- **Sync path:** engine coalesces outbox, pushes, handles responses, pulls changes since cursor, merges into SQLite, updates status.
- **Clock:** use `now()` from `src/lib/clock.ts`, a monotonic per-device millisecond clock (`max(Date.now(), last + 1)`). Never call `Date.now()` directly for stored timestamps.
- **IDs:** use `newId()` from `src/lib/id.ts` only.
- **Timestamps:** integer milliseconds since epoch everywhere.

## 6. Data model

Defined in `docs/architecture.md` section 4. Items have two timestamp groups: `content_at` (name, quantity, unit, note, category) and `state_at` (checked, checked_by, checked_at, deleted_at). Update the relevant timestamp only when a field in that group changes.

## 7. Sync engine rules

- Coalesce the outbox before each drain: create plus updates become one create with final state; consecutive updates keep the latest per field group; create then delete for an unsynced entity drops both; update then delete becomes delete.
- Process in `seq` order, lists before items.
- Retryable errors: network failure, timeout, 5xx, 429. Backoff base 2 s, factor 2, jitter plus or minus 20%, cap 5 minutes. Reset on connectivity regained and on app foreground.
- Permanent errors (400, 403, 422): park the op (`status = 'parked'`), store `last_error`, continue with other ops. Park dependent child ops if their parent is parked.
- 401: refresh the token once; if refresh fails with a confirmed network, set status to "needs sign-in" but keep local use and queue intact. Never wipe data on session expiry.
- 409 `stale_write`: fetch the server record, apply it, delete the op.
- Duplicate create (record exists): treat as success after a GET.
- Delete 404: treat as success.
- Pull with `updated >= cursor`, sorted by `updated,id`, 200 per page, re-applying idempotently.
- If an entity has pending outbox ops, do not overwrite it from a pull or realtime event; the push response and the following pull will converge it.
- After realtime reconnects, run a pull.
- Start the engine after first interactive render, not during module load.

## 8. Error handling rules

- Use a `Result<T, AppError>` pattern in repositories and API wrappers; avoid throwing across layers.
- Map every error through `src/api/errors.ts` to one of: `network`, `transient`, `auth`, `forbidden`, `validation`, `conflict`, `notFound`, `local`, `unknown`.
- UI never displays raw error strings. Use the microcopy table in `docs/design.md`.
- Each route exports an Expo Router `ErrorBoundary` so one screen failing does not take down the app.
- Log with `src/lib/logger.ts` (interface with a console implementation; a Sentry implementation can be swapped in). Log ids and error classes, never item content or emails.

## 9. UI rules

- Follow `docs/design.md` exactly: tokens, spacing, 48 dp targets, sync chip states, microcopy.
- Every interactive element gets `accessibilityRole`, `accessibilityLabel` and `accessibilityState`.
- Respect reduce motion.
- Lists use FlashList with memoized row components and stable keys; no inline arrow functions in row render paths.
- Use system fonts only.

## 10. Testing rules

- Pure modules (`backoff`, `merge`, `outbox` coalescing, `parseQuickAdd`, invite-code validation) must have unit tests before they are used.
- Sync engine integration test with a fake server supporting injected failures: network error, 500, 429, 401, 409, duplicate create, crash between server success and outbox delete.
- Run `npm run typecheck`, `npm run lint` and `npm test` before declaring a task done.
- Manual test matrix: `docs/architecture.md` section 14.

## 11. Code style

- TypeScript strict; explicit return types on exported functions
- Components `PascalCase.tsx`; other files `camelCase.ts`
- Path alias `@/` maps to `src/`
- Small functions, one responsibility; comments explain why, not what
- Conventional Commits, one commit per task

## 12. Build order

Each task is done only when its acceptance check passes.

| Task | Work | Acceptance |
|---|---|---|
| T1 | Scaffold Expo app with TypeScript strict, Expo Router, ESLint, Prettier, path alias | App boots on emulator; typecheck and lint pass |
| T2 | PocketBase backend: collections, API rules, custom routes stub, migrations committed | Admin UI shows collections; rules reject cross-household access (manual check) |
| T3 | Theme tokens and base components (`Button`, `TextField`, `Chip`, `Screen`, `EmptyState`) | Light and dark render; no raw literals |
| T4 | Drizzle schema, client with change listener, generated migration, migrator at startup | DB created on first launch; schema matches architecture doc |
| T5 | `clock`, `id`, `logger`, `errors` utilities with tests | Tests pass |
| T6 | Repositories for lists, items, outbox with transactional writes | A write creates an entity row and an outbox row atomically (test) |
| T7 | PocketBase client, secure-store auth store, sign up and sign in, persistent session | Sign in, kill app, reopen offline: still signed in |
| T8 | Household create and join via custom routes; household screen | Two accounts share one household |
| T9 | Lists screen with live query, create, rename, archive, delete | Works in airplane mode |
| T10 | List detail with FlashList, categories, Done section, quick-add, check, edit sheet, delete plus undo | All P0 and P1 item stories pass offline |
| T11 | `parseQuickAdd` plus suggestions plus catalog | Parser examples in PRD pass |
| T12 | Outbox coalescing and `backoff` pure modules with tests | Tests pass |
| T13 | Push (drain) with error handling table | Integration test passes for all injected failures |
| T14 | Pull with cursor and `merge` | Second device sees first device's data |
| T15 | Sync status derivation and `SyncChip` | All 5 states reachable |
| T16 | Conflict hooks on the backend (LWW per group, clamp) | Conflict matrix passes |
| T17 | Sync center (failed ops, retry, discard, sync now) | A forced permanent error appears and can be discarded |
| T18 | Realtime subscription plus catch-up pull | Change on device A appears on B within 5 s |
| T19 | Auth expiry handling and sign-out warning | Expired token offline keeps data and shows a banner |
| T20 | Error boundaries, empty and loading states, accessibility pass | Screen reader and 200% font checks pass |
| T21 | Performance pass and measurements | Budgets from PRD recorded |
| T22 | Dark theme and settings | Theme persists |
| T23 | README, scripts, final docs sync | New clone runs from README alone |

## 13. Definition of done (every task)

- Acceptance check passes
- `npm run typecheck`, `npm run lint`, `npm test` green
- No new dependency without approval
- No raw literals in UI; accessibility props present
- Summary lists files changed, decisions made and anything deferred

## 14. Stop and ask when

- A requirement in the docs conflicts with a library's actual behavior
- A new dependency seems necessary
- Backend hook behavior differs from the architecture doc
- You would need to change the data model

## 15. Starter prompts

> "Read cursorcontext.md, architecture.md, prd.md and design.md. Do T1 only. Stop when its acceptance check passes and summarize."

> "Do T13. Before coding, list the error cases you will handle and the test you will write for each."