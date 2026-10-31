---
name: query-prod-data
description: Query production data read-only from the relational store and the load-timing telemetry dataset, using only table and column claims verified against the migration files and the telemetry query code. Use when looking up users, rooms, room participants, or load timing. Never claims access from an unauthenticated environment.
---

# query-prod-data

> User-facing output during this skill (progress reports, questions, completion notices, error messages) is in Chinese.

Query production data read-only. This skill documents only what the migration files and the telemetry query code support.

## Access boundary (read first)

Production access depends entirely on the operator's own authenticated environment. This skill makes no claim that production is reachable from an unauthenticated or sandboxed environment. If the operator's environment cannot authenticate, stop and report that plainly. No credential, token, or account identifier appears anywhere in this skill.

## Triggers

Use this skill when:

- Looking up a user, a room, a room's participants, or a user's related records in the production relational store.
- Querying load-timing telemetry for a time range.

Do not use this skill when:

- The request needs a write, a delete, a migration, or any change to production data. This skill is read-only.
- The request needs realtime game state, role assignments, or night actions. Those live in the room authority store, not in the relational tables documented here, and this skill does not document how to query them. Say so instead of inventing a query.
- The request needs a table, column, or telemetry field that is not listed in `references/tables-and-columns.md`. Stop and verify it against the migration files or the telemetry query code first.
- The operator cannot authenticate in their own environment. Stop and report the access gap.

## Must-read references

Read these before writing any query.

- `references/tables-and-columns.md` — every table and column this skill may name, verified against the migration files, plus the deleted inference query and its replacement.
- `references/telemetry.md` — the only telemetry fields this skill may name, and the only supported query shape.

## Procedure

### Step 1 — Confirm the question and the environment

State the exact question in one sentence: which user, room, or time range, and what fact is needed. The commands run from `packages/api-worker/`.

### Step 2 — Authenticate, without a time claim

If an authentication failure occurs, re-authenticate following the tool's own documentation for the operator's environment. This skill states no token or session expiry period. If re-authentication needs interactive browser steps, hand that step to the operator and wait.

### Step 3 — Choose the source and name only verified columns

Choose exactly one source: the relational store, or the load-timing telemetry dataset. Write the query using only the tables and columns in `references/tables-and-columns.md` or the fields in `references/telemetry.md`. List columns explicitly. `users` contains `password_hash` (`0001_init.sql`).

### Step 4 — Write a read-only query

Every query must be a single read-only select. No insert, update, delete, migration, or schema statement. Use the SQLite dialect: `datetime()` for time arithmetic; interval syntax is not supported. All stored times are UTC (migrations use `datetime('now')`); Beijing time is UTC plus 8 hours. State the time range and the timezone conversion in the report, not only in the query.

### Step 5 — Run the relational query

From `packages/api-worker/`, run the query against the named production database with the remote flag:

```bash
npx wrangler d1 execute werewolf-db --remote --command "<SQL>"
```

Check the result shape before interpreting it: confirm the row count, confirm the key columns joined as expected, and confirm no row is being read as evidence for a different room or user. If the query returns no rows, report "no rows" plainly.

### Step 6 — Run the telemetry query, if the question is about load timing

Use only the query shape in `references/telemetry.md`, with the code-supported fields only. Use the operator's authenticated request method for the telemetry API, following the tool's own documentation (no token in the command line, no account identifier). If the operator's authenticated method is unavailable, stop and report that.

### Step 7 — Interpret without inference

Report only what the rows show. In particular:

- Read room participants from the participants table directly (`references/tables-and-columns.md`); the time-window inference query is deleted (see that reference).
- A telemetry average is reported with its time range, its grouping, and its sample weighting as written in the query.
- This skill documents no realtime room state, lifetime, or recoverability claim.

### Step 8 — Report and clean up

Report in Chinese: the question, the exact query run (with any literal identifiers redacted to the minimum needed for the operator to re-run it), the row count and the findings, and the time range with its timezone. State plainly what was not checked. Leave no query output containing sensitive columns in any file.

## Acceptance commands

```bash
npx wrangler d1 execute werewolf-db --remote --command "<read-only SQL>"
```

Acceptance is: the query is read-only, uses only verified tables and columns, ran in the operator's authenticated environment, and the report states the row count, the time range, and what was not checked. There is no acceptance command for telemetry beyond the operator's authenticated request using the shape in `references/telemetry.md`.

## Pitfalls

1. Inferring room participants from a creation-time window. The participants table exists; query it directly.
2. Using the old participants shape keyed by room code. The current shape is keyed by room id. See `references/tables-and-columns.md`.
3. Naming telemetry fields beyond the code-supported set. The rest are unverified and omitted.
