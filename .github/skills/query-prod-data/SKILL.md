---
name: query-prod-data
description: 'Query production D1 database and Analytics Engine telemetry. Use when: looking up users, rooms, player geo, load timing, telemetry, 查用户, 查房间, 查数据, 查玩家, 查telemetry, 查加载时间, 查地区.'
argument-hint: '查询描述（如：房间 8817 的玩家来自哪里、最近注册的用户、某时间段的加载性能）'
---

# 查询生产数据 Skill

通过 wrangler CLI 查询 D1 数据库和 Analytics Engine 遥测数据。

## Prerequisites

- **Wrangler OAuth 有效**。token 约 24h 过期，症状：`Failed to fetch auth token: 400 Bad Request`。
- 修复：`cd packages/api-worker && npx wrangler login`（交互式浏览器授权）。
- 所有命令在 `packages/api-worker` 目录下执行。

## 数据源

### 1. D1 数据库（`werewolf-db`）

结构化业务数据。通过 `npx wrangler d1 execute werewolf-db --remote --command "SQL"` 查询。

**表一览：**

| 表名                    | 用途          | 关键列                                                                                                    |
| ----------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `users`                 | 用户账号      | `id`, `email`, `display_name`, `is_anonymous`, `wechat_openid`, `last_country`, `last_colo`, `created_at` |
| `rooms`                 | 房间元数据    | `id`, `code`, `host_user_id`, `created_at`                                                                |
| `user_stats`            | 用户统计/等级 | 关联 `user_id`                                                                                            |
| `draw_history`          | 扭蛋抽取记录  | 关联 `user_id`                                                                                            |
| `refresh_tokens`        | 刷新令牌      | 关联 `user_id`                                                                                            |
| `login_attempts`        | 登录尝试      | `email_hash`, `attempted_at`（无 IP）                                                                     |
| `password_reset_tokens` | 密码重置      | `id`, `user_id`                                                                                           |

**`users` 完整字段：**
`id`, `email`, `password_hash`, `display_name`, `avatar_url`, `custom_avatar_url`, `avatar_frame`, `equipped_flair`, `equipped_name_style`, `equipped_effect`, `equipped_seat_animation`, `wechat_openid`, `is_anonymous`, `token_version`, `last_country`, `last_colo`, `created_at`, `updated_at`

### 2. Analytics Engine（`load_timing` dataset）

客户端加载性能遥测。通过 Cloudflare SQL API 查询（需 OAuth token）。

**字段映射：**

| 字段       | 含义                                |
| ---------- | ----------------------------------- |
| `index1`   | 资源短文件名                        |
| `blob1`    | 完整 URL                            |
| `blob2`    | User Agent                          |
| `blob3`    | 国家（CF `cf.country`）             |
| `blob4`    | CF Colo（边缘节点，如 LAX/NRT/HKG） |
| `blob5`    | ISP/ASN 组织名                      |
| `double1`  | 资源加载总时长 ms                   |
| `double2`  | transfer size bytes                 |
| `double3`  | decoded body size                   |
| `double4`  | DNS lookup ms                       |
| `double5`  | TCP connect ms                      |
| `double6`  | TLS handshake ms                    |
| `double7`  | TTFB ms                             |
| `double8`  | download time ms                    |
| `double9`  | 页面总启动时间 ms                   |
| `double10` | HTML document TTFB ms               |

### 3. Durable Object SQLite

房间内的实时游戏状态（玩家列表、角色分配、夜晚操作）存在 DO 的内存/SQLite 中。

- DO 空闲后自动回收，数据丢失。
- 活跃房间可通过 API 查询：`curl -s "https://api.werewolfjudge.eu.org/room/state?roomCode=XXXX"`
- 已关闭的房间无法查询参与者。

## 常用查询模板

### 查房间及房主

```sql
SELECT r.*, u.display_name, u.last_country, u.last_colo
FROM rooms r
JOIN users u ON r.host_user_id = u.id
WHERE r.code = '{ROOM_CODE}'
```

### 查某房间创建时间段内的所有新用户（推断参与者）

房间参与者不存 D1，但可通过创建时间窗口推断（玩家扫码进房时自动注册）：

```sql
SELECT id, display_name, last_country, last_colo, created_at
FROM users
WHERE created_at >= datetime('{ROOM_CREATED_AT}', '-3 minutes')
  AND created_at <= datetime('{ROOM_CREATED_AT}', '+10 minutes')
ORDER BY created_at
```

### 查某时间段的访问来源国分布

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/a38318fda66da2d2d931d8ab2d98e1c0/analytics_engine/sql" \
  -H "Authorization: Bearer $(cat /Users/eyan/Library/Preferences/.wrangler/config/default.toml | grep oauth_token | head -1 | sed 's/.*= "\(.*\)"/\1/')" \
  -d "SELECT blob3 as country, blob4 as colo, count() as cnt, avg(double1) as avg_load_ms
      FROM load_timing
      WHERE timestamp >= '{START_UTC}' AND timestamp <= '{END_UTC}'
      GROUP BY blob3, blob4
      ORDER BY cnt DESC"
```

> **注意**：wrangler OAuth token 文件路径是 `/Users/eyan/Library/Preferences/.wrangler/config/default.toml`（macOS Preferences 目录），不是 `~/.wrangler/`。

### 查总用户数 / 最近注册

```sql
SELECT count(*) as total FROM users
```

```sql
SELECT id, display_name, last_country, last_colo, created_at
FROM users ORDER BY created_at DESC LIMIT 20
```

### 查某用户的扭蛋记录

```sql
SELECT * FROM draw_history WHERE user_id = '{USER_ID}' ORDER BY created_at DESC LIMIT 20
```

### 查某用户的等级/XP

```sql
SELECT * FROM user_stats WHERE user_id = '{USER_ID}'
```

## 注意事项

1. **时间均为 UTC**。北京时间 = UTC + 8。
2. **D1 是 SQLite 方言**。用 `datetime()` 函数做时间运算，不支持 `INTERVAL`。
3. **`password_hash` 敏感列**。查询时不要 `SELECT *` on users，显式列出需要的列。
4. **Analytics Engine 数据保留约 90 天**，超过的查不到。
5. **DO 数据是临时的**，只能查活跃房间，历史房间的参与者/角色信息不可恢复。
6. **CF Account ID**：`a38318fda66da2d2d931d8ab2d98e1c0`。
