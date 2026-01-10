# Werewolf Game Judge（狼人杀第一晚电子法官）

这是一款为**线下同桌狼人杀**设计的“电子法官”App，专注完成**第一晚**的自动播报、行动收集与结果结算。

核心定位：
- ✅ 线下同桌 / 多设备一起用
- ✅ Host（房主）也是玩家，夜晚应当闭眼，由 App 播报引导
- ✅ 只负责第一晚：夜晚结束后输出 **“死亡 / 平安夜”**；白天发言与投票线下自行进行

---

## 给玩家的快速开始

### 1) 创建房间（Host）

1. 打开 App，点击 **「创建房间」**
2. 选择板子（角色配置）与人数
3. 生成 **4 位房间号**（例如：1234），发给其他玩家

### 2) 加入房间（玩家）

1. 点击 **「进入房间」**
2. 输入 4 位房间号
3. 点击座位号 **入座**
   - 若提示 **“X号座已被占用”**，说明有人已经坐了这个位置，请换座

### 3) 分配身份与开始第一晚（Host）

1. 所有人入座后，Host 点击 **「准备看牌」**（分配身份）
2. 每位玩家点击 **「查看身份」** 确认自己的牌
3. 所有人确认完毕，Host 点击 **「开始游戏」**，App 进入第一晚播报与行动阶段

### 4) 夜晚结束（Host 宣布结果）

夜晚结束后，Host 点击 **「查看昨晚信息」**，App 会显示：
- ✅ 平安夜
- ✅ 或死亡玩家座位号

> 说明：白天流程（发言/投票/处刑）不在 App 内。

---

## 线下玩法 SOP（强烈推荐）

� **[线下玩法 SOP（第一晚电子法官）](docs/offline-sop.md)**

这份 SOP 覆盖：
- 开局准备与角色分配
- 第一晚流程概览
- 音频异常说明
- 卡住/救火协议（🧯 救火重开）
- 常见问题

---

## E2E 测试：Local / Remote Supabase 切换

E2E 测试支持在本地 Supabase 与远程 Supabase 之间切换：

```bash
# 使用本地 Supabase（默认，127.0.0.1:54321）
E2E_ENV=local npx playwright test e2e/basic.spec.ts

# 使用远程 Supabase（生产/共享环境）
E2E_ENV=remote npx playwright test e2e/basic.spec.ts

# 推荐：运行核心 E2E 测试（通过 e2e:core 脚本）
E2E_ENV=local npm run e2e:core
E2E_ENV=remote npm run e2e:core
```

> 注意：核心 E2E 需 `--workers=1`，避免 Supabase/Realtime channel 资源竞争导致的偶发失败。

**配置文件位置：**
- `env/e2e.local.json` - 本地 Supabase 配置
- `env/e2e.remote.json` - 远程 Supabase 配置（可通过 CI secrets 覆盖）

**CI 使用：** 设置 `EXPO_PUBLIC_SUPABASE_URL` 和 `EXPO_PUBLIC_SUPABASE_ANON_KEY` 环境变量即可覆盖 remote 配置。

---

## 架构说明（简版）

### Host as authority（房主是逻辑权威）

这款 App 的“游戏逻辑权威”在 Host（房主设备）本地内存中，包括：
- 第一晚流程推进、阶段顺序与计时
- 角色行动的执行与校验
- 音频播报的推进与兜底
- 第一晚死亡结算

### Supabase 只做系统层

Supabase 仅用于：
- 房间存在与发现（4 位房间号）
- 用户身份（匿名/注册）
- 实时消息传输（Realtime Broadcast）
- 系统层清理（房间超时等）

Supabase **不会**：
- 执行游戏逻辑
- 校验夜晚行动
- 存储对局过程数据、投票、结算结果

---

## Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── Button/
│   ├── AlertModal.tsx
│   └── Avatar.tsx
├── constants/       # App constants and role definitions
├── hooks/           # Custom React hooks
│   ├── useAuth.ts
│   └── useRoom.ts
├── models/          # TypeScript interfaces
│   ├── Player.ts
│   ├── Room.ts
│   └── Template.ts
├── navigation/      # React Navigation setup
├── screens/         # Screen components
│   ├── HomeScreen/
│   ├── ConfigScreen/
│   ├── RoomScreen/
│   ├── JoinRoomScreen/
│   └── SettingsScreen/
└── services/        # Business logic services
    ├── AudioService.ts
    ├── AuthService.ts
    ├── AvatarUploadService.ts
    ├── RoomService.ts
    └── SeatService.ts
```

## FAQ（玩家向）

### Q1：提示「需要登录」怎么办？

可以使用**匿名登录**，不需要注册账号即可使用。

### Q2：出现「加载超时」怎么办？

先点 **「重试」**。如果仍失败，请确认：
- 你输入的房间号与 Host 显示的 4 位房间号一致
- 网络可用（同一 Wi‑Fi 通常更稳定）

---

## Getting Started（开发者）

### Prerequisites

- Node.js >= 20.19.4
- npm or yarn
- Expo CLI
- iOS Simulator / Android Emulator / Physical device

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Supabase:
    - Dashboard setup: `docs/SUPABASE_SETUP.md`
    - Supabase CLI + migrations: `supabase/README.md`
    - Create a local `.env` (do not commit) with:
       - `EXPO_PUBLIC_SUPABASE_URL`
       - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

4. Add audio assets:
   - Place audio files in `assets/audio/` and `assets/audio_end/`
   - Place role images in `assets/images/`

### Running the App

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on Web
npm run web
```

## Game Roles

### Wolf Team 🐺
- Wolf (狼人)
- Wolf King (狼王)
- Wolf Queen (狼后)
- Wolf Brother (狼兄)
- Robot Wolf (机械狼)
- Hidden Wolf (隐狼)
- Wolf Seeder (种狼)

### God Team ⚡
- Seer (预言家)
- Witch (女巫)
- Hunter (猎人)
- Guard (守卫)
- Knight (骑士)
- Idiot (白痴)
- Cupid (丘比特)
- Magician (魔术师)
- And more...

### Villager Team 👥
- Villager (村民)
- Bride (新娘)

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: React Navigation
- **State Management**: React Hooks
- **Backend**: Supabase (Auth + `rooms` table + Realtime Broadcast)
- **Audio**: expo-audio

## License

MIT
