# Hearthlist: Product Requirements Document

| Field | Value |
|---|---|
| Owner | Francis Offiong |
| Status | Draft v1 |
| Track | Mobile portfolio, Week 1, Project 1 |
| Stack | React Native (Expo) |
| Build window | Tue 10 Nov to Wed 11 Nov 2026 |
| Target ship | Wed 11 Nov 2026, 11 PM (hard stop) |

## 1. Summary

Hearthlist is a shared household grocery list that is fully usable offline. Members of a household see one list, edit it from their own phones, and every change merges automatically when connectivity returns.

## 2. Problem

Shared shopping lists usually live in chat apps or in list apps that assume steady internet. In places with patchy mobile data, messages fail silently, items scroll away, nobody knows what has been bought, and offline edits are lost or duplicated. (Validate with 3 households before or during the build: what they use, what fails.)

## 3. Users

| Persona | Needs |
|---|---|
| Planner | Build the list at home, see what changed, keep one version everyone trusts |
| Shopper | Use the list one-handed in a market with no signal, tick items off, add forgotten items |

## 4. Goals and non-goals

**Goals**
- G1. All core actions work with no connection
- G2. Changes never get lost or duplicated, including when the app is killed mid-sync
- G3. Concurrent edits by two members merge predictably
- G4. The user can always see whether their changes are safe
- G5. Fast and smooth on a low-end Android phone

**Non-goals**
- Payments, price tracking, barcode scanning, recipes
- Multiple households per account
- Push notifications
- Web client, tablet layouts
- Encryption at rest

## 5. Scope and priorities

| Priority | Items |
|---|---|
| **P0** (must ship) | Email auth with persistent session; create and join household; lists and items CRUD offline; check and uncheck; outbox push; pull sync; sync chip with 5 states; empty, error and loading states; README and docs |
| **P1** (should ship) | Realtime updates; quick-add quantity parsing and suggestions; swipe to delete with undo; categories with auto-assignment; sync center with failed ops; unit and integration tests for the sync core; dark theme |
| **P2** (if time allows) | Clear done; leave household; error tracking via GlitchTip; deep-link invites |

**Cut order if behind schedule:** dark theme, then deep links, then GlitchTip, then realtime (fall back to pull on foreground and every 30 seconds while open), then categories auto-assignment.

## 6. User stories and acceptance criteria

| ID | Story | Acceptance criteria | Pri |
|---|---|---|---|
| US-01 | As a new user, I can create an account | Email, password (8+ chars) and display name validated inline; on success I land in household setup | P0 |
| US-02 | As a user, I stay signed in, even offline | Reopening the app with no network shows my lists without a login screen | P0 |
| US-03 | As a user, I can sign out safely | If unsynced changes exist, a warning offers "Sync first" or "Sign out anyway" | P1 |
| US-04 | I can start a household | Name required; a 6-character invite code is generated; I land on Lists | P0 |
| US-05 | I can join with a code | Valid code joins and shows shared lists; invalid code shows a clear message; join attempts are rate-limited | P0 |
| US-06 | I can see members and the invite code | Code can be copied and shared; works offline from cache | P0 |
| US-07 | I can leave a household | Confirmation, local data cleared, back to setup | P2 |
| US-08 | I can create, rename, archive and delete lists | All work offline; deleted lists disappear for everyone after sync | P0 |
| US-09 | I can see lists with open counts | Count updates instantly after any change | P0 |
| US-10 | I can add an item in under 3 seconds | Quick-add bar adds on submit; list updates immediately; works offline | P0 |
| US-11 | Quick add understands quantities | "2kg rice", "rice 2kg", "3 tomatoes", "tomatoes x3" produce the right name, quantity and unit; unparseable text becomes a plain name | P1 |
| US-12 | I can tick and untick items | Instant UI change, light haptic, item moves to or from Done | P0 |
| US-13 | I can edit an item | Name, quantity, unit, note, category via sheet; autosaves | P0 |
| US-14 | I can delete with undo | Swipe or sheet delete shows an Undo toast for 5 seconds; undo restores the item | P1 |
| US-15 | I can clear all done items | One action with Undo | P2 |
| US-16 | I get suggestions from my history | While typing, up to 4 matching past items appear as chips | P1 |
| US-17 | Items are grouped by category | Known items auto-categorize from a local catalog; others go to Other; I can change it | P1 |
| US-18 | I can see sync status | Chip shows Up to date, Syncing, N waiting, Offline or Issue, always visible on list screens | P0 |
| US-19 | Offline changes sync automatically | After reconnecting, all queued changes reach the server with no manual action, no loss, no duplicates | P0 |
| US-20 | I see other members' changes | Foreground app reflects changes within 5 seconds with realtime; otherwise within 30 seconds or on pull to refresh | P1 |
| US-21 | Conflicts resolve predictably | Edit vs tick merge both; two edits to the same field keep the later; delete beats edit | P0 |
| US-22 | I can review failed syncs | Sync center lists failed changes with plain reasons and Retry or Discard | P1 |
| US-23 | Killing the app mid-sync is safe | After restart the queue resumes with no loss or duplicates | P0 |
| US-24 | Session expiry doesn't lose data | Expired token while offline keeps local use; a banner asks me to sign in again; queue resumes after sign-in | P1 |
| US-25 | I can use dark theme | System, light and dark options; applies instantly | P1 |
| US-26 | The app is accessible | Labels, roles, 48 dp targets, 200% font scale without clipping | P0 |

## 7. Functional requirements

- FR-1. Every read comes from local SQLite; no screen blocks on network
- FR-2. Every write updates local tables and inserts an outbox row in one transaction
- FR-3. IDs are generated on the client
- FR-4. Deletes are soft (tombstones) and propagate through sync
- FR-5. The sync engine runs on app start (after first render), foreground, connectivity regained, after a local write (debounced), and on manual request
- FR-6. Retries use exponential backoff with jitter and a cap; permanent errors are parked, not retried
- FR-7. The server rejects stale writes with 409; the client reconciles by applying the server record
- FR-8. Auth tokens are stored in the platform secure store and refreshed transparently
- FR-9. API rules ensure a user can only access their own household's data

## 8. Non-functional requirements

| Area | Requirement (targets, measure on a release build on a low-end Android phone) |
|---|---|
| Startup | Cold start to interactive under 2 s |
| Scrolling | 60 fps with 500 items in a list |
| Interaction latency | Tick, add and delete reflected in UI under 100 ms |
| Size | Release APK under 40 MB |
| Reliability | 0 lost or duplicated changes across the manual test matrix |
| Offline | All P0 flows pass in airplane mode |
| Security | Token in secure store; rules prevent cross-household access; invite codes rate-limited; no secrets in the repo |
| Privacy | Collect only email and display name; no analytics SDKs |
| Accessibility | WCAG AA contrast targets; screen reader labels; 200% font scale |
| Compatibility | Follow the pinned Expo SDK's minimum OS versions; test on a phone with 3 GB RAM or less |

## 9. Success criteria

- [ ] Airplane-mode test: 20 offline changes sync with 0 lost and 0 duplicated
- [ ] Two-device conflict test passes (edit vs tick, tick vs tick, rename vs rename, delete vs edit)
- [ ] Kill-mid-sync test passes
- [ ] Performance budgets measured and recorded in `story.md`
- [ ] Sync core unit tests at or above 80% line coverage
- [ ] All seven docs complete and the demo recorded

## 10. Schedule

| When | Work | Done when |
|---|---|---|
| Mon night | Docs complete | You can hand `cursorcontext.md` to the agent |
| Tue AM | Scaffold, tooling, PocketBase collections and rules, Drizzle schema, migrations | App boots, DB created, backend collections exist |
| Tue midday | Repositories, auth screens, household setup (online) | Can sign up and create or join a household |
| Tue PM | Lists, list detail, quick add, check, edit, delete, categories | Fully usable offline on a single device |
| Wed AM | Outbox, push, pull, backoff, sync chip | Two devices converge |
| Wed midday | Conflict hooks, tests, sync center | Conflict matrix passes |
| Wed PM | Realtime (P1), polish, perf measurement, docs, demo | Everything recorded |
| Wed 11 PM | **Hard stop.** Unfinished items go to "Known limitations" in the README | Shipped |

Thursday morning is not a buffer; Pennywick starts Thursday.

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sync engine takes longer than planned | Misses the ship date | Cut order in section 5; build push, then pull, then realtime |
| PocketBase hook API differs from docs I remember | Conflict guard delayed | Pin the version, read its docs first, keep the single-timestamp fallback |
| EventSource missing in React Native for realtime | Realtime fails | Use the polyfill; otherwise fall back to foreground pull |
| Drizzle plus Expo SQLite migration setup friction | Lost hours on Tuesday | Follow Drizzle's Expo guide exactly; budget 1 hour |
| Unfamiliar low-end device for testing | Perf numbers missing | Use the lowest-spec device or emulator profile you have and say so in the story |

## 12. Assumptions and open questions

- Assumption: households are small (2 to 8 members, under 1,000 items total)
- Assumption: one phone per member
- Question: does the invite code need expiry? (MVP: no, with rate limiting)
- Question: should list deletion be restricted to its creator? (MVP: any member)

## 13. Future

Push notifications, barcode scan, price memory, multiple households, encryption at rest, backend move to Go or Python with Postgres using the same sync protocol.