# 用户成长体系设计

## 0. 核心前提

### 有效局定义

> **`status === Ended`** 且房间内 **≥ 9 个不同注册用户**（`is_anonymous = 0`，按 `uid` 去重）

不满足此条件的局不写入任何成长数据。匿名用户不参与成长体系。

### 成长体系两支柱

| 支柱          | 驱动力                       | 展示                           |
| ------------- | ---------------------------- | ------------------------------ |
| **XP / 等级** | 每有效局随机月相 XP（40–90） | 个人主页进度条                 |
| **角色图鉴**  | 扮演不同角色（43 种）        | 图鉴页 + 收集进度 → 解锁头像框 |

### 不做清单

| 不做                | 原因                                           |
| ------------------- | ---------------------------------------------- |
| 胜负记录 / 结局上报 | App 不知道谁赢了，手动上报不可信               |
| 在线时长            | 可挂机，反 UX                                  |
| Night-1 存活统计    | 意义有限                                       |
| 排行榜              | party game 不需要竞争压力                      |
| 每日任务 / 签到     | 重度系统，违背轻量原则                         |
| 独立成就系统        | 图鉴子成就已覆盖收集感                         |
| 结算弹窗            | Night-1 结束后面对面游戏仍在继续，弹窗打断玩家 |
| 小程序改动          | web-view 壳自动加载新版 Web                    |
| 新头像框            | 现有 10 个按等级/图鉴解锁                      |

### Cloudflare Free Plan 影响

| 服务      | Free 每日限额 | 每局增量（12 人） | 每天 10 局        | 影响 |
| --------- | ------------- | ----------------- | ----------------- | ---- |
| D1 写入   | 10 万行/天    | ~36 行            | 360 行            | 无   |
| D1 读取   | 500 万行/天   | ~24 行            | 240 行 + 图鉴查询 | 无   |
| D1 存储   | 5 GB          | ~20 MB / 千用户   | —                 | 无   |
| DO 请求   | 10 万/天      | 不新增            | —                 | 无   |
| DO SQLite | 10 万写/天    | 不新增            | —                 | 无   |

---

## 1. 月相经验系统

### 1.1 月相表

每有效局结算时，服务端为每个注册玩家独立抽取一个月相，决定 XP：

| 月相   | ID             | 图标 | XP  | 权重 | 概率 |
| ------ | -------------- | ---- | --- | ---- | ---- |
| 新月   | `newMoon`      | 🌑   | 40  | 15   | 15%  |
| 蛾眉月 | `waxCrescent`  | 🌒   | 45  | 25   | 25%  |
| 上弦月 | `firstQuarter` | 🌓   | 50  | 25   | 25%  |
| 盈凸月 | `waxGibbous`   | 🌔   | 55  | 20   | 20%  |
| 满月   | `fullMoon`     | 🌕   | 65  | 12   | 12%  |
| 血月   | `bloodMoon`    | 🩸   | 90  | 3    | 3%   |

- **范围：40–90 XP**
- **期望值：~51 XP**
- **血月 3%** ≈ 每 33 局出一次

### 1.2 实现

```typescript
interface MoonPhase {
  id: string;
  name: string;
  icon: string;
  xp: number;
  weight: number;
}

const MOON_PHASES: readonly MoonPhase[] = [
  { id: 'newMoon', name: '新月', icon: '🌑', xp: 40, weight: 15 },
  { id: 'waxCrescent', name: '蛾眉月', icon: '🌒', xp: 45, weight: 25 },
  { id: 'firstQuarter', name: '上弦月', icon: '🌓', xp: 50, weight: 25 },
  { id: 'waxGibbous', name: '盈凸月', icon: '🌔', xp: 55, weight: 20 },
  { id: 'fullMoon', name: '满月', icon: '🌕', xp: 65, weight: 12 },
  { id: 'bloodMoon', name: '血月', icon: '🩸', xp: 90, weight: 3 },
] as const;

function rollMoonPhase(): MoonPhase {
  const totalWeight = MOON_PHASES.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const phase of MOON_PHASES) {
    roll -= phase.weight;
    if (roll <= 0) return phase;
  }
  return MOON_PHASES[0];
}
```

---

## 2. 等级系统

### 2.1 等级表

| 等级  | 累计 XP | 约等价局数 | 称号 |
| ----- | ------- | ---------- | ---- |
| Lv.0  | 0       | 0          | 新手 |
| Lv.1  | 50      | 1          | 入门 |
| Lv.2  | 150     | 3          |      |
| Lv.3  | 300     | 6          |      |
| Lv.4  | 500     | 10         |      |
| Lv.5  | 750     | 15         | 常客 |
| Lv.6  | 1,050   | 21         |      |
| Lv.7  | 1,400   | 28         |      |
| Lv.8  | 1,800   | 36         |      |
| Lv.9  | 2,250   | 45         |      |
| Lv.10 | 2,750   | 55         | 老手 |
| Lv.11 | 3,500   | 70         |      |
| Lv.12 | 4,400   | 88         |      |
| Lv.13 | 5,500   | 110        |      |
| Lv.14 | 6,800   | 136        |      |
| Lv.15 | 8,500   | 170        | 元老 |
| Lv.16 | 10,500  | 210        |      |
| Lv.17 | 13,000  | 260        |      |
| Lv.18 | 16,000  | 320        |      |
| Lv.19 | 20,000  | 400        |      |
| Lv.20 | 25,000  | 500        | 传奇 |

### 2.2 实现

```typescript
const LEVEL_THRESHOLDS: readonly number[] = [
  0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250, 2750, 3500, 4400, 5500, 6800, 8500, 10500,
  13000, 16000, 20000, 25000,
] as const;

const LEVEL_TITLES: Record<number, string> = {
  0: '新手',
  1: '入门',
  5: '常客',
  10: '老手',
  15: '元老',
  20: '传奇',
};

function getLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

function getLevelTitle(level: number): string {
  for (let l = level; l >= 0; l--) {
    if (LEVEL_TITLES[l]) return LEVEL_TITLES[l];
  }
  return '新手';
}
```

进度条 = `(当前 XP - 当前等级阈值) / (下一等级阈值 - 当前等级阈值)`。

称号不可选择，跟等级自动走。

---

## 3. 角色图鉴

### 3.1 核心机制

43 个角色（`assets/badges/` 已有素材）。有效局中扮演过 → 图鉴点亮（彩色）。未扮演 → 灰显。扮演过就永久记录，不可失去。

### 3.2 阵营收集标记（图鉴页内展示）

| 标记       | 条件                    |
| ---------- | ----------------------- |
| 狼族通晓   | 集齐全部 13 个狼人角色  |
| 神职通晓   | 集齐全部 18 个神职角色  |
| 平民通晓   | 集齐全部 3 个平民角色   |
| 第三方通晓 | 集齐全部 9 个第三方角色 |
| 万象通晓   | 集齐全部 43 个角色      |

---

## 4. 头像框解锁

现有 10 个头像框，分三种解锁方式：

| 解锁方式     | 框                  | 条件           |
| ------------ | ------------------- | -------------- |
| **注册即得** | `ironForge` 铁锻    | 注册           |
| **等级解锁** | `moonSilver` 月银   | Lv.2           |
|              | `darkVine` 暗藤     | Lv.5           |
|              | `frostCrystal` 霜晶 | Lv.10          |
|              | `pharaohGold` 墓金  | Lv.15          |
| **图鉴解锁** | `boneGate` 骨门     | 集齐 5 种角色  |
|              | `runicSeal` 符印    | 集齐 10 种角色 |
|              | `bloodThorn` 血棘   | 集齐 20 种角色 |
|              | `hellFire` 狱焰     | 集齐 30 种角色 |
|              | `voidRift` 虚裂     | 集齐 40 种角色 |

解锁后永久拥有。AvatarPickerScreen 中未解锁的灰显 + 显示解锁条件。

---

## 5. 数据模型

### 5.1 D1 新增表

```sql
CREATE TABLE IF NOT EXISTS user_stats (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  xp              INTEGER NOT NULL DEFAULT 0,
  level           INTEGER NOT NULL DEFAULT 0,
  games_played    INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_results (
  id              TEXT PRIMARY KEY,
  room_code       TEXT NOT NULL,
  user_id         TEXT NOT NULL REFERENCES users(id),
  role_id         TEXT NOT NULL,
  faction         TEXT NOT NULL,
  is_host         INTEGER NOT NULL DEFAULT 0,
  player_count    INTEGER NOT NULL,
  moon_phase      TEXT NOT NULL,
  xp_earned       INTEGER NOT NULL,
  template_id     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_game_results_user ON game_results(user_id, created_at);
CREATE UNIQUE INDEX idx_game_results_room_user ON game_results(room_code, user_id);

CREATE TABLE IF NOT EXISTS user_role_collection (
  user_id         TEXT NOT NULL REFERENCES users(id),
  role_id         TEXT NOT NULL,
  first_played_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, role_id)
);
```

### 5.2 协议

不变。`Player` 类型不新增字段。等级仅在个人主页展示，通过 `GET /api/user/stats` 获取。

---

## 6. 结算流程

### 6.1 触发点

服务端 `handleEndNight()` 执行完毕后，异步写入 D1（不阻塞广播）。

### 6.2 流程

```
handleEndNight()
  ├── 广播 GameState (status=Ended)
  └── 异步:
      ├── 1. 判定有效局
      │   过滤 state.players 中非 null、非 bot 的座位
      │   查 D1 过滤掉 is_anonymous = 1 的用户
      │   uniqueUids = 去重后的注册用户 uid 集合
      │   if uniqueUids.size < 9 → return
      │
      ├── 2. 遍历每个注册玩家
      │   ├── rollMoonPhase() → { id, xp }
      │   ├── INSERT game_results (ON CONFLICT DO NOTHING)
      │   ├── INSERT user_role_collection (ON CONFLICT DO NOTHING)
      │   ├── UPSERT user_stats: xp += xp_earned, games_played += 1
      │   └── 计算新 level, UPDATE users SET level = newLevel
      │
      └── 3. 完成
```

### 6.3 幂等保护

`game_results` 唯一索引 `(room_code, user_id)` 保证同一局同一用户不重复写入。

---

## 7. UI 展示

### 7.1 座位（SeatTile）

不变。等级不在座位上显示。

### 7.2 个人主页（SettingsScreen 扩展）

- 等级 + 称号
- XP 进度条（当前 XP → 下一级所需 XP）
- 角色图鉴入口（已收集/总数）
- 头像框入口
- 上局月相 banner：`"上局获得 🌕 满月 +65 XP"`（非弹窗，看过消失）

### 7.3 角色图鉴页

- 按阵营分组（狼人 / 神职 / 平民 / 第三方），复用 `assets/badges/` 素材
- 已收集：彩色 badge；未收集：灰显 + 锁图标
- 点击已收集角色 → 角色名 + 首次扮演日期
- 阵营通晓标记
- 底部展示图鉴解锁头像框进度

### 7.4 头像框选择页

AvatarPickerScreen 头像框 tab，未解锁的灰显 + 显示解锁条件文字。

---

## 8. API 接口

| 方法 | 路径                   | 说明                                                                     |
| ---- | ---------------------- | ------------------------------------------------------------------------ |
| GET  | `/api/user/stats`      | `{ xp, level, gamesPlayed, rolesCollected, totalRoles, lastMoonPhase? }` |
| GET  | `/api/user/collection` | `{ roles: Array<{ roleId, firstPlayedAt }> }`                            |

两个只读接口，仅限登录用户。结算写入在 DO 内部完成，不暴露写接口。

---

## 9. 实现优先级

### P0 — 数据管道 + XP/等级 + 座位展示

| 内容                                                               | 文件范围                          |
| ------------------------------------------------------------------ | --------------------------------- |
| D1 迁移：`user_stats` + `game_results` + `user_role_collection` 表 | `packages/api-worker/migrations/` |
| `users` 表加 `level` 字段                                          | 同上                              |
| 月相常量 + `rollMoonPhase()` + `LEVEL_THRESHOLDS` + `getLevel()`   | `packages/game-engine/src/`       |
| `settleGameResults()` 结算逻辑（含有效局判定）                     | `packages/api-worker/` DO handler |
| `GET /api/user/stats` API                                          | `packages/api-worker/`            |
| 个人主页 XP 进度条 + 等级称号                                      | `src/screens/SettingsScreen/`     |
| 头像框解锁逻辑（等级线） + AvatarPickerScreen 锁定状态             | `src/screens/AvatarPickerScreen/` |

### P1 — 角色图鉴 + 账号年龄 + 月相 banner

| 内容                                                 | 文件范围                          |
| ---------------------------------------------------- | --------------------------------- |
| `GET /api/user/collection` API                       | `packages/api-worker/`            |
| 角色图鉴页（按阵营分组 + badge 渲染 + 阵营通晓标记） | `src/screens/CollectionScreen/`   |
| 个人主页图鉴入口（已收集/总数）                      | `src/screens/SettingsScreen/`     |
| 头像框解锁逻辑（图鉴线） + AvatarPickerScreen 更新   | `src/screens/AvatarPickerScreen/` |
| 个人主页月相 banner（上局结果，看过消失）            | `src/screens/SettingsScreen/`     |
