# Hearthlist: Demo Guide

## Goals

- A 90 to 120 second recorded demo for the README and portfolio
- A 5 minute live version for interviews
- Both prove one thing: **it keeps working offline and reconciles correctly**

## Setup (do this the evening before)

| Item | Detail |
|---|---|
| Backend | PocketBase running on your computer, reachable by both devices |
| Devices | One physical phone plus one emulator, or two phones, both signed in as different members of the same household |
| Seed data | Household "Offiong Home", lists "Market run" (about 10 items across categories) and "Pharmacy" (3 items), two members with display names |
| Network control | Airplane mode on the phone; on the emulator, disable network in the extended controls |
| Screen recording | Android: built-in screen recorder or `adb shell screenrecord`. iOS Simulator (Mac only): `xcrun simctl io booted recordVideo demo.mp4` |
| Cleanup | Hide notifications, set a clean wallpaper, battery above 50%, do not disturb on |

If you build a release APK for the demo, either serve the backend over HTTPS or enable cleartext traffic for local use.

## 90 second script

| Time | Screen | Action | Voiceover |
|---|---|---|---|
| 0:00 | Lists | Show household and two lists | "Hearthlist is a shared grocery list for households with unreliable data." |
| 0:08 | List detail | Type "2kg rice", add; type "tomatoes x3", add | "Quick add understands quantities, and suggestions come from your own history." |
| 0:20 | List detail | Tick two items; swipe one to delete; tap Undo | "Everything responds instantly, and undo replaces confirmation dialogs." |
| 0:32 | Phone | Turn on airplane mode; chip changes to Offline | "Now I'm offline. The app doesn't block me or show errors." |
| 0:38 | List detail | Add 3 items, tick 2, edit one name | "I keep shopping. Changes are saved on the phone and queued." |
| 0:50 | Chip | Tap chip: "5 changes waiting" | "The sync center shows exactly what's waiting." |
| 0:56 | Second device | Edit the same item (tick it) | "Meanwhile my partner ticks an item on her phone." |
| 1:05 | Phone | Turn airplane mode off; chip goes Syncing then Up to date | "Back online, the queue drains by itself." |
| 1:15 | Both | Show both lists identical, both edits preserved | "Her tick and my rename both survived, because content and state merge separately." |
| 1:30 | Close | Show repo and architecture doc | "Local-first, outbox, idempotent sync, conflict-safe." |

## Conflict demo (show in the live version)

1. Both devices offline.
2. Device A renames "Rice" to "Ofada rice". Device B ticks "Rice".
3. Bring both online.
4. Result: item is named "Ofada rice" and is ticked, on both devices.
5. Extra: both devices rename the same item differently while offline; the later edit wins, which you explain in one sentence.

## Failure demo (live version, optional)

1. Make 10 offline changes.
2. Reconnect, and force-quit the app while the chip says Syncing.
3. Reopen: it resumes, ends at Up to date, with no missing or duplicated items.

## Shots to capture for the README

1. Lists screen (light)
2. List detail with items across categories
3. Offline state with "5 waiting"
4. Sync center
5. Dark theme list detail
6. Two devices side by side after sync (optional composite)

## Turning the recording into a GIF

```bash
ffmpeg -i demo.mp4 -vf "fps=12,scale=360:-1:flags=lanczos" -loop 0 demo.gif
```

Keep the GIF under about 8 MB; trim dead time and keep the full MP4 for the portfolio site.

## Pre-demo checklist

- [ ] Backend running and reachable from both devices
- [ ] Both devices signed in and fully synced
- [ ] Airplane mode toggle tested on both
- [ ] Notifications off, battery above 50%
- [ ] Recording app tested for 10 seconds
- [ ] Fallback video ready if the live demo fails

## If something breaks live

Say what you expect, show the sync center (it explains state), and switch to the recorded demo. Interviewers care more about how you reason about failure than about a perfect run.