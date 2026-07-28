# SQL Deployment Guide

> **Date**: 2026-07-11  
> **Audit scope**: All 22 SQL files across `supabase/` (15 root) and `supabase/migrations/` (7)  
> **Status**: Single source of truth established

---

## Table of Contents

1. [Object Inventory & Canonical Source](#1-object-inventory--canonical-source)
2. [Files That Should NEVER Be Executed](#2-files-that-should-never-be-executed)
3. [Deprecated Files](#3-deprecated-files)
4. [Files That Replace Them](#4-files-that-replace-them)
5. [Fresh Installation Order](#5-fresh-installation-order)
6. [Migration Order for Existing Production](#6-migration-order-for-existing-production)
7. [Rollback Order](#7-rollback-order)
8. [Verification Queries](#8-verification-queries)

---

## 1. Object Inventory & Canonical Source

For every database object, the canonical file is listed first. Objects defined in multiple files note the non-canonical (redundant/deprecated) sources.

### 1.1 Tables

| Table | Canonical File | Also Defined In | Notes |
|---|---|---|---|
| `products` | `schema.sql` | — | Base definition with all columns (id, name, slug, category, created_at, normalized_key) |
| `listings` | `schema.sql` | `listing-images.sql`, `listing-status.sql`, `bot-sync.sql`, `production-hardening.sql`, `listings-schema-sync.sql` | Core listing table. schema.sql provides base columns (id + 22 columns). Extended columns (source_id, description, brand, model, etc.) first defined in `bot-sync.sql` |
| `search_events` | `schema.sql` | — | Single source of truth |
| `favorites` | `schema.sql` | `favorites.sql` | `favorites.sql` contains redundant CREATE TABLE + RLS identical to schema.sql |
| `price_alerts` | `price-alerts.sql` | `schema.sql` | `price-alerts.sql` is canonical — it has the UUID migration, expanded schema (listing_id, current_price, status, triggered_at, last_checked_at, updated_at), additional indexes, and comprehensive RLS. schema.sql only has the basic version. |
| `price_history` | `price-history-backfill-support.sql` | `price-history.sql`, `bot-sync.sql` | Triple overlap. backfill-support.sql is canonical — it has the `record_listing_price_history()` trigger, `backfill_price_history_from_listings()`, `created_at`, and all indexes. |
| `site_settings` | `site-settings.sql` | — | Single source of truth |
| `sources` | `sources-and-bots.sql` | `bot-scheduler.sql`, `source-integration-settings.sql`, `source-bot-publish-mode.sql` | Base table + seed data. Other files add columns incrementally. |
| `bot_runs` | `sources-and-bots.sql` | `bot-center-monitoring.sql` | Base table. Migration adds `matched_product_count`. |
| `search_demands` | `search-demand-queue.sql` | — | Single source of truth |
| `bot_queue` | `search-demand-queue.sql` | — | Single source of truth |

### 1.2 Functions

| Function | Canonical File | Also Defined In | Notes |
|---|---|---|---|
| `track_listing_price_change()` | `schema.sql` | — | Updates previous_price/price_updated_at on price change |
| `set_listing_updated_at()` | `bot-sync.sql` | — | Sets `updated_at = now()` on listing UPDATE |
| `sync_source_listings(p_source_id, p_items)` | `bot-sync.sql` | — | **V1 — DEPRECATED**. Replaced by V2 below. Missing `p_skip_inactive_marking` parameter. |
| `sync_source_listings(p_source_id, p_items, p_skip_inactive_marking default false)` | `source-engine-skip-inactive.sql` | — | **V2 — CANONICAL**. Same logic + skip-inactive support. Overwrites V1 when executed. |
| `slugify_product_name(value)` | `product-slugs.sql` | — | Immutable, used by set_product_slug trigger |
| `set_product_slug()` | `product-slugs.sql` | — | Trigger function for products.slug auto-generation |
| `record_listing_price_history()` | `price-history-backfill-support.sql` | — | Trigger function: inserts price_history row on listing INSERT/UPDATE |
| `backfill_price_history_from_listings(p_limit, p_dry_run)` | `price-history-backfill-support.sql` | — | Admin backfill function |
| `set_price_alerts_updated_at()` | `price-alerts.sql` | — | Sets updated_at = now() on price_alerts UPDATE |
| `get_admin_platform_stats()` | `site-settings.sql` | — | Admin dashboard JSON aggregate |
| `compute_normalized_key(value)` | `products-normalized-key.sql` | — | Immutable, SQL approximation of JS generateProductKey() |
| `set_product_normalized_key()` | `products-normalized-key.sql` | — | Trigger function for products.normalized_key auto-generation |
| `set_bot_queue_updated_at()` | `search-demand-queue.sql` | — | Sets updated_at = now() on bot_queue UPDATE |

### 1.3 Triggers

| Trigger | On Table | Canonical File | Also Defined In | Notes |
|---|---|---|---|---|
| `listings_track_price_change` | `listings` | `schema.sql` | — | BEFORE UPDATE of price |
| `listings_set_updated_at` | `listings` | `bot-sync.sql` | — | BEFORE UPDATE |
| `listings_record_price_history` | `listings` | `price-history-backfill-support.sql` | — | AFTER INSERT or UPDATE of price |
| `products_set_slug` | `products` | `product-slugs.sql` | — | BEFORE INSERT OR UPDATE of name, slug |
| `products_set_normalized_key` | `products` | `products-normalized-key.sql` | — | BEFORE INSERT OR UPDATE of name, normalized_key |
| `price_alerts_set_updated_at` | `price_alerts` | `price-alerts.sql` | — | BEFORE UPDATE |
| `bot_queue_set_updated_at` | `bot_queue` | `search-demand-queue.sql` | — | BEFORE UPDATE |

### 1.4 Indexes (Uniqued Across All Files)

| Index Name | Canonical File | Also In | Notes |
|---|---|---|---|
| `listings_product_id_idx` | `schema.sql` | `listings-schema-sync.sql` | Duplicate definition |
| `listings_created_at_idx` | `schema.sql` | — | — |
| `listings_user_id_idx` | `schema.sql` | — | — |
| `listings_source_external_id_key` (UNIQUE) | `schema.sql` | `listings-schema-sync.sql` | Schema.sql version: no WHERE clause. Sync version adds `WHERE source is not null and external_id is not null`. Both identical in practice. |
| `listings_price_updated_at_idx` | `schema.sql` | — | — |
| `search_events_product_id_idx` | `schema.sql` | — | — |
| `search_events_created_at_idx` | `schema.sql` | — | — |
| `favorites_listing_id_idx` | `schema.sql` | `favorites.sql` | Duplicate definition |
| `price_alerts_user_id_idx` | `schema.sql` | `price-alerts.sql` | Duplicate definition |
| `price_history_product_recorded_at_idx` | `bot-sync.sql` | `price-history.sql`, `price-history-backfill-support.sql` | Triple duplicate. Accept all three (idempotent). |
| `price_history_listing_recorded_at_idx` | `bot-sync.sql` | `price-history.sql` | Duplicate definition |
| `listings_source_id_external_id_key` (UNIQUE, PARTIAL) | `bot-sync.sql` | `listings-schema-sync.sql` | Partial: `WHERE source_id is not null and external_id is not null` |
| `listings_source_id_url_key` (UNIQUE, PARTIAL) | `bot-sync.sql` | `listings-schema-sync.sql` | Partial: `WHERE source_id is not null` |
| `listings_source_id_status_idx` | `bot-sync.sql` | `listings-schema-sync.sql` | Duplicate definition |
| `listings_status_created_at_idx` | `listing-status.sql` | — | — |
| `price_alerts_product_id_idx` | `price-alerts.sql` | — | — |
| `price_alerts_listing_id_idx` | `price-alerts.sql` | — | — |
| `price_alerts_status_idx` | `price-alerts.sql` | — | — |
| `price_alerts_active_product_target_key` (UNIQUE, PARTIAL) | `price-alerts.sql` | — | Partial: `WHERE status = 'active' and product_id is not null and listing_id is null` |
| `price_alerts_active_listing_target_key` (UNIQUE, PARTIAL) | `price-alerts.sql` | — | Partial: `WHERE status = 'active' and listing_id is not null` |
| `price_history_listing_price_recorded_at_idx` | `price-history-backfill-support.sql` | — | — |
| `sources_is_active_idx` | `sources-and-bots.sql` | — | — |
| `sources_cron_enabled_idx` (PARTIAL) | `source-integration-settings.sql` | — | Partial: `WHERE cron_enabled = true` |
| `bot_runs_source_id_created_at_idx` | `sources-and-bots.sql` | — | — |
| `bot_runs_status_created_at_idx` | `sources-and-bots.sql` | — | — |
| `bot_runs_run_type_created_at_idx` | `bot-center-monitoring.sql` | — | — |
| `search_demands_normalized_query_idx` | `search-demand-queue.sql` | — | — |
| `search_demands_status_idx` | `search-demand-queue.sql` | — | — |
| `bot_queue_status_idx` | `search-demand-queue.sql` | — | — |
| `bot_queue_priority_created_at_idx` | `search-demand-queue.sql` | — | — |
| `bot_queue_demand_source_idx` | `search-demand-queue.sql` | — | — |
| `products_slug_key` (UNIQUE) | `product-slugs.sql` | — | — |
| `products_normalized_key_key` (UNIQUE) | `products-normalized-key.sql` | — | — |
| `listings_last_seen_at_idx` | `listings-schema-sync.sql` | — | — |
| `listings_imported_at_idx` | `listings-schema-sync.sql` | — | — |

### 1.5 RLS Policies

| Policy | Canonical File | Also In | Notes |
|---|---|---|---|
| Products — publicly readable | `schema.sql` | `production-hardening.sql` | Duplicate |
| Listings — publicly readable | `schema.sql` | `production-hardening.sql` | Duplicate |
| Listings — anyone can submit (insert) | `schema.sql` | — | Not in production-hardening |
| Search events — publicly readable | `schema.sql` | — | Not in production-hardening |
| Search events — anyone can record | `schema.sql` | — | Not in production-hardening |
| Favorites — read/add/remove | `schema.sql` | `favorites.sql`, `production-hardening.sql` | Triple duplicate. **production-hardening.sql omits search_events policies entirely**. |
| Price alerts — read/add/update/remove | `schema.sql` | `price-alerts.sql` | **price-alerts.sql** is canonical — it matches schema.sql identity and is more comprehensive. |
| Price history — publicly readable | `bot-sync.sql` | `price-history.sql`, `production-hardening.sql`, `price-history-backfill-support.sql` | Quadruple duplicate. Identical policy text in all four. |
| Search demands — user reads own | `search-demand-queue.sql` | — | — |
| Search demands — anonymous insert | `search-demand-queue.sql` | — | — |
| Sources — RLS enabled, no public policy | `sources-and-bots.sql` | — | Server-side only |
| Bot runs — RLS enabled, no public policy | `sources-and-bots.sql` | — | Server-side only |
| Bot queue — RLS enabled, no public policy | `search-demand-queue.sql` | — | Server-side only |
| Site settings — RLS enabled, no public policy | `site-settings.sql` | — | Server-side only |

### 1.6 Seed Data

| Seed Data | Canonical File | Notes |
|---|---|---|
| Products seed (RTX 2060 Super, i5-12400F, iPhone 13, PS5, MacBook Air M1) | `schema.sql` | — |
| Site settings (general, maintenance) | `site-settings.sql` | — |
| Sources seed (Sahibinden, Letgo, Facebook, EasyCep, Getmobil, etc.) | `sources-and-bots.sql` | — |

### 1.7 Unique Constraints

| Constraint | Canonical File | Notes |
|---|---|---|
| `products.name` UNIQUE | `schema.sql` | Via `name text not null unique` |
| `favorites_user_id_listing_id_key` UNIQUE | `schema.sql` | `favorites.sql` re-adds it |
| `listings_source_external_id_key` UNIQUE | `schema.sql` | Partial in `listings-schema-sync.sql` |
| `listings_source_id_external_id_key` UNIQUE, PARTIAL | `bot-sync.sql` | `listings-schema-sync.sql` duplicates |
| `listings_source_id_url_key` UNIQUE, PARTIAL | `bot-sync.sql` | `listings-schema-sync.sql` duplicates |
| `sources.slug` UNIQUE | `sources-and-bots.sql` | Via `slug text unique not null` |
| `products_slug_key` UNIQUE | `product-slugs.sql` | — |
| `products_normalized_key_key` UNIQUE | `products-normalized-key.sql` | — |

### 1.8 Check Constraints

| Constraint | Canonical File | Also In | Notes |
|---|---|---|---|
| `listings_status_check` | `schema.sql` | `listing-status.sql`, `bot-sync.sql`, `production-hardening.sql`, `listings-schema-sync.sql` | Defined 5 times across the codebase. Identical values across all. |
| `sources_bot_listing_status_check` | `source-bot-publish-mode.sql` | `sources-and-bots.sql`, `bot-scheduler.sql` | Defined 3 times. |
| `sources_product_limit_check` | `source-integration-settings.sql` | `sources-and-bots.sql`, `bot-scheduler.sql` | Defined 3 times. |
| `sources_integration_type_check` | `bot-scheduler.sql` | — | Only in bot-scheduler |
| `sources_fetch_limit_check` | `bot-scheduler.sql` | — | Only in bot-scheduler |
| `sources_bot_import_mode_check` | `bot-scheduler.sql` | — | Only in bot-scheduler |
| `price_alerts_product_or_listing_check` | `price-alerts.sql` | — | — |
| `price_alerts_target_price_check` | `price-alerts.sql` | — | — |
| `price_alerts_status_check` | `price-alerts.sql` | — | — |

### 1.9 Extensions

| Extension | File | Notes |
|---|---|---|
| `pgcrypto` | `price-alerts.sql` | Required for `gen_random_uuid()` in price_alerts.id |

---

## 2. Files That Should NEVER Be Executed

These files contain zero unique logic. Every statement they contain is redundant with another canonical file. Executing them is harmless (all use `if not exists` / `drop if exists` guards) but they must not be considered part of the deployment.

| File | Redundant With | Why Redundant |
|---|---|---|
| `listing-images.sql` | `schema.sql` | `image_url` already defined in schema.sql line 27. The 1-line `add column if not exists` does nothing. |
| `listing-status.sql` | `schema.sql` | `status`, `updated_at`, `first_seen_at`, `last_seen_at`, `inactive_at` all already in schema.sql. `listings_status_check`, `listings_status_created_at_idx` also duplicated elsewhere. **Zero unique content.** |
| `price-history.sql` | `bot-sync.sql`, `price-history-backfill-support.sql` | `price_history` table + indexes + RLS all defined in `bot-sync.sql` and/or `price-history-backfill-support.sql`. **Zero unique content.** |
| `price-history-created-at.sql` | `price-history-backfill-support.sql` | `created_at` column on `price_history` is already part of the canonical table definition in `price-history-backfill-support.sql` (line 11). **Zero unique content.** |

### 2.1 Why These Files Exist

These files are historical artifacts from iterative development:
- `listing-images.sql` was the first version before listing columns were consolidated into schema.sql
- `listing-status.sql` was added during the "pending/published/rejected/active/inactive" status expansion, later folded into schema.sql
- `price-history.sql` was the original price_history table before backfill-support.sql added the trigger system
- `price-history-created-at.sql` was a quick addition later absorbed into backfill-support.sql's CREATE TABLE

---

## 3. Deprecated Files

These files contain some unique logic but have been wholly or partially superseded. Do not rely on them as canonical sources.

| File | Status | Deprecation Reason |
|---|---|---|
| `bot-sync.sql` | **DEPRECATED - V1** | Creates V1 `sync_source_listings()` without `p_skip_inactive_marking`. Superseded by `source-engine-skip-inactive.sql` (V2). The listing columns (`source_id`, `description`, `brand`, `model`, etc.), price_history table, indexes, and `set_listing_updated_at()` trigger are still valid but defined more canonically elsewhere. |
| `production-hardening.sql` | **DEPRECATED** | RLS policies are duplicates of `schema.sql`. Listing columns (`updated_at`, `first_seen_at`, `last_seen_at`, `inactive_at`) are duplicates of `schema.sql`. `listings_status_check` is duplicated. Status fallback updates (`coalesce(first_seen_at, created_at, now())`) are useful but should be in schema.sql. **Sources/bot_runs RLS enabling is now in sources-and-bots.sql.** |
| `favorites.sql` | **DEPRECATED** | Identical CREATE TABLE + RLS + unique constraint + index already in `schema.sql`. The DO block for primary key renaming was a one-time migration. |
| `source-bot-publish-mode.sql` | **DEPRECATED** | `bot_listing_status` column and check constraint are now in `sources-and-bots.sql` base CREATE TABLE (line 8). The EasyCep seed update is now in `bot-scheduler.sql`. |
| `source-integration-settings.sql` | **DEPRECATED** | `api_url`, `scrape_url`, `cron_enabled`, `cron_schedule`, `product_limit`, `last_success` columns, `product_limit` check, and `cron_enabled` index are now in `sources-and-bots.sql` base CREATE TABLE. EasyCep/Getmobil URL seed updates are now in `bot-scheduler.sql`. |

### 3.1 What Each Deprecated File Still Contributes (for awareness)

| Deprecated File | Unique Content Still Valid | Superseded By |
|---|---|---|
| `bot-sync.sql` | V1 `sync_source_listings()` RPC (no skip-inactive). If V2 is not deployed yet, V1 is the live RPC. | V2 in `source-engine-skip-inactive.sql` |
| `production-hardening.sql` | Listing timestamp fallback UPDATE statements (lines 17-24: `first_seen_at = coalesce(first_seen_at, created_at, now())`) | These should be migrated into schema.sql |
| `favorites.sql` | Primary key rename DO block (bigint → identity migration) | Schema.sql has correct type from the start |
| `source-bot-publish-mode.sql` | — | Fully absorbed |
| `source-integration-settings.sql` | — | Fully absorbed |

---

## 4. Files That Replace Them

| Old/Deprecated File | Replacement | Migration Required |
|---|---|---|
| `bot-sync.sql` (V1 sync_source_listings) | `source-engine-skip-inactive.sql` (V2) | **Yes** — V2 overwrites V1 with `create or replace function`. The V2 RPC signature includes `p_skip_inactive_marking boolean default false` as the 3rd parameter. |
| `price-history.sql` | `price-history-backfill-support.sql` | No — backfill-support.sql uses `create table if not exists`, so it's safe to run after price-history.sql or on its own. |
| `price-history-created-at.sql` | `price-history-backfill-support.sql` | No — backfill-support.sql already includes `created_at`. |
| `listing-images.sql` | `schema.sql` | No — schema.sql already has `image_url`. |
| `listing-status.sql` | `schema.sql` | No — schema.sql already has all 5 columns + status check. |
| `favorites.sql` | `schema.sql` | No — schema.sql has the complete favorites table. |
| `production-hardening.sql` (RLS portion) | `schema.sql` | No — schema.sql has all RLS policies. |
| `source-bot-publish-mode.sql` | `sources-and-bots.sql` | No — sources-and-bots.sql has `bot_listing_status` in its CREATE TABLE. |
| `source-integration-settings.sql` | `sources-and-bots.sql` | No — sources-and-bots.sql has all columns in its CREATE TABLE + seed updates in bot-scheduler.sql. |
| `bot-sync.sql` (listing columns) | `listings-schema-sync.sql` (migration) | No — schema.sql is the canonical base, and listings-schema-sync.sql is the production migration. |

---

## 5. Fresh Installation Order

For a **brand-new Supabase project** with zero tables. Execute in this exact order.

### Phase A — Foundation Tables

| Step | File | Creates | Why Here |
|---|---|---|---|
| 0 | Enable pgcrypto extension manually | `CREATE EXTENSION pgcrypto` | Required by price-alerts.sql UUID. Run separately before any SQL files. |
| **1** | **`schema.sql`** | products, listings (base), search_events, favorites (base), price_alerts (base), base indexes, track_listing_price_change trigger, RLS, seed products | **MUST BE FIRST.** All other tables reference products/listings via foreign keys. |
| **2** | **`sources-and-bots.sql`** | sources (complete), bot_runs (base), seed sources (10 rows), indexes, RLS | MUST be before any file that references sources.id or bot_runs.id (every bot-related file). |
| **3** | **`bot-scheduler.sql`** | sources columns (integration_type, fetch_limit, bot_import_mode, cron_enabled, last_run_at), check constraints, URL seed updates | Adds scheduler columns to sources. Must run after sources table exists. |
| **4** | **`search-demand-queue.sql`** | search_demands, bot_queue, indexes, triggers, RLS | Must run after sources (bot_queue.source_id FK). Independent from other tables. |
| **5** | **`price-alerts.sql`** | price_alerts (complete with UUID migration, expanded schema, all indexes, set_updated_at trigger, RLS) | Completely replaces schema.sql's basic price_alerts. Can run anytime after schema.sql. |
| **6** | **`site-settings.sql`** | site_settings, seed data, get_admin_platform_stats | Standalone. No dependencies. |

### Phase B — Listing Extensions

| Step | File | Creates | Why Here |
|---|---|---|---|
| **7** | **`bot-sync.sql`** (EXCEPT the V1 RPC) | price_history (basic), listing columns (source_id, description, old_price, brand, model, storage, ram, color, warranty, seller_name, source_type, category), set_listing_updated_at trigger, listing indexes (source_id_external_id_key, source_id_url_key, source_id_status_idx) | Adds columns needed by adapters. The listing columns here are the canonical first introduction. |
| **8** | **`price-history-backfill-support.sql`** | price_history (complete with created_at, all indexes), record_listing_price_history trigger, backfill_price_history_from_listings function | Run AFTER bot-sync.sql so price_history already exists and the trigger can be added on top. |
| **9** | **`product-slugs.sql`** | slug column, slugify_product_name, set_product_slug trigger, backfill, unique index | Run after seed products are inserted (step 1). |

### Phase C — Migration-Like Additions

| Step | File | Creates | Why Here |
|---|---|---|---|
| **10** | **`products-normalized-key.sql`** | normalized_key column, compute_normalized_key, set_product_normalized_key trigger, backfill, unique index | Runs after product-slugs to add the second computed column. |
| **11** | **`bot-center-monitoring.sql`** | matched_product_count on bot_runs, run_type_created_at_idx | Minor addition to bot_runs. |
| **12** | **`listings-schema-sync.sql`** | All listing columns idempotently, additional indexes (source_external_id_key, last_seen_at_idx, imported_at_idx) | Production safety net. Ensures no column is missing. |
| **13** | **`source-engine-skip-inactive.sql`** | V2 sync_source_listings (with p_skip_inactive_marking) | **MUST BE LAST.** Overwrites bot-sync.sql V1 RPC. |

### Files Skipped in Fresh Installation

The following files should **NOT** be executed in a fresh installation (listed for awareness only):

| File | Reason |
|---|---|
| `listing-images.sql` | Zero unique content. `image_url` already in schema.sql. |
| `listing-status.sql` | Zero unique content. All columns in schema.sql. |
| `price-history.sql` | Zero unique content. table in bot-sync.sql, trigger in backfill-support.sql. |
| `price-history-created-at.sql` | Zero unique content. `created_at` in backfill-support.sql. |
| `favorites.sql` | Fully redundant with schema.sql. |
| `source-bot-publish-mode.sql` | Fully absorbed into sources-and-bots.sql + bot-scheduler.sql. |
| `source-integration-settings.sql` | Fully absorbed into sources-and-bots.sql + bot-scheduler.sql. |
| `production-hardening.sql` | Redundant RLS (in schema.sql), redundant listing columns (in schema.sql). Only unique content is the timestamp fallback UPDATEs. |

---

## 6. Migration Order for Existing Production

For an **existing production database** that has been running previously with some subset of these files already applied.

### Pre-Flight: Determine Current State

Before running migrations, verify which objects already exist:

```sql
-- Check if V1 or V2 of sync_source_listings is deployed
SELECT proname, pronargs, pg_get_function_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'sync_source_listings';

-- Check if price_history table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'price_history'
);

-- Check if favorites has UUID or bigint primary key
SELECT data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'price_alerts' AND column_name = 'id';

-- Check if normalized_key exists
SELECT EXISTS (
  SELECT FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'normalized_key'
);

-- Check if slug exists
SELECT EXISTS (
  SELECT FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'slug'
);
```

### Migration Sequence

| Step | File | Risk Level | Description |
|---|---|---|---|
| **1** | `schema.sql` | **None** | Idempotent. Will not override existing data. Safe to re-run. |
| **2** | `sources-and-bots.sql` | **Low** | Uses `on conflict (slug) do update`. Will not create duplicate sources. Safe to re-run. |
| **3** | `bot-scheduler.sql` | **Low** | All `add column if not exists` + DO block constraints. Safe to re-run. |
| **4** | `search-demand-queue.sql` | **None** | All `create table if not exists`. Safe to re-run. |
| **5** | `price-alerts.sql` | **Medium** | Contains UUID conversion DO block. If price_alerts already has UUID ids, the DO block detects `data_type <> 'uuid'` and skips. Safe to re-run. |
| **6** | `site-settings.sql` | **None** | All `create table if not exists`. Seed uses `on conflict (key) do nothing`. Safe. |
| **7** | `bot-sync.sql` | **Low** | All `add column if not exists`. The V1 RPC is harmless (will be overwritten in step 13). Safe to re-run. |
| **8** | `price-history-backfill-support.sql` | **Medium** | `create table if not exists`. The trigger `record_listing_price_history` is the main change — starts recording price history automatically on listing INSERT/UPDATE. Run during low traffic. |
| **9** | `product-slugs.sql` | **Low** | Backfill sets slugs for existing rows. Slug dedup appends `-{id}` for collisions. Safe. |
| **10** | `products-normalized-key.sql` | **Low** | Backfill computes keys for existing rows. Key dedup appends `-{id}` for collisions. Safe. |
| **11** | `bot-center-monitoring.sql` | **None** | One column + one index. Safe. |
| **12** | `listings-schema-sync.sql` | **Low** | All `add column if not exists`. Adds several useful indexes (last_seen_at, imported_at). Safe. |
| **13** | `source-engine-skip-inactive.sql` | **Medium** | **THIS IS THE CRITICAL MIGRATION.** Overwrites V1 `sync_source_listings()` with V2. The V2 RPC signature adds `p_skip_inactive_marking boolean default false`. Backward compatible — all existing callers continue to work (default false = same behavior as V1). Run during maintenance window. |

### Migration with Schema Fallback Protection

If your application already uses `saveListingWithSchemaFallback()` (both cron and instant-bot routes), you can run migrations without downtime. The fallback strips unknown columns and retries. However, for RPC signature changes (step 13), ensure the V2 function is deployed before or simultaneously with application code that passes `p_skip_inactive_marking`.

---

## 7. Rollback Order

Rollbacks should reverse the migration order. Most SQL files are additive-only and cannot be rolled back directly — you need to write explicit reversal SQL.

### Rollback Steps (reverse order)

| Step | Reversal SQL | Risk |
|---|---|---|
| **13 V2 RPC** | `CREATE OR REPLACE FUNCTION public.sync_source_listings(p_source_id bigint, p_items jsonb) ...` using V1 body from `bot-sync.sql` | **Medium** — reverts to V1, which always marks inactive. Any callers passing `p_skip_inactive_marking` will fail. |
| **12 Schema sync** | No rollback needed. All additive `add column if not exists`. Can leave columns. To remove: `ALTER TABLE public.listings DROP COLUMN IF EXISTS location, DROP COLUMN IF EXISTS product_key, DROP COLUMN IF EXISTS confidence_score, DROP COLUMN IF EXISTS currency;` | **High** — data loss. Only roll back if zero data exists in these columns. |
| **11 Bot monitoring** | `ALTER TABLE public.bot_runs DROP COLUMN IF EXISTS matched_product_count; DROP INDEX IF EXISTS bot_runs_run_type_created_at_idx;` | **Low** — no data loss from column drop |
| **10 normalized_key** | `DROP TRIGGER IF EXISTS products_set_normalized_key ON public.products; DROP FUNCTION IF EXISTS public.set_product_normalized_key; DROP FUNCTION IF EXISTS public.compute_normalized_key; ALTER TABLE public.products DROP COLUMN IF EXISTS normalized_key;` | **Medium** — removes the unique index. Application code will fall back to paginated scan (Phase 1 behavior). |
| **9 Product slugs** | `DROP TRIGGER IF EXISTS products_set_slug ON public.products; DROP FUNCTION IF EXISTS public.set_product_slug; DROP FUNCTION IF EXISTS public.slugify_product_name; DROP INDEX IF EXISTS products_slug_key; ALTER TABLE public.products DROP COLUMN IF EXISTS slug;` | **Low** — app generates slugs in code |
| **8 Price history trigger** | `DROP TRIGGER IF EXISTS listings_record_price_history ON public.listings; DROP FUNCTION IF EXISTS public.record_listing_price_history; DROP FUNCTION IF EXISTS public.backfill_price_history_from_listings;` | **Low** — cron routes record price history explicitly via `recordListingPriceHistory()` library call |
| **7 Bot sync V1** | `DROP FUNCTION IF EXISTS public.sync_source_listings(p_source_id bigint, p_items jsonb); DROP TRIGGER IF EXISTS listings_set_updated_at ON public.listings; DROP FUNCTION IF EXISTS public.set_listing_updated_at;` | **HIGH** — listing sync will fail. Only roll back if V2 is deployed as well. |
| **6 Site settings** | `DROP FUNCTION IF EXISTS public.get_admin_platform_stats; DROP TABLE IF EXISTS public.site_settings;` | **Low** — admin panel will lose stats display |
| **5 Price alerts** | `DROP TRIGGER IF EXISTS price_alerts_set_updated_at ON public.price_alerts; DROP TABLE IF EXISTS public.price_alerts;` | **High** — data loss for all user price alerts |
| **4 Search queue** | `DROP TRIGGER IF EXISTS bot_queue_set_updated_at ON public.bot_queue; DROP TABLE IF EXISTS public.bot_queue; DROP TABLE IF EXISTS public.search_demands;` | **Low** — queue jobs will drain on restart |
| **3 Bot scheduler** | `ALTER TABLE public.sources DROP CONSTRAINT IF EXISTS sources_integration_type_check, DROP CONSTRAINT IF EXISTS sources_fetch_limit_check, DROP CONSTRAINT IF EXISTS sources_bot_import_mode_check; ALTER TABLE public.sources DROP COLUMN IF EXISTS integration_type, DROP COLUMN IF EXISTS fetch_limit, DROP COLUMN IF EXISTS bot_import_mode, DROP COLUMN IF EXISTS cron_enabled, DROP COLUMN IF EXISTS last_run_at;` | **Low** — scheduler will lose config, defaults reapply on re-run |
| **2 Sources** | `DROP TABLE IF EXISTS public.bot_runs; DROP TABLE IF EXISTS public.sources;` | **Critical** — data loss for all sources, bot runs, all bot-managed listings (source_id FK will break). |
| **1 Schema** | `DROP TRIGGER IF EXISTS listings_track_price_change ON public.listings; DROP FUNCTION IF EXISTS public.track_listing_price_change; DROP TABLE IF EXISTS public.price_alerts CASCADE; DROP TABLE IF EXISTS public.favorites CASCADE; DROP TABLE IF EXISTS public.search_events CASCADE; DROP TABLE IF EXISTS public.listings CASCADE; DROP TABLE IF EXISTS public.products CASCADE;` | **Critical** — total data loss |

### Safe Rollback for Mistakes

If a migration in steps 8-13 causes issues within the maintenance window:

```sql
-- Revert step 13 (V2 RPC only — preserves all data)
CREATE OR REPLACE FUNCTION public.sync_source_listings(p_source_id bigint, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  -- Paste V1 function body from supabase/bot-sync.sql lines 92-373
$$;

-- Revert step 8 (price history trigger only)
DROP TRIGGER IF EXISTS listings_record_price_history ON public.listings;
DROP FUNCTION IF EXISTS public.record_listing_price_history;
```

---

## 8. Verification Queries

Run these after deployment to confirm every object exists correctly.

### 8.1 Table Verification

```sql
-- All expected tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'products', 'listings', 'search_events', 'favorites',
    'price_alerts', 'price_history', 'site_settings',
    'sources', 'bot_runs', 'search_demands', 'bot_queue'
  )
ORDER BY table_name;
```
Expected: 11 rows, one per table.

### 8.2 Function Verification

```sql
-- All expected functions
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'track_listing_price_change', 'set_listing_updated_at',
    'sync_source_listings', 'slugify_product_name',
    'set_product_slug', 'record_listing_price_history',
    'backfill_price_history_from_listings',
    'set_price_alerts_updated_at', 'get_admin_platform_stats',
    'compute_normalized_key', 'set_product_normalized_key',
    'set_bot_queue_updated_at'
  )
ORDER BY proname;
```
Expected: 12 rows. Confirm `sync_source_listings` has 3 arguments (p_source_id, p_items, p_skip_inactive_marking).

### 8.3 Trigger Verification

```sql
-- All expected triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'listings_track_price_change', 'listings_set_updated_at',
    'listings_record_price_history', 'products_set_slug',
    'products_set_normalized_key', 'price_alerts_set_updated_at',
    'bot_queue_set_updated_at'
  )
ORDER BY trigger_name;
```
Expected: 7 rows.

### 8.4 Index Verification

```sql
-- All expected indexes (excluding primary key indexes and generated ones)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('products', 'listings', 'search_events', 'favorites',
                    'price_alerts', 'price_history', 'sources', 'bot_runs',
                    'search_demands', 'bot_queue')
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;
```
Expected index count: ~25-30 (exact count depends on which duplicates have been executed).

### 8.5 RLS Policy Verification

```sql
-- All expected RLS policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
Expected policies:
- `products`: "Products are publicly readable"
- `listings`: "Listings are publicly readable", "Anyone can submit listings"
- `search_events`: "Search events are publicly readable", "Anyone can record searches"
- `favorites`: "Users can read their favorites", "Users can add their favorites", "Users can remove their favorites"
- `price_alerts`: "Users can read their price alerts", "Users can add their price alerts", "Users can update their price alerts", "Users can remove their price alerts"
- `price_history`: "Public can read price history"
- `search_demands`: "Users can read their search demands", "Anyone can create anonymous search demands"

### 8.6 Unique Constraint Verification

```sql
-- All unique constraints on key tables
SELECT conrelid::regclass::text AS table_name,
       conname AS constraint_name,
       pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE contype = 'u'
  AND conrelid::regclass::text IN ('products', 'listings', 'favorites', 'sources')
ORDER BY table_name, constraint_name;
```
Expected:
- products: at least `products_name_key`, `products_slug_key`, `products_normalized_key_key`
- listings: `listings_source_external_id_key`, `listings_source_id_external_id_key`, `listings_source_id_url_key`
- favorites: `favorites_user_id_listing_id_key`
- sources: `sources_slug_key`

### 8.7 Check Constraint Verification

```sql
-- All check constraints
SELECT conrelid::regclass::text AS table_name,
       conname,
       pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'c'
ORDER BY table_name, conname;
```
Expected (partial list):
- listings: `listings_status_check` — `CHECK (status IN ('pending', 'published', 'rejected', 'active', 'inactive'))`
- sources: `sources_bot_listing_status_check`, `sources_bot_import_mode_check`, `sources_product_limit_check`, `sources_fetch_limit_check`, `sources_integration_type_check`
- price_alerts: `price_alerts_product_or_listing_check`, `price_alerts_target_price_check`, `price_alerts_status_check`

### 8.8 Seed Data Verification

```sql
-- Products seed
SELECT name, category FROM public.products ORDER BY id;

-- Sources seed
SELECT name, slug, type, bot_listing_status FROM public.sources ORDER BY id;

-- Site settings
SELECT key, value FROM public.site_settings ORDER BY key;
```

### 8.9 RPC Smoke Test (Dry Run)

```sql
-- Test V2 sync_source_listings signature exists
SELECT proname, pronargs,
       pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'sync_source_listings';
-- Expected: 3 arguments, last one "p_skip_inactive_marking boolean default false"

-- Test slugify_product_name
SELECT public.slugify_product_name('iPhone 15 Pro Max 256GB');
-- Expected: "iphone-15-pro-max-256gb"

-- Test compute_normalized_key
SELECT public.compute_normalized_key('Samsung Galaxy S24 Ultra 256GB');
-- Expected: "samsung-galaxy-s24-ultra-256gb"
-- Test fallback
SELECT public.compute_normalized_key('Generic Unknown Product XYZ');
-- Expected: "generic-unknown-product-xyz"

-- Test get_admin_platform_stats returns valid JSON
SELECT jsonb_typeof(public.get_admin_platform_stats());
-- Expected: "object"
```

### 8.10 V1 → V2 Migration Verification

```sql
-- Confirm only ONE sync_source_listings exists (V2 has overwritten V1)
SELECT proname, pronargs, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'sync_source_listings';
-- Expected: exactly 1 row with 3 arguments including p_skip_inactive_marking
```

### 8.11 Price History Trigger Active

```sql
-- Verify price history trigger is installed and not disabled
SELECT trigger_name, event_manipulation, action_timing, action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'listings'
  AND trigger_name = 'listings_record_price_history';
-- Expected: 1 row, event_manipulation = 'INSERT' OR 'UPDATE'

-- Verify price history has data flowing
SELECT count(*) > 0 AS has_data FROM public.price_history;
```

### 8.12 Full Deployment Health Check

Run this to generate a deployment report card:

```sql
WITH
tables_ok AS (
  SELECT count(*) = 11 AS ok FROM (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name IN ('products','listings','search_events','favorites',
                         'price_alerts','price_history','site_settings',
                         'sources','bot_runs','search_demands','bot_queue')
  ) t
),
functions_ok AS (
  SELECT count(*) >= 12 AS ok FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('track_listing_price_change','sync_source_listings',
                    'slugify_product_name','compute_normalized_key',
                    'get_admin_platform_stats')
),
v2_rpc_ok AS (
  SELECT count(*) = 1 AS ok FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname = 'sync_source_listings' AND pronargs = 3
),
triggers_ok AS (
  SELECT count(*) >= 7 AS ok FROM information_schema.triggers
  WHERE trigger_schema = 'public'
),
rls_on AS (
  SELECT count(*) >= 1 AS ok FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = true
)
SELECT 'TABLES' AS check_name, tables_ok.ok FROM tables_ok
UNION ALL SELECT 'FUNCTIONS', functions_ok.ok FROM functions_ok
UNION ALL SELECT 'V2_RPC_3ARGS', v2_rpc_ok.ok FROM v2_rpc_ok
UNION ALL SELECT 'TRIGGERS', triggers_ok.ok FROM triggers_ok
UNION ALL SELECT 'RLS_ENABLED', rls_on.ok FROM rls_on;
```
All checks should return `true`.

---

## Appendix A: SQL File Inventory (All 22 Files)

| # | File | Lines | Status | Purpose |
|---|---|---|---|---|
| 1 | `schema.sql` | 235 | **ACTIVE** | Base schema: 5 tables, indexes, RLS, seed data, price change trigger |
| 2 | `sources-and-bots.sql` | 103 | **ACTIVE** | Sources + bot_runs tables, seed data |
| 3 | `bot-scheduler.sql` | 92 | **ACTIVE** | Scheduler columns on sources, URL seed updates |
| 4 | `search-demand-queue.sql` | 86 | **ACTIVE** | Search demands + bot queue tables |
| 5 | `price-alerts.sql` | 187 | **ACTIVE** | Price alerts (UUID, expanded schema, all indexes, RLS) |
| 6 | `site-settings.sql` | 120 | **ACTIVE** | Site settings table, admin stats function |
| 7 | `bot-sync.sql` | 374 | **DEPRECATED** | V1 sync RPC, listing columns (absorbed elsewhere) |
| 8 | `price-history-backfill-support.sql` | 151 | **ACTIVE** | Price history table complete, trigger, backfill function |
| 9 | `product-slugs.sql` | 76 | **ACTIVE** | Slug column, slugify function, trigger |
| 10 | `source-engine-skip-inactive.sql` | 288 | **ACTIVE** | V2 sync RPC (overwrites V1) |
| 11 | `products-normalized-key.sql` | 176 | **ACTIVE** | normalized_key, compute function, trigger |
| 12 | `bot-center-monitoring.sql` | 6 | **ACTIVE** | matched_product_count on bot_runs |
| 13 | `listings-schema-sync.sql` | 73 | **ACTIVE** | All listing columns idempotently, extra indexes |
| 14 | `listings-raw-payload.sql` | 5 | **OPTIONAL** | raw_payload on listings (already in schema.sql) |
| 15 | `listing-images.sql` | 1 | **NEVER EXECUTE** | Zero unique content |
| 16 | `listing-status.sql` | 21 | **NEVER EXECUTE** | Zero unique content |
| 17 | `price-history.sql` | 36 | **NEVER EXECUTE** | Zero unique content |
| 18 | `price-history-created-at.sql` | 5 | **NEVER EXECUTE** | Zero unique content |
| 19 | `favorites.sql` | 94 | **DEPRECATED** | Redundant with schema.sql |
| 20 | `production-hardening.sql` | 86 | **DEPRECATED** | Redundant RLS + listing columns |
| 21 | `source-bot-publish-mode.sql` | 14 | **DEPRECATED** | Fully absorbed elsewhere |
| 22 | `source-integration-settings.sql` | 27 | **DEPRECATED** | Fully absorbed elsewhere |

## Appendix B: Object Count Summary

| Object Type | Count | Notes |
|---|---|---|
| Tables | 11 | products, listings, search_events, favorites, price_alerts, price_history, site_settings, sources, bot_runs, search_demands, bot_queue |
| Functions | 12 | 11 PL/pgSQL + slugify_product_name (SQL) |
| Triggers | 7 | 3 on listings, 2 on products, 1 on price_alerts, 1 on bot_queue |
| Indexes (unique) | ~28 | Including partial indexes and unique constraints |
| RLS Policies | ~16 | Across 7 tables |
| Seed data sets | 3 | Products (5), sources (10), site_settings (2) |
| Check constraints | ~8 | listings_status, 3 sources constraints, 3 price_alerts constraints |
| Extensions | 1 | pgcrypto |
