# Tables and columns

Source: the migration files in `packages/api-worker/migrations/` (64 files, latest `0065_demo.sql`), read sequentially at drafting time. Only the tables and columns listed here may be named by this skill. If a needed table or column is not listed, verify it against the migrations first; do not guess it.

## users — 18 columns, verified

Base columns from `0001_init.sql` (10): `id`, `email`, `password_hash`, `display_name`, `avatar_url`, `custom_avatar_url`, `avatar_frame`, `is_anonymous`, `created_at`, `updated_at`.

Added by later migrations (8): `wechat_openid` (`0007`), `equipped_flair` (`0011`), `equipped_name_style` (`0012`), `last_country` and `last_colo` (`0014`), `equipped_effect` (`0018`), `equipped_seat_animation` (`0019`), `token_version` (`0020`).

Full list, in migration order:

```
id, email, password_hash, display_name, avatar_url, custom_avatar_url,
avatar_frame, is_anonymous, created_at, updated_at, wechat_openid,
equipped_flair, equipped_name_style, last_country, last_colo,
equipped_effect, equipped_seat_animation, token_version
```

Rules: never use a wildcard select on this table. `password_hash` is sensitive; never select it and never include it in output. List explicitly only the columns the question needs. The `last_country` / `last_colo` columns record the most recent values seen; do not present them as a verified current location.

## rooms — current shape, from the 0065 rebuild

```
id, code, game_type, host_user_id, creation_id, config_json, status,
failure_operation, last_error, reconciliation_attempt_count,
reconcile_after, delete_requested_by, created_at, updated_at,
games_started, last_started_at
```

Notes: `code` is the four-digit room code. The host column is `host_user_id` (not an older `host_id` name from the initial schema). `status` is one of `creating`, `active`, `deleting`, `failed`. Filter lookups by `code` and, where the question needs it, by `game_type` and `status`; the previous version of this skill omitted those filters and they are needed for a precise lookup.

## room_participants — exists; query it directly

Current shape (established by `0036_room_directory_saga.sql`, rebuilt with the same shape in every later registration migration including `0065_demo.sql`):

```
room_id, user_id, joined_at
PRIMARY KEY (room_id, user_id)
```

`room_id` references `rooms(id)`; `user_id` references `users(id)`; both foreign keys cascade on delete. Join to `rooms` on `room_participants.room_id = rooms.id`, and to `users` on `room_participants.user_id = users.id`.

### Deleted query (do not use)

The previous version of this skill stated that room participants are not stored and offered a query inferring participants from users created within a time window around a room's creation. That statement is false, and the inference query is deleted outright. It must not be restored, quoted as an alternative, or used as a fallback. The replacement query is:

```sql
SELECT u.id, u.display_name, u.last_country, u.last_colo, rp.joined_at
FROM room_participants rp
JOIN users u ON rp.user_id = u.id
JOIN rooms r ON rp.room_id = r.id
WHERE r.code = '{ROOM_CODE}'
ORDER BY rp.joined_at
```

### Old shape warning

The original participants table (`0024_room_participants.sql`) was keyed by `room_code`, not `room_id`. That shape was replaced in `0036`. Do not write queries against `room_code` on the current table; the column does not exist there. If a historical question needs the pre-0036 shape, say so explicitly and verify the migration range before querying.

## Other tables named by this skill (verified columns only)

| Table                   | Verified columns / facts                                                                                                                                            | Migration                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `user_stats`            | Has a `user_id` foreign key to `users`. Other columns are not listed here; read the migration before selecting them.                                                | `0025_cascade_user_fks.sql`    |
| `draw_history`          | Has a `user_id` foreign key to `users`. Other columns are not listed here; read the migration before selecting them.                                                | `0025_cascade_user_fks.sql`    |
| `refresh_tokens`        | Has a `user_id` foreign key to `users`. Other columns are not listed here; read the migration before selecting them.                                                | `0020_auth_refresh_tokens.sql` |
| `login_attempts`        | `email_hash`, `attempted_at`. No IP column exists in this table.                                                                                                    | `0005_login_attempts.sql`      |
| `password_reset_tokens` | `id`, `user_id`, `token_hash`, `expires_at`, `used`, `created_at`.                                                                                                  | `0003_password_reset.sql`      |
| `room_game_starts`      | Rebuilt alongside `rooms` in the registration migrations; keyed by room id with a started revision and timestamp. Read the latest rebuild before selecting columns. | `0065_demo.sql` (rebuild)      |

For `user_stats`, `draw_history`, and `refresh_tokens`, the previous version's guidance to select all columns is not carried: list the columns needed after reading the defining migration. Do not select token material.

## Room and host lookup

```sql
SELECT r.id, r.code, r.game_type, r.status, r.created_at,
       u.id AS host_id, u.display_name, u.last_country, u.last_colo
FROM rooms r
JOIN users u ON r.host_user_id = u.id
WHERE r.code = '{ROOM_CODE}'
```

## What is not documented here

- Realtime room state, role assignments, and night actions: not in these tables, not documented by this skill.
- Any claim about the room authority store's lifetime, recycling, or data loss: not stated, because no deciding code was read for it during drafting. The previous version's statements on both points are deleted outright.
- Tables beyond the list above: the database has more tables (word supply, rewards, feedback, inbox, and others). They are not listed because this skill's questions do not need them and their columns were not verified for this rewrite. Read the migrations before naming any of them.
