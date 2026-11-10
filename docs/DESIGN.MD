# Hearthlist: Design

## 1. Design goals

1. **Never make the user wait or worry.** Every action responds instantly; connectivity is shown calmly, never as a blocker.
2. **One hand, one thumb, in a crowded market.** Primary actions sit in the bottom half of the screen with 48 dp targets.
3. **Trustworthy sync.** The user can always tell whether their changes are safe, waiting, or in trouble.
4. **Forgiving.** Undo beats confirmation dialogs.
5. **Light on low-end phones.** System fonts, no images, minimal animation cost.

## 2. Patterns replicated from top apps

| Pattern | Seen in | How Hearthlist uses it | Why it works |
|---|---|---|---|
| Optimistic check-off with haptic | Todoist, Google Keep | Tick updates the UI and local DB instantly, light haptic, sync happens later | Confirms the tap registered without waiting for a server |
| Done items collapse into a section | Google Keep | "Done (7)" section at the bottom, collapsed by default | Keeps the active list short |
| Undo toast instead of confirm dialog | Gmail, Todoist | Delete shows "Item removed. Undo" for 5 seconds | Faster and less annoying than "Are you sure?" |
| Always-on composer | WhatsApp | Quick-add bar pinned above the keyboard | Adding is the most frequent action |
| Persistent save-state indicator | Google Docs | Sync chip in the header: Up to date, Syncing, N waiting, Offline, Sync issue | Removes anxiety about lost changes |
| Swipe actions | Gmail | Swipe left to delete; swipe right to toggle done | Fast one-handed operation |
| Pull to refresh | Most feeds | Triggers a sync | Gives the user a manual lever |
| Contextual empty states | Most polished apps | Empty list explains what goes here and offers the first action | Avoids blank-screen confusion |
| Autocomplete from own history | Keyboards, shopping apps | Suggestion chips above the keyboard from the household's past items | Cuts typing |
| Skeletons only where network is unavoidable | Instagram, Twitter | Used only on first load after joining a household (initial pull) | Local reads are instant, so skeletons elsewhere would be fake |

## 3. Design tokens

All colors are targets; confirm contrast with a checker before release.

### Color (light)

| Token | Hex | Use | Approx. contrast |
|---|---|---|---|
| `bg` | `#FBF7F2` | Screen background | n/a |
| `surface` | `#FFFFFF` | Cards, sheets | n/a |
| `text` | `#2B2420` | Primary text | about 14:1 on bg |
| `textSecondary` | `#6B5F57` | Secondary text | about 5.8:1 on bg |
| `textDone` | `#766B63` | Checked item text (with strikethrough) | about 4.8:1 on bg |
| `primary` | `#C2410C` | Buttons, active states | about 5.2:1 with white text |
| `primaryPressed` | `#9A3412` | Pressed state | higher than primary |
| `success` | `#2E7D32` | Synced indicator | about 5:1 on white |
| `warning` | `#B45309` | Pending indicator | about 5:1 on white |
| `danger` | `#B91C1C` | Errors, destructive | about 6.5:1 on white |
| `border` | `#E8DFD6` | Dividers | decorative |

### Color (dark)

| Token | Hex |
|---|---|
| `bg` | `#1B1613` |
| `surface` | `#261F1B` |
| `text` | `#F5EDE6` |
| `textSecondary` | `#B8ABA1` |
| `textDone` | `#9A8D84` |
| `primary` | `#F97316` (use `#1B1613` text on it) |
| `success` / `warning` / `danger` | `#66BB6A` / `#F59E0B` / `#F87171` |
| `border` | `#3A302A` |

### Typography (system fonts, no custom font loading)

| Style | Size / line height | Weight |
|---|---|---|
| Title | 28 / 34 | Bold |
| Heading | 20 / 26 | Semibold |
| Body | 16 / 22 | Regular |
| Label | 14 / 20 | Medium |
| Caption | 13 / 18 | Regular |

Text must scale with the system font size up to 200% without clipping. Item names wrap to two lines before truncating.

### Spacing, shape, motion

| Token | Value |
|---|---|
| Spacing scale | 4, 8, 12, 16, 24, 32 |
| Screen horizontal padding | 16 |
| Minimum touch target | 48 x 48 |
| Radius | 12 (cards, inputs), 999 (chips, pills) |
| Elevation | One subtle level for sheets and FAB only |
| Motion durations | 120 ms (taps), 200 ms (layout changes), 250 ms (sheets) |
| Easing | Standard ease-out |

## 4. Information architecture

```text
Auth stack
  Welcome (sign in / create account)
Onboarding stack
  Household setup (start or join)
Main tabs
  Lists
    List detail
      Item sheet (modal)
  Household
  Settings
Global
  Sync center (sheet, opened from the sync chip anywhere)
```

Rules: three bottom tabs, every screen reachable in 3 taps or fewer, hardware back always pops one level, no dead ends. Invite links are deep-linkable later (`hearthlist://join?code=ABC123`).

## 5. Screen specifications

### S1. Welcome
- Purpose: sign in or create an account (email, password, display name on sign-up)
- Layout: logo and tagline, form, primary button, text link to switch mode
- States: idle, submitting (button spinner, fields disabled), field errors inline, network error ("Can't reach the server. Check your connection and try again."), invalid credentials
- Note: after first sign-in the session persists, including when offline

### S2. Household setup
- Two large option cards: "Start a household" (name field) and "Join with a code" (6-character field, auto-uppercase, no ambiguous characters)
- States: submitting, invalid code ("That code doesn't match a household."), offline ("You need a connection to set up a household. You can do this later.")
- Success goes straight to Lists, with a skeleton while the first pull completes

### S3. Lists (home)
- Header: household name, sync chip
- Body: list cards showing name, open item count, "last change by Name, 5 min ago"
- FAB: New list
- Pull to refresh triggers sync
- Empty state: "No lists yet. Start with one for your next market run." with a "Create a list" button
- Interactions: tap opens list, long press opens rename, archive, delete

### S4. List detail
- Header: list name, sync chip, overflow menu (rename, archive, delete list)
- Body: items grouped by category (Produce, Grains and staples, Proteins, Dairy and eggs, Oils and spices, Drinks, Household, Toiletries, Other), then "Done (n)" section collapsed by default with "Clear done"
- Item row: 48 dp checkbox, name (up to 2 lines), quantity pill, note icon if present, small initials avatar of who added it
- Quick-add bar pinned above the keyboard: text field plus add button; suggestion chips above it while typing
- Gestures: swipe left to delete (undo toast), swipe right to toggle done, tap row opens item sheet
- States: loading is not needed (local), empty ("Nothing here yet. Add your first item below."), all done ("All done. Nice shop.")

```text
+------------------------------------------+
| <  Market run            (o) Up to date  |
+------------------------------------------+
| PRODUCE                                  |
| [ ] Tomatoes            [3 kg]   (A)     |
| [ ] Onions              [1 bag]  (T)     |
| GRAINS AND STAPLES                       |
| [ ] Rice (ofada)        [5 kg]   (A)     |
| [ ] Garri                        (T)     |
|                                          |
| v Done (2)                  Clear done   |
+------------------------------------------+
| [rice] [red beans] [yam]    <- chips     |
| [ Add an item...                  ] [+]  |
+------------------------------------------+
```

### S5. Item sheet (bottom sheet)
- Fields: name, quantity, unit (chips: kg, g, l, ml, pcs, pack, bag, bottle, tin, crate), note, category picker
- Footer: "Added by Name, edited 5 min ago", Delete (undo available)
- Autosave on dismiss; no Save button; invalid name (empty) reverts with a gentle shake

### S6. Household
- Household name, invite code with Copy and Share buttons, member list (name, "you" label), Leave household (P2)
- Offline: everything readable; sharing the code still works because the code is cached locally

### S7. Sync center (sheet)
- Summary: status, last synced time ("3 min ago"), items waiting
- "Sync now" button
- Problem list: each failed change with plain-language reason and Retry or Discard
- Empty state: "Everything is safe and up to date."

### S8. Settings
- Theme (system, light, dark), sign out (warns if changes are unsynced), app version, link to help text on how syncing works

## 6. Component inventory

`Screen`, `Header`, `SyncChip`, `ListCard`, `ItemRow`, `QuickAddBar`, `SuggestionChips`, `CategoryHeader`, `DoneSection`, `Fab`, `BottomSheet`, `Toast` (with action), `EmptyState`, `Skeleton`, `Button`, `TextField`, `Chip`, `Avatar`, `ErrorBoundaryFallback`. Every component takes tokens only; no raw hex or magic numbers.

## 7. Sync chip states

| State | Icon | Label | Tap |
|---|---|---|---|
| Up to date | check | "Up to date" | Opens sync center |
| Syncing | spinner | "Syncing" | Opens sync center |
| Pending | cloud-upload | "3 waiting" | Opens sync center |
| Offline | cloud-off | "Offline" | Opens sync center |
| Issue | alert | "Sync issue" | Opens sync center |

Never rely on color alone: every state has an icon and text. Offline never blocks the UI and never shows a modal.

## 8. Motion and haptics

- Check toggle: 120 ms scale and fade on the checkbox, 200 ms layout animation moving the row to or from Done
- Light haptic on check, uncheck and delete (direct user actions only). No haptics for sync events.
- Sheets slide in 250 ms
- Respect the system "reduce motion" setting: replace movement with simple fades
- No animation runs on first render of a list

## 9. Accessibility

- Every interactive element has a role, label and state (for example "Rice, 5 kilograms, not checked")
- Toggling announces the new state
- Touch targets at least 48 x 48; spacing at least 8 between adjacent targets
- Contrast: text at least 4.5:1, large text and icons at least 3:1
- Layout holds at 200% font scale
- Swipe gestures always have a non-gesture alternative (item sheet or overflow menu)
- Focus order follows visual order; the quick-add field is reachable by screen reader without scrolling

## 10. Microcopy

| Situation | Copy |
|---|---|
| Offline chip tapped | "You're offline. Your changes are saved on this phone and will sync when you're back." |
| Pending | "3 changes waiting to sync." |
| Sync issue | "Some changes couldn't sync. Tap to review." |
| Delete item | "Item removed. Undo" |
| Session expired while offline | "Sign in again to resume syncing. Your list is still here." |
| Sign out with pending changes | "You have 3 changes that haven't synced. If you sign out now they'll be lost." (Buttons: Sync first, Sign out anyway) |
| Invalid invite code | "That code doesn't match a household. Check it and try again." |

Tone: short, calm, plain. No exclamation marks, no jargon like "outbox" or "conflict" in the UI.

## 11. Low-end device considerations

- System fonts only; no image assets beyond the app icon
- FlashList for item lists; rows are memoized with stable keys
- Layout animations limited to the check toggle
- Defer non-critical work (sync boot, suggestion index) until after first interaction
- Test on a phone with 3 GB RAM or less before calling the design done