---
name: query-prod-data
description: 'Query production D1 database and Analytics Engine telemetry. Use when: looking up users, rooms, player geo, load timing, telemetry.'
argument-hint: 'Query description (e.g., where are players in room 8817 from, recent registrations, load performance in a time range)'
---

# Query Production Data Skill

> **输出语言：执行本 skill 过程中，所有面向用户的输出（进度报告、询问、完成通知、错误提示）一律使用中文。**

Query D1 database and Analytics Engine telemetry data via the wrangler CLI.

## Prerequisites

- **Wrangler OAuth valid**. Token expires ~24h, symptom: `Failed to fetch auth token: 400 Bad Request`.
- Fix: `cd packages/api-worker && npx wrangler login` (interactive browser auth).
- All commands are executed in the `packages/api-worker` directory.

## Data Sources

### 1. D1 Database (`werewolf-db`)

Structured business data. Query via `npx wrangler d1 execute werewolf-db --remote --command "SQL"`.

**Table overview:**

| Table                   | Purpose            | Key Columns                                                                                               |
| ----------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `users`                 | User accounts      | `id`, `email`, `display_name`, `is_anonymous`, `wechat_openid`, `last_country`, `last_colo`, `created_at` |
| `rooms`                 | Room metadata      | `id`, `code`, `host_user_id`, `created_at`                                                                |
| `user_stats`            | User stats/level   | FK `user_id`                                                                                              |
| `draw_history`          | Gacha draw records | FK `user_id`                                                                                              |
| `refresh_tokens`        | Refresh tokens     | FK `user_id`                                                                                              |
| `login_attempts`        | Login attempts     | `email_hash`, `attempted_at` (no IP)                                                                      |
| `password_reset_tokens` | Password reset     | `id`, `user_id`                                                                                           |

**`users` full columns:**
`id`, `email`, `password_hash`, `display_name`, `avatar_url`, `custom_avatar_url`, `avatar_frame`, `equipped_flair`, `equipped_name_style`, `equipped_effect`, `equipped_seat_animation`, `wechat_openid`, `is_anonymous`, `token_version`, `last_country`, `last_colo`, `created_at`, `updated_at`

### 2. Analytics Engine (`load_timing` dataset)

Client-side load performance telemetry. Query via Cloudflare SQL API (requires OAuth token).

**Field mapping:**

| Field      | Meaning                                |
| ---------- | -------------------------------------- |
| `index1`   | Resource short filename                |
| `blob1`    | Full URL                               |
| `blob2`    | User Agent                             |
| `blob3`    | Country (CF `cf.country`)              |
| `blob4`    | CF Colo (edge node, e.g., LAX/NRT/HKG) |
| `blob5`    | ISP/ASN organization name              |
| `double1`  | Total resource load duration ms        |
| `double2`  | transfer size bytes                    |
| `double3`  | decoded body size                      |
| `double4`  | DNS lookup ms                          |
| `double5`  | TCP connect ms                         |
| `double6`  | TLS handshake ms                       |
| `double7`  | TTFB ms                                |
| `double8`  | download time ms                       |
| `double9`  | Page total startup time ms             |
| `double10` | HTML document TTFB ms                  |

### 3. Durable Object SQLite

Real-time game state within rooms (player list, role assignments, night actions) is stored in DO memory/SQLite.

- DO auto-recycles after idle, data is lost.
- Active rooms can be queried via API: `curl -s "https://api.werewolfjudge.eu.org/room/state?roomCode=XXXX"`
- Closed rooms cannot have their participants queried.

## Common Query Templates

### Look up room and host

```sql
SELECT r.*, u.display_name, u.last_country, u.last_colo
FROM rooms r
JOIN users u ON r.host_user_id = u.id
WHERE r.code = '{ROOM_CODE}'
```

### Find all new users within a room's creation time window (infer participants)

Room participants are not stored in D1, but can be inferred via creation time window (players auto-register when scanning QR code to join):

```sql
SELECT id, display_name, last_country, last_colo, created_at
FROM users
WHERE created_at >= datetime('{ROOM_CREATED_AT}', '-3 minutes')
  AND created_at <= datetime('{ROOM_CREATED_AT}', '+10 minutes')
ORDER BY created_at
```

### Query visitor country distribution for a time range

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/a38318fda66da2d2d931d8ab2d98e1c0/analytics_engine/sql" \
  -H "Authorization: Bearer $(cat /Users/eyan/Library/Preferences/.wrangler/config/default.toml | grep oauth_token | head -1 | sed 's/.*= "\(.*\)"/\1/')" \
  -d "SELECT blob3 as country, blob4 as colo, count() as cnt, avg(double1) as avg_load_ms
      FROM load_timing
      WHERE timestamp >= '{START_UTC}' AND timestamp <= '{END_UTC}'
      GROUP BY blob3, blob4
      ORDER BY cnt DESC"
```

> **Note**: The wrangler OAuth token file path is `/Users/eyan/Library/Preferences/.wrangler/config/default.toml` (macOS Preferences directory), not `~/.wrangler/`.

### Total user count / recent registrations

```sql
SELECT count(*) as total FROM users
```

```sql
SELECT id, display_name, last_country, last_colo, created_at
FROM users ORDER BY created_at DESC LIMIT 20
```

### Look up a user's gacha draw history

```sql
SELECT * FROM draw_history WHERE user_id = '{USER_ID}' ORDER BY created_at DESC LIMIT 20
```

### Look up a user's level/XP

```sql
SELECT * FROM user_stats WHERE user_id = '{USER_ID}'
```

## Important Notes

1. **All times are UTC**. Beijing time = UTC + 8.
2. **D1 uses SQLite dialect**. Use `datetime()` for time arithmetic, `INTERVAL` is not supported.
3. **`password_hash` is a sensitive column**. Do not `SELECT *` on users, explicitly list needed columns.
4. **Analytics Engine data retention is ~90 days**, older data cannot be queried.
5. **DO data is ephemeral**, only active rooms can be queried, historical room participants/roles are unrecoverable.
6. **CF Account ID**: `a38318fda66da2d2d931d8ab2d98e1c0`.
