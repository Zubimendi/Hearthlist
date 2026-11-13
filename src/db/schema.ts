// src/db/schema.ts
// Drizzle ORM schema — single source of truth for the local SQLite database.
// All timestamps are integer milliseconds since epoch.
// Matches architecture.md section 4 exactly.

import { integer, real, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// households
// ---------------------------------------------------------------------------
export const households = sqliteTable('households', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  inviteCode:  text('invite_code').notNull(),
  createdAt:   integer('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// members (cached from server; not written locally)
// ---------------------------------------------------------------------------
export const members = sqliteTable('members', {
  id:          text('id').primaryKey(),
  householdId: text('household_id').notNull().references(() => households.id),
  displayName: text('display_name').notNull(),
});

// ---------------------------------------------------------------------------
// lists
// ---------------------------------------------------------------------------
export const lists = sqliteTable('lists', {
  id:              text('id').primaryKey(),
  householdId:     text('household_id').notNull().references(() => households.id),
  name:            text('name').notNull(),
  sortOrder:       real('sort_order').notNull().default(0),
  archived:        integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdBy:       text('created_by').notNull(),
  createdAt:       integer('created_at').notNull(),
  updatedAt:       integer('updated_at').notNull(),   // LWW timestamp (client_updated_at)
  deletedAt:       integer('deleted_at'),              // tombstone
});

// ---------------------------------------------------------------------------
// items
// ---------------------------------------------------------------------------
export const items = sqliteTable(
  'items',
  {
    id:          text('id').primaryKey(),
    listId:      text('list_id').notNull().references(() => lists.id),
    householdId: text('household_id').notNull(),
    // content group — LWW via content_at
    name:        text('name').notNull(),
    quantity:    real('quantity'),
    unit:        text('unit'),
    note:        text('note'),
    category:    text('category').notNull().default('other'),
    contentAt:   integer('content_at').notNull(),
    // state group — LWW via state_at
    checked:     integer('checked', { mode: 'boolean' }).notNull().default(false),
    checkedBy:   text('checked_by'),
    checkedAt:   integer('checked_at'),
    deletedAt:   integer('deleted_at'),
    stateAt:     integer('state_at').notNull(),
    // metadata
    createdBy:   text('created_by').notNull(),
    createdAt:   integer('created_at').notNull(),
  },
  (t) => ({
    listIdx:      index('idx_items_list').on(t.listId, t.deletedAt, t.checked),
    householdIdx: index('idx_items_household_name').on(t.householdId, t.name),
  })
);

// ---------------------------------------------------------------------------
// outbox — pending sync operations
// ---------------------------------------------------------------------------
export const outbox = sqliteTable('outbox', {
  seq:           integer('seq').primaryKey({ autoIncrement: true }),
  entity:        text('entity', { enum: ['list', 'item'] }).notNull(),
  entityId:      text('entity_id').notNull(),
  op:            text('op', { enum: ['create', 'update', 'delete'] }).notNull(),
  payload:       text('payload').notNull(),             // JSON of changed fields
  attempts:      integer('attempts').notNull().default(0),
  nextAttemptAt: integer('next_attempt_at').notNull().default(0),
  status:        text('status', { enum: ['pending', 'parked'] }).notNull().default('pending'),
  lastError:     text('last_error'),
  createdAt:     integer('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// sync_state — cursor store for incremental pull
// ---------------------------------------------------------------------------
export const syncState = sqliteTable('sync_state', {
  key:   text('key').primaryKey(), // e.g. 'cursor:lists', 'cursor:items'
  value: text('value').notNull(),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type Household = typeof households.$inferSelect;
export type HouseholdInsert = typeof households.$inferInsert;

export type Member = typeof members.$inferSelect;
export type MemberInsert = typeof members.$inferInsert;

export type List = typeof lists.$inferSelect;
export type ListInsert = typeof lists.$inferInsert;

export type Item = typeof items.$inferSelect;
export type ItemInsert = typeof items.$inferInsert;

export type OutboxRow = typeof outbox.$inferSelect;
export type OutboxInsert = typeof outbox.$inferInsert;

export type SyncStateRow = typeof syncState.$inferSelect;
