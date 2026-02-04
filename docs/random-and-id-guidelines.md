# 随机与 ID 生成规范

本文档定义了项目中随机数、唯一 ID、确定性选择的使用规则，防止 `Math.random()` 滥用和重复造轮子。

## 三分法

| 场景             | 使用工具                            | 说明                                                  |
| ---------------- | ----------------------------------- | ----------------------------------------------------- |
| **ID / Nonce**   | `src/utils/id.ts`                   | 不可预测、不可复现的唯一标识符（如 requestId、nonce） |
| **可测试随机**   | `src/utils/random.ts`               | 支持 `rng?: Rng` 注入，测试时可固定随机源             |
| **跨端一致随机** | Host resolve + `BroadcastGameState` | 随机结果必须由 Host 解析并广播，客户端只读            |

---

## 禁止项（Hard Rules）

### ❌ 禁止在 UI render / useMemo 里使用 `Math.random()`

```tsx
// ❌ 错误：每次 render 结果不同，导致闪烁/不一致
const effect = useMemo(() => EFFECTS[Math.floor(Math.random() * 5)], []);

// ✅ 正确：使用 Host 解析后的广播值
const effect = gameState.resolvedRoleRevealAnimation;
```

### ❌ 禁止客户端自行计算"房间一致随机"

```tsx
// ❌ 错误：客户端计算，不同设备可能结果不同
const animation = resolveRandomAnimation(roomCode);

// ✅ 正确：Host 解析后广播，客户端直接读取
const animation = gameState.resolvedRoleRevealAnimation;
```

### ❌ 禁止新建 `randomXxx.ts` 或 `RandomUtil.ts`

- 复用现有工具：`random.ts`、`id.ts`、`shuffle.ts`
- 领域特定随机逻辑放在领域模块（如 `RoleRevealAnimation.ts` 的 `resolveRandomAnimation`）

---

## 正确用法示例

### 1. 生成唯一 ID / Nonce

```ts
import { randomHex, newRequestId } from '../utils/id';

// 生成 8 位 hex nonce
const nonce = randomHex(8);

// 生成请求 ID
const requestId = newRequestId();
```

### 2. 可测试随机（支持 rng 注入）

```ts
import { randomIntInclusive, shuffleArray, type Rng } from '../utils';

// 生产环境：使用默认 secureRng
const seat = randomIntInclusive(1, 12);
const shuffled = shuffleArray(roles);

// 测试环境：注入固定随机源
const fixedRng: Rng = () => 0.5;
const seat = randomIntInclusive(1, 12, fixedRng); // 总是 7
const shuffled = shuffleArray(roles, fixedRng);
```

### 3. 跨端一致随机（Host resolve + Broadcast）

```ts
// Host 端（reducer/handler）
import { resolveRandomAnimation } from '../../types/RoleRevealAnimation';
import { randomHex } from '../../../utils/id';

function handleRestartGame(state: GameState): GameState {
  const newNonce = randomHex(8);
  let resolvedAnimation = state.resolvedRoleRevealAnimation;

  if (state.roleRevealAnimation === 'random') {
    const seed = `${state.roomCode}:${newNonce}`;
    resolvedAnimation = resolveRandomAnimation(seed);
  }

  return {
    ...state,
    roleRevealRandomNonce: newNonce,
    resolvedRoleRevealAnimation: resolvedAnimation,
  };
}

// 客户端（UI）
const animation = gameState.resolvedRoleRevealAnimation; // 直接读取，不计算
```

---

## 文件职责

| 文件                                        | 职责                     | 依赖                    |
| ------------------------------------------- | ------------------------ | ----------------------- |
| `src/utils/id.ts`                           | 唯一 ID、nonce 生成      | expo-crypto, Web Crypto |
| `src/utils/random.ts`                       | 可测试随机（rng 注入）   | expo-crypto, Web Crypto |
| `src/utils/shuffle.ts`                      | 数组打乱（rng 注入）     | random.ts               |
| `src/services/types/RoleRevealAnimation.ts` | 动画随机解析（领域特定） | 确定性 hash             |

---

## 相关链接

- `src/hooks/useRoomHostDialogs.ts` - rng 注入示例
- `src/services/types/RoleRevealAnimation.ts` - `resolveRandomAnimation` 实现
- `src/__tests__/noMathRandom.contract.test.ts` - Math.random 禁用门禁测试
