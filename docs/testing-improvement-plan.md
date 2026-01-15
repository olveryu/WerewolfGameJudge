# 测试覆盖率提升方案

> 生成日期: 2026-01-15
> 实施完成日期: 2026-01-15
> 
> **最终结果**: 覆盖率从 43.67% 提升到 46.49%，测试从 829 个增加到 931 个

---

## 实施总结

### 覆盖率变化

| 指标 | 实施前 | 实施后 | 变化 |
|------|--------|--------|------|
| Statements | 42.54% | 45.15% | +2.61% |
| Branches | 34.71% | 38.36% | +3.65% |
| Functions | 45.69% | 47.19% | +1.50% |
| Lines | 43.67% | 46.49% | +2.82% |

### 测试数量变化

| 指标 | 实施前 | 实施后 | 变化 |
|------|--------|--------|------|
| Test Suites | 54 | 66 | +12 |
| Tests | 829 | 931 | +102 |

### 新增测试文件

**Phase 1: Resolver 单元测试 (7 个文件)**
- `src/services/night/resolvers/__tests__/seer.resolver.test.ts`
- `src/services/night/resolvers/__tests__/witch.resolver.test.ts`
- `src/services/night/resolvers/__tests__/psychic.resolver.test.ts`
- `src/services/night/resolvers/__tests__/hunter.resolver.test.ts`
- `src/services/night/resolvers/__tests__/magician.resolver.test.ts`
- `src/services/night/resolvers/__tests__/gargoyle.resolver.test.ts`
- `src/services/night/resolvers/__tests__/darkWolfKing.resolver.test.ts`

**Phase 2: GameStateService 关键路径测试 (3 个文件)**
- `src/services/__tests__/GameStateService.reveal.test.ts`
- `src/services/__tests__/GameStateService.actionSubmit.test.ts`
- `src/services/__tests__/GameStateService.audioState.test.ts`

**Phase 3: Hook/Helper 测试 (1 个文件)**
- `src/screens/RoomScreen/hooks/__tests__/useActionerState.test.ts`

**Phase 4: 集成测试扩展 (1 个文件)**
- `src/services/__tests__/boards/Standard12.integration.test.ts`

---

## 一、现状分析

### 1.1 整体覆盖率

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| Statements | 42.54% | 70% |
| Branches | 34.71% | 60% |
| Functions | 45.69% | 70% |
| Lines | 43.67% | 70% |

### 1.2 覆盖率分布

```
🟢 高覆盖 (>75%):  15 个文件
🟡 中覆盖 (25-75%): 12 个文件
🔴 低覆盖 (<25%):  20+ 个文件（含 0%）
```

### 1.3 高风险盲区

| 模块 | 覆盖率 | 风险等级 | 说明 |
|------|--------|----------|------|
| **Resolver (6个角色)** | 0% | 🔴 极高 | 核心游戏逻辑完全无测试 |
| `GameStateService.ts` | 57% | 🟡 高 | 核心服务，关键路径未覆盖 |
| `useActionerState.ts` | 0% | 🔴 高 | Skip 按钮逻辑，刚修过 bug |
| `useGameRoom.ts` | 0% | 🔴 中 | 玩家操作入口 |
| `RoomScreen.tsx` | 0% | 🟡 中 | 主要 UI（用 E2E 更合适）|

---

## 二、测试策略

### 2.1 测试金字塔

```
        /\
       /E2E\        ← 冒烟测试，覆盖关键用户流程 (5%)
      /------\
     / 集成测试 \    ← Host 流程、完整夜晚 (25%)
    /------------\
   /   单元测试   \  ← Resolver、Helper、工具函数 (70%)
  /----------------\
```

### 2.2 各层测试职责

| 层级 | 测试目标 | 运行频率 | 示例 |
|------|----------|----------|------|
| **单元测试** | 纯函数逻辑 | 每次提交 | Resolver、Helper |
| **集成测试** | Host 状态流转 | 每次提交 | 夜晚流程、投票流程 |
| **Contract 测试** | 表数据不漂移 | 每次提交 | SCHEMAS、NIGHT_STEPS |
| **E2E 测试** | 用户关键路径 | CI/手动 | 建房→入座→开始→夜晚 |

---

## 三、实施计划

### Phase 1: Resolver 单元测试（优先级最高）

**目标**: 6 个 0% 覆盖的 Resolver 达到 90%+

**文件列表**:
1. `src/services/night/resolvers/seer.ts` - 预言家
2. `src/services/night/resolvers/witch.ts` - 女巫
3. `src/services/night/resolvers/hunter.ts` - 猎人
4. `src/services/night/resolvers/psychic.ts` - 通灵师
5. `src/services/night/resolvers/magician.ts` - 魔术师
6. `src/services/night/resolvers/gargoyle.ts` - 石像鬼
7. `src/services/night/resolvers/darkWolfKing.ts` - 黑狼王

**测试内容**:
```typescript
// 示例：seer.resolver.test.ts
describe('SeerResolver', () => {
  describe('validate', () => {
    it('应该拒绝无效目标');
    it('应该拒绝查验自己');
    it('应该接受有效目标');
  });

  describe('resolve', () => {
    it('查验狼人应该返回"狼人"');
    it('查验好人应该返回"好人"');
    it('查验白狼王应该返回"狼人"');
  });

  describe('privateEffect', () => {
    it('应该生成 SEER_REVEAL 私信');
  });
});
```

**预计工作量**: 2-3 小时
**预计覆盖率提升**: +5-8%

---

### Phase 2: GameStateService 关键路径测试

**目标**: 从 57% 提升到 80%

**需要覆盖的关键方法**:

| 方法 | 当前状态 | 测试内容 |
|------|----------|----------|
| `handleActionRequest` | 部分 | 各角色提交行动 |
| `handleWolfVote` | 已测 | ✅ |
| `advanceToNextAction` | 部分 | 音频播放状态转换 |
| `sendSeerReveal` | 未测 | 私信发送 |
| `sendPsychicReveal` | 未测 | 私信发送 |
| `sendWitchContext` | 部分 | 女巫上下文 |
| `playerViewedRole` | 已测 | ✅ |
| `takeSeat/leaveSeat` | 已测 | ✅ |

**新增测试文件**:
```
src/services/__tests__/
├── GameStateService.actionSubmit.test.ts   ← 行动提交流程
├── GameStateService.reveal.test.ts         ← 检验类 reveal
├── GameStateService.audioState.test.ts     ← 音频状态转换
```

**预计工作量**: 3-4 小时
**预计覆盖率提升**: +8-12%

---

### Phase 3: Hook 与 Helper 测试

**目标**: 关键 Hook 从 0% 提升到 70%

**文件列表**:
1. `useActionerState.ts` - Skip 按钮逻辑
2. `RoomScreen.helpers.ts` - 已有 92%，补充边界情况

**测试内容**:
```typescript
// useActionerState.test.ts
describe('useActionerState', () => {
  it('夜晚 + 我是当前行动角色 + 未提交 → showSkip=true');
  it('夜晚 + 我是当前行动角色 + 已提交 → showSkip=false');
  it('夜晚 + 我不是当前角色 → showSkip=false');
  it('非夜晚 → showSkip=false');
  it('狼人 + 等待狼人 + 未投票 → showSkip=true');
  it('狼人 + 等待狼人 + 已投票 → showSkip=false');
});
```

**预计工作量**: 1-2 小时
**预计覆盖率提升**: +2-3%

---

### Phase 4: 集成测试扩展

**目标**: 覆盖更多板子配置

**当前已有**:
- `NightmareGuard12.integration.test.ts`

**需要新增**:
```
src/services/__tests__/boards/
├── Standard9.integration.test.ts      ← 标准 9 人局
├── SeerWitch12.integration.test.ts    ← 预言家+女巫板
├── Hunter9.integration.test.ts        ← 猎人板
```

**预计工作量**: 2-3 小时
**预计覆盖率提升**: +3-5%

---

## 四、优先级排序

| 阶段 | 内容 | 优先级 | 预计提升 | 工作量 |
|------|------|--------|----------|--------|
| **Phase 1** | Resolver 单元测试 | 🔴 P0 | +5-8% | 2-3h |
| **Phase 2** | GameStateService 关键路径 | 🔴 P0 | +8-12% | 3-4h |
| **Phase 3** | Hook/Helper 测试 | 🟡 P1 | +2-3% | 1-2h |
| **Phase 4** | 集成测试扩展 | 🟡 P1 | +3-5% | 2-3h |

**总计**: 8-12 小时，预计覆盖率 43% → 65-70%

---

## 五、快速启动命令

### 5.1 开发时使用 Watch 模式

```bash
# 只测某个文件
npm run test -- --watch --testPathPattern="seer"

# 测某个目录
npm run test -- --watch --testPathPattern="resolvers"
```

### 5.2 查看覆盖率报告

```bash
# 生成 HTML 报告
npm run test -- --coverage --coverageReporters=html
open coverage/index.html

# 只看某个文件
npm run test -- --coverage --collectCoverageFrom="src/services/night/resolvers/seer.ts"
```

### 5.3 CI 快速检查

```bash
# 类型检查
npx tsc --noEmit

# 快速测试（无覆盖率）
npm run test -- --no-coverage

# 完整测试（带覆盖率）
npm run test
```

---

## 六、测试规范

### 6.1 文件命名

```
src/
├── services/
│   ├── GameStateService.ts
│   └── __tests__/
│       ├── GameStateService.nightFlow.test.ts     ← 功能域
│       ├── GameStateService.unifiedAPI.test.ts    ← 功能域
│       └── GameStateService.reveal.test.ts        ← 功能域
├── services/night/resolvers/
│   ├── seer.ts
│   └── __tests__/
│       └── seer.resolver.test.ts
```

### 6.2 测试结构

```typescript
describe('模块名', () => {
  describe('方法名', () => {
    it('应该 + 行为描述', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### 6.3 Resolver 测试模板

```typescript
import { SeerResolver } from '../seer';
import { createMockContext } from '../../__tests__/testUtils';

describe('SeerResolver', () => {
  let resolver: SeerResolver;
  let ctx: MockContext;

  beforeEach(() => {
    resolver = new SeerResolver();
    ctx = createMockContext({
      seats: [...],
      roleAssignments: new Map([...]),
    });
  });

  describe('validate', () => {
    it('应该拒绝 null 目标', () => {
      const result = resolver.validate({ target: null }, ctx);
      expect(result.valid).toBe(false);
    });
  });

  describe('resolve', () => {
    it('查验狼人返回狼人', () => {
      const result = resolver.resolve({ target: 3 }, ctx);
      expect(result.reveal).toBe('狼人');
    });
  });
});
```

---

## 七、验收标准

### 7.1 Phase 1 完成标准

- [ ] 7 个 Resolver 测试文件创建
- [ ] 每个 Resolver 覆盖 validate / resolve / privateEffect
- [ ] 所有测试通过
- [ ] Resolver 目录覆盖率 > 85%

### 7.2 Phase 2 完成标准

- [ ] GameStateService 覆盖率 > 75%
- [ ] 关键路径（行动提交、reveal、音频）有测试
- [ ] 无新增 `as any` 类型断言

### 7.3 整体完成标准

- [ ] 总体行覆盖率 > 65%
- [ ] 分支覆盖率 > 50%
- [ ] 所有 54+ test suites 通过
- [ ] TypeScript 无编译错误

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Resolver 依赖复杂上下文 | 测试难写 | 提取 `createMockContext` 工具 |
| GameStateService 状态复杂 | Mock 困难 | 复用 `hostGameFactory.ts` |
| 测试运行慢 | 开发体验差 | 使用 `--watch` + `--testPathPattern` |

---

## 附录：覆盖率快照

### 当前 0% 覆盖文件（需优先处理）

```
src/services/night/resolvers/hunter.ts   ✅ 已覆盖
src/services/night/resolvers/magician.ts ✅ 已覆盖
src/services/night/resolvers/psychic.ts  ✅ 已覆盖
src/services/night/resolvers/seer.ts     ✅ 已覆盖
src/services/night/resolvers/witch.ts    ✅ 已覆盖
src/services/night/resolvers/gargoyle.ts ✅ 已覆盖
src/services/night/resolvers/darkWolfKing.ts ✅ 已覆盖
src/services/night/resolvers/guard.ts    ✅ 已覆盖 (Session 3)
src/services/night/resolvers/wolf.ts     ✅ 已覆盖 (Session 3)
src/services/night/resolvers/nightmare.ts ✅ 已覆盖 (Session 3)
src/services/night/resolvers/dreamcatcher.ts ✅ 已覆盖 (Session 3)
src/services/night/resolvers/slacker.ts  ✅ 已覆盖 (Session 3)
src/hooks/useGameRoom.ts                 🔄 待处理
src/screens/RoomScreen/hooks/useActionerState.ts ✅ 已覆盖
```

### 新增测试文件（Session 2）

```
src/services/__tests__/GameStateService.lifecycle.test.ts  - 19 tests
src/services/__tests__/GameStateService.recovery.test.ts   - 32 tests
```

### 新增测试文件（Session 3）

```
src/services/night/resolvers/__tests__/guard.resolver.test.ts      - 8 tests
src/services/night/resolvers/__tests__/wolf.resolver.test.ts       - 9 tests
src/services/night/resolvers/__tests__/nightmare.resolver.test.ts  - 8 tests
src/services/night/resolvers/__tests__/dreamcatcher.resolver.test.ts - 5 tests
src/services/night/resolvers/__tests__/slacker.resolver.test.ts    - 6 tests
```

### 当前测试总数

```
Test Suites: 72 passed
Tests:       1005 passed
```

### 当前高覆盖文件（可参考）

```
92% src/screens/RoomScreen/RoomScreen.helpers.ts
91% src/services/NightFlowController.ts
90% src/services/AudioService.ts
87% src/services/night/constraintValidator.ts
```

