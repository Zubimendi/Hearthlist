# Hearthlist: Story

## The problem

In a lot of households, the shopping list lives in a WhatsApp group. Someone types "rice, tomatoes, garri" and it scrolls away under a photo of a cousin's birthday cake. Nobody knows who already bought the onions. The person standing in the market, where reception comes and goes, can't send an update, so two people buy the same thing and a third item gets forgotten.

Generic list apps help, but most assume a steady connection. When the network drops they spin, lose edits or show scary error banners at exactly the moment you are standing in a queue with a basket.

## Who it's for

- **The planner:** keeps the household running, builds the list at home on Wi-Fi, and wants everyone to see one up-to-date version.
- **The shopper:** in the market or shop with unreliable data, ticking items off with one hand, wanting the list to simply work.

(Validation note, fill in after talking to 3 households: what they use today and what annoys them most.)

## Why offline-first is the point, not a feature

The interesting engineering question is not "how do I show a list". It is "what does a shared list mean when two phones are both offline and both edit it". Hearthlist answers that on purpose:

- The phone's database is the source of truth, so the UI never waits on the network.
- Every change is written locally and queued in the same transaction, so nothing is lost if the app is killed.
- A sync engine retries with backoff and applies changes safely more than once.
- The server resolves conflicts with a rule that is easy to explain: separate last-write-wins for an item's content and its state.

## What I set out to prove

1. I can build a local-first React Native app where the network is only a sync path.
2. I can design a conflict policy that loses as little user intent as possible.
3. I treat failure as a first-class state: every error maps to a decision about retrying, parking or telling the user.
4. I measure performance on a low-end device instead of assuming it.

## Key decisions

| Decision | Why |
|---|---|
| SQLite with Drizzle as the source of truth | Instant reads, offline by default, typed queries and live updates |
| Custom outbox instead of a sync vendor | I can explain every step of the protocol, and it costs nothing |
| PocketBase backend | One binary, realtime built in, perfect for a free self-hosted portfolio project |
| Two LWW groups per item (content and state) | The commonest conflict is one person ticking an item while another edits it; neither should lose |
| Soft deletes (tombstones) | Deletions must propagate to devices that were offline |
| Client-generated IDs | Creating items offline requires IDs without asking the server, and it makes retries idempotent |
| No TanStack Query for list data | There is no server cache to manage; SQLite already is the cache |
| Undo instead of confirmation dialogs | Faster, calmer, and recoverable |

## What happened (fill in after the build)

- Built in: __ hours over two days
- Measured cold start on [device]: __ ms; scroll with 500 items: __ fps; release APK size: __ MB
- Airplane-mode test: __ changes made offline, __ synced, __ lost, __ duplicated
- Bugs worth telling: (the sync edge case that surprised you)
- What I would change: (honest list)

## What I'd do next

Push notifications when someone adds to a shared list, barcode scanning, multiple households, encryption at rest, and moving the backend to a Go or Python service with Postgres using the same push and pull protocol so the app does not change.

## Interview pitch (2 minutes)

"Hearthlist is a shared grocery list for households with unreliable connectivity. The phone's SQLite database is the source of truth, so the app is fully usable offline. Writes go into the local tables and an outbox in one transaction, and a sync engine drains the outbox with exponential backoff and jitter, treating every operation as idempotent using client-generated IDs. On the server, PocketBase hooks apply last-write-wins separately to an item's content fields and its state fields, so ticking an item and renaming it at the same time doesn't lose either edit. I tested it by killing the app mid-sync, running two devices in airplane mode and injecting server failures, and I measured startup and scroll performance on a low-end Android phone."

## Likely deep-dive questions

| Question | Short answer |
|---|---|
| What happens if the app is killed after the server accepts a write but before the outbox row is deleted? | On restart the op is retried. Creates use the same client ID, and a duplicate-id response is treated as success; updates and deletes are naturally idempotent. |
| How do you handle conflicts? | Server-side LWW per field group (content, state). Stale writes get a 409; the client discards the op and applies the server record. Delete is part of the state group. |
| Clock skew? | The server clamps timestamps more than 5 minutes in the future. A device with a slow clock loses ties. The upgrade path is hybrid logical clocks, documented as a limitation. |
| Why not just use PowerSync or Firebase? | Cost and learning value. A hand-built outbox is small, free and fully explainable. I would reach for a sync engine in production. |
| How would this scale? | PocketBase is single-node SQLite, fine for this scale. The same push, pull and cursor protocol can be reimplemented in Go or Python on Postgres without changing the client. |
| What about security? | Tokens in the platform secure store, server API rules isolate households, rate-limited invite codes, tests that user A cannot read household B. The local DB is unencrypted on purpose for this data. |
| How did you test the sync engine? | Pure-logic unit tests (coalescing, backoff, merge), an integration test against a fake server with injected failures, and a manual matrix including two devices in airplane mode. |
| Why not TanStack Query? | Its job is caching server state. Here the local database is the cache and the network is just a sync mechanism. |