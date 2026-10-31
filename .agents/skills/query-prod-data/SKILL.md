---
name: query-prod-data
description: Query production data read-only from the relational store and the load-timing telemetry dataset, using only table and column claims verified against the migration files and the telemetry query code. Use when looking up users, rooms, room participants, or load timing. Never claims access from an unauthenticated environment.
---

# query-prod-data

> User-facing output during this skill (progress reports, questions, completion notices, error messages) is in Chinese.

Query production data read-only. This skill documents only what the migration files and the telemetry query code support. Anything else is marked unverified and omitted, not guessed.

## Access boundary (read first)

Production access depends entirely on the operator's own authenticated environment. This skill must never claim that production can be reached from an unauthenticated or sandboxed environment, and must never claim that a query ran when it did not. If the operator's environment cannot authenticate, stop and report that plainly. No credential, token, or account identifier appears anywhere in this skill. Never paste a credential into a command, a file, or a report, and never read a credential file to extract a token.

## Triggers

Use this skill when:

- Looking up a user, a room, a room's participants, or a user's related records in the production relational store.
- Querying load-timing telemetry for a time range.

Do not use this skill when:

- The request needs a write, a delete, a migration, or any change to production data. This skill is read-only. Refuse the write and say what read-only query, if any, would answer the underlying question.
- The request needs realtime game state, role assignments, or night actions. Those live in the room authority store, not in the relational tables documented here, and this skill does not document how to query them. Say so instead of inventing a query.
- The request needs a table, column, or telemetry field that is not listed in `references/tables-and-columns.md`. Stop and verify it against the migration files or the telemetry query code first; do not guess it.
- The operator cannot authenticate in their own environment. Stop and report the access gap; do not work around it.

## Must-read references

Read these before writing any query.

- `references/tables-and-columns.md` — every table and column this skill may name, verified against the migration files, plus the deleted inference query and its replacement.
- `references/telemetry.md` — the only telemetry fields this skill may name, and the only supported query shape.

## Procedure

### Step 1 — Confirm the question and the environment

State the exact question in one sentence: which user, room, or time range, and what fact is needed. Confirm the operator is working in their own authenticated environment and that the commands will run from `packages/api-worker/`. If either is unconfirmed, ask and wait. Do not proceed on an assumed environment.

### Step 2 — Authenticate, without a time claim

If an authentication failure occurs, re-authenticate following the tool's own documentation for the operator's environment. This skill makes no claim about how long any token or session lasts: no expiry period was found in a repository source, so none is stated. Do not quote an expiry number from memory, and do not name a credential file path. If re-authentication needs interactive browser steps, hand that step to the operator and wait.

### Step 3 — Choose the source and name only verified columns

Choose exactly one source: the relational store, or the load-timing telemetry dataset. Write the query using only the tables and columns in `references/tables-and-columns.md` or the fields in `references/telemetry.md`. List columns explicitly. Never use a wildcard select on the users table: it contains a sensitive credential-hash column. Never select that column, and never include it in output.

### Step 4 — Write a read-only query

Every query must be a single read-only select. No insert, update, delete, migration, or schema statement. Use the SQLite dialect: `datetime()` for time arithmetic; interval syntax is not supported. All stored times are UTC; Beijing time is UTC plus 8 hours. State the time range and the timezone conversion in the report, not only in the query.

### Step 5 — Run the relational query

From `packages/api-worker/`, run the query against the named production database with the remote flag:

```bash
npx wrangler d1 execute werewolf-db --remote --command "<SQL>"
```

Check the result shape before interpreting it: confirm the row count, confirm the key columns joined as expected, and confirm no row is being read as evidence for a different room or user. If the query returns no rows, report "no rows" plainly; do not infer a reason from the absence.

### Step 6 — Run the telemetry query, if the question is about load timing

Use only the query shape in `references/telemetry.md`, with the code-supported fields only. Use the operator's authenticated request method for the telemetry API, following the tool's own documentation. Never embed a token in the command line, never read a token out of a credential file, and never include an account identifier copied from an example. If the operator's authenticated method is unavailable, stop and report that; do not substitute an unauthenticated call.

### Step 7 — Interpret without inference

Report only what the rows show. In particular:

- Room participants are read from the participants table directly. Never infer participants from a user-creation time window, and never present a time-window user list as a participant list.
- A telemetry average is reported with its time range, its grouping, and its sample weighting as written in the query. Do not convert a load average into a claim about a specific user, device, or cause.
- Do not state anything about realtime room state, its lifetime, or its recoverability. This skill documents none of it, because no deciding code was read for it during drafting.

### Step 8 — Report and clean up

Report in Chinese: the question, the exact query run (with any literal identifiers redacted to the minimum needed for the operator to re-run it), the row count and the findings, and the time range with its timezone. State plainly what was not checked. Remove nothing from production and leave no credential, token, or query output containing sensitive columns in any file.

## Acceptance commands

```bash
npx wrangler d1 execute werewolf-db --remote --command "<read-only SQL>"
```

Acceptance is: the query is read-only, uses only verified tables and columns, ran in the operator's authenticated environment, and the report states the row count, the time range, and what was not checked. There is no acceptance command for telemetry beyond the operator's authenticated request using the shape in `references/telemetry.md`.

## Pitfalls

1. Inferring room participants from a creation-time window. The participants table exists; query it directly.
2. Using the old participants shape keyed by room code. The current shape is keyed by room id. See `references/tables-and-columns.md`.
3. Naming telemetry fields beyond the code-supported set. The rest are unverified and omitted.
4. Stating a token expiry period, naming a credential file, or pasting a token into a command.
5. Claiming production access, room-state lifetime, or recoverability that this skill does not document.
