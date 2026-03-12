# Apple Design Uplift Plan

> 系统性 UI 审查 + 2 周执行方案
> 目标：达到 iOS 原生质感、清晰层级、高可用性

## 评估

- **评分：72 / 100**
- **成熟度：可发布**（距"高质量"有明确差距，距 Apple 级尚远）
- **优势：** Token 体系完整（三层 Primitive → Semantic → Component），8 主题方案，组件 memo 化性能好，响应式 scale()

---

## Top 10 问题（优先级排序）

| #   | 问题                          | 位置                                                | 严重度 |
| --- | ----------------------------- | --------------------------------------------------- | ------ |
| 1   | 缺少 lineHeight 系统          | `src/theme/tokens.ts` typography 无 lineHeight      | P0     |
| 2   | Modal/Sheet 自建，无手势/blur | 所有 bottom sheet 组件                              | P1     |
| 3   | 按钮反馈单薄（仅 opacity）    | ActionButton / MenuItem / TouchableOpacity          | P1     |
| 4   | 页面转场无动效                | `src/navigation/AppNavigator.tsx` 无 animation 配置 | P1     |
| 5   | HomeScreen 信息层级扁平       | 4 个 MenuItem 等权重，无主 CTA                      | P0     |
| 6   | 间距系统内外不分              | `spacing.medium` (16) 同时做屏幕边距和卡片 padding  | P1     |
| 7   | 字重梯度不足                  | tokens.ts 仅 400/500/600/700 四档                   | P2     |
| 8   | SeatTile 小屏文字可读性       | 12px 名 + 10px 角色名在 SE 上难读                   | P2     |
| 9   | 阴影过浅                      | `shadows.sm` = `0 1px 2px` 层级感极弱               | P1     |
| 10  | Toast 左色条是 Material 风格  | `ThemedToast.tsx` borderLeftWidth: 5                | P1     |

---

## Phase 1：Token 基础层（Day 1-3）

### 1.1 添加 lineHeight token

**文件：** `src/theme/tokens.ts`

**变更：** 在 `typography` 对象中增加 `lineHeights` 子对象：

```ts
lineHeights: {
  captionSmall: scale(14),  // 10px × 1.4
  caption:      scale(16),  // 12px × 1.33
  secondary:    scale(20),  // 14px × 1.43
  body:         scale(24),  // 16px × 1.5
  subtitle:     scale(26),  // 18px × 1.44
  title:        scale(28),  // 20px × 1.4
  heading:      scale(34),  // 24px × 1.42
  hero:         scale(42),  // 32px × 1.31
  display:      scale(50),  // 40px × 1.25
}
```

**消费方式：** 各 styles 文件逐步补 `lineHeight: typography.lineHeights.body` 等。

**风险：** 全局文字高度变化，需逐页 UI 检查。回退：删除 lineHeights 即可。

### 1.2 添加 letterSpacing token

**文件：** `src/theme/tokens.ts`

**变更：** 在 `typography` 对象中增加 `letterSpacing` 子对象：

```ts
letterSpacing: {
  tight:   -0.5,  // heading+ 大标题
  normal:   0,    // body 正文
  wide:     0.5,  // caption / button label
  hero:    -1,    // display / hero
}
```

**风险：** 极低，仅影响被显式使用的文字。

### 1.3 修复 textMuted 对比度

**文件：** `src/theme/themes.ts`

**变更：**

| 主题  | 当前值    | 新值      | 对比度（vs background） |
| ----- | --------- | --------- | ----------------------- |
| light | `#A1A1AA` | `#78788C` | 2.8:1 → ~4.6:1 ✅       |
| sand  | `#A08C76` | `#8A7760` | ~3.2:1 → ~4.5:1 ✅      |

**风险：** 仅色值变化，视觉略深。回退：恢复旧值。

### 1.4 升级阴影数值

**文件：** `src/theme/tokens.ts`

**变更：**

```ts
shadows: {
  none:   {} as ViewStyle,
  sm:     { boxShadow: '0px 1px 3px rgba(0,0,0,0.08)' } as ViewStyle,
  md:     { boxShadow: '0px 2px 8px rgba(0,0,0,0.12)' } as ViewStyle,
  lg:     { boxShadow: '0px 8px 24px rgba(0,0,0,0.16)' } as ViewStyle,
  upward: { boxShadow: '0px -4px 16px rgba(0,0,0,0.10)' } as ViewStyle,
}
```

**风险：** 暗色主题需验证阴影是否可见（暗底暗影可能消失）。回退：恢复旧值。

### 1.5 添加 screenH 间距 + 分离屏幕边距与卡片 padding

**文件：** `src/theme/tokens.ts`

**变更：** 在 `spacing` 中增加：

```ts
/** 20px - 屏幕水平边距（区别于卡片内距 medium=16） */
screenH: scale(primitiveSpace[7]),  // 20
```

在 `layout` 中更新：

```ts
screenPaddingH: spacing.screenH,  // 20 (was spacing.medium = 16)
```

**受影响文件（需更新 marginHorizontal / paddingHorizontal）：**

- `src/screens/HomeScreen/components/styles.ts` — `userBar.marginHorizontal`, `menu.marginHorizontal`
- `src/screens/RoomScreen/RoomScreen.styles.ts` — `header.paddingHorizontal`, `scrollContent.padding`
- `src/screens/RoomScreen/components/styles.ts` — 多个 `marginHorizontal: spacing.medium`
- `src/screens/ConfigScreen/components/styles.ts` — header, cardA, cardB
- `src/screens/SettingsScreen/components/styles.ts` — card 外距

**风险：** 间距增大 4px，小屏（320px）上可能略挤。验证 iPhone SE 布局。回退：`screenH` 改回 `spacing.medium`。

### 1.6 统一按钮形态

**规范：**

- **Primary：** `borderRadius: borderRadius.full`（pill），`colors.primary` bg，`textInverse` 文字
- **Secondary：** `borderRadius: borderRadius.medium`（12px），`surfaceHover` bg + `borderWidth: 1` + `border` 色
- **Danger：** 同 Primary，`colors.error` bg

**受影响文件：**

- `src/screens/HomeScreen/components/styles.ts` — `primaryButton` 从 `borderRadius.medium` → `borderRadius.full`
- `src/screens/ConfigScreen/components/styles.ts` — `bottomCreateBtn` 已经是 `borderRadius.full`，不变
- `src/screens/RoomScreen/components/styles.ts` — 已经是 `borderRadius.full`，不变
- `src/screens/SettingsScreen/components/styles.ts` — `logoutBtn` 从 `borderRadius.medium` → `borderRadius.full`

**风险：** 形态变化明显但不影响功能。回退：恢复各自 borderRadius。

### Day 3 验收：全量截图对比（8 主题 × 4 页面），`pnpm run quality` 通过

---

## Phase 2：交互层（Day 4-7）

### 2.1 实现 PressableScale 组件

**新文件：** `src/components/PressableScale.tsx`

**实现：** 使用 `react-native-reanimated`（已安装 ~4.1.1）的 `useSharedValue` + `withSpring`。按压时 `scale(0.97)` + `opacity(0.9)`，松开弹回。可选 `expo-haptics`（已安装 ^15.0.8）`impactAsync(ImpactFeedbackStyle.Light)`。

**接口：**

```ts
interface PressableScaleProps {
  onPress: (meta?: { disabled: boolean }) => void;
  disabled?: boolean;
  activeScale?: number; // default 0.97
  haptic?: boolean; // default false
  style?: ViewStyle;
  children: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}
```

> **重要合约：** ActionButton 的 `onPress` 签名是 `(meta: { disabled: boolean }) => void`，按钮在 disabled 状态仍会触发 onPress 并传递 `{ disabled: true }`，由 policy 决策是 NOOP 还是 showAlert。PressableScale **必须保留这个 meta 回调模式**，不能用 RN `disabled` prop 阻断 onPress。

**替换策略：** 分批替换，优先高频交互：

1. ActionButton（RoomScreen 主操作）— 注意保留 `(meta) => void` 回调签名
2. MenuItem（HomeScreen 菜单项）— 普通 `() => void`
3. ConfigScreen RoleChip
4. 其余 TouchableOpacity

**风险：** Reanimated 在 Web 端需验证。已有 RoleRevealEffects 使用 Reanimated 证明可行。回退：组件内 fallback 到 `Pressable` + `Animated`。

### 2.2 页面转场动效

**文件：** `src/navigation/AppNavigator.tsx`

**变更：**

```tsx
<Stack.Navigator
  initialRouteName="Home"
  screenOptions={{
    headerShown: false,
    contentStyle: { backgroundColor: colors.background },
    animation: 'default', // iOS: push, Android: fade_from_bottom
  }}
>
  <Stack.Screen name="Home" component={HomeScreen} />
  <Stack.Screen
    name="Config"
    component={ConfigScreen}
    options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
  />
  <Stack.Screen name="Room" component={RoomScreen} />
  <Stack.Screen
    name="Settings"
    component={SettingsScreen}
    options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
  />
</Stack.Navigator>
```

**风险：** `presentation: 'modal'` 在 NativeStack 上改变手势（iOS 左滑变下拉）。需验证 ConfigScreen 返回行为（当前用 `navigation.goBack()`，兼容）。Web 端 `slide_from_bottom` 可能不自带动画，验证后 fallback `fade`。回退：删除 animation/presentation。

### 2.3 HomeScreen 信息层级重构

**文件：** `src/screens/HomeScreen/HomeScreen.tsx` + `styles.ts` + 可能新增组件

**方案：**

当前 4 个等权 MenuItem → 改为 3 层：

1. **Hero CTA**：「创建房间」大号 pill 按钮（full-width，primary bg，icon + text）
2. **Action Row**：「进入房间」+「返回上局」水平双卡片（surface bg，icon + title）
3. **List item**：「设置」保持 MenuItem 样式

同时在所有网络请求 CTA 中加入 inline `ActivityIndicator`（当前 HomeScreen 仅文字变化"创建中..."，ConfigScreen 已有 spinner 可参考）。

**风险：** 组件结构变化但数据流不变（所有 handler 不变）。需更新 HomeScreen 测试用例中的 testID 查询。回退：git revert 该 commit。

### 2.4 Toast 改 iOS capsule 风格

**文件：** `src/components/ThemedToast.tsx`

**方案：** 自定义 `toastConfig` 渲染函数（`react-native-toast-message` 支持完全自定义），替代 `BaseToast`：

- 形状：`borderRadius: borderRadius.full`（pill）
- 布局：水平 icon (Ionicons checkmark-circle / alert-circle / information-circle) + 文字
- 移除 `borderLeftWidth: 5`
- 位置：统一为 `position: 'top'`（当前混用 top/bottom，需统一调用方）
- 阴影：`shadows.md`
- 自动消失：保持默认 3s（`react-native-toast-message` 默认行为）

> **注意：** 当前 `Toast.show` 有些调用显式传 `position: 'bottom'`（useAuthForm, useRoomScreenState），有些用默认 top。统一为 top 后需更新这些调用方，移除 `position: 'bottom'`。

**风险：** Toast 全局生效，需验证所有 showToast 调用场景（成功/失败/信息）。回退：恢复 BaseToast 包装。

### Day 7 验收：交互反馈体感测试，`pnpm run quality` + E2E 通过

---

## Phase 3：质感升级（Day 8-11）

### 3.1 BottomActionPanel 添加 blur 背景

**依赖：** 需安装 `expo-blur`

```sh
pnpm add expo-blur
```

**文件：** `src/screens/RoomScreen/components/BottomActionPanel.tsx`

**方案：** 用 `BlurView` 包裹面板内容：

```tsx
import { BlurView } from 'expo-blur';

// isDark ? 'dark' : 'light'
<BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={styles.container}>
  {children}
</BlurView>;
```

`container` 的 `backgroundColor` 改为半透明：`colors.surface + 'CC'`（80% opacity）。

**Web fallback：** `expo-blur` 在 Web 端使用 CSS `backdrop-filter: blur()`，Chrome/Safari 支持，Firefox 84+ 支持。低版本 fallback 为纯色背景。

**受影响组件：** 仅 BottomActionPanel。需从 `useTheme()` 获取 `isDark`。

**风险：** 性能——blur 在低端 Android 上可能卡顿。可通过 `Platform.OS === 'android' && !isHighEnd` 降级为纯色。回退：移除 BlurView，恢复纯色。

### 3.2 RoomScreen Header blur

**文件：** `src/screens/RoomScreen/RoomScreen.tsx` + `RoomScreen.styles.ts`

**方案：** Header 的 `backgroundColor: colors.surface` → `BlurView` 包裹，背景色改半透明。`ScrollView` 加 `contentInsetAdjustmentBehavior` 或 `paddingTop` 确保内容不被遮挡。

**风险：** 同 3.1，性能相关。需验证 ScrollView 内容在 header 下方正确滚动。回退：恢复纯色 header。

### 3.3 ConfigScreen FactionTabs 改 Segmented Control 风格

**文件：** `src/screens/ConfigScreen/components/FactionTabs.tsx` + `styles.ts`

**方案：** 当前是底部下划线指示器 → 改为 iOS Segmented Control 样式：

- 容器：`borderRadius.full`，`colors.surfaceHover` 背景
- 活跃 tab：`colors.surface` 背景 pill + `shadows.sm`，位移动画
- 非活跃 tab：透明背景

**风险：** 视觉变化大但不影响逻辑。`activeTab` state 和 `onTabPress` 回调不变。回退：恢复下划线样式。

### 3.4 Bottom Sheet 统一手柄条

**文件：** 所有自建 bottom sheet（SettingsSheet / TemplatePicker / VariantPicker / RoleInfoSheet / NightReviewModal / ShareReviewModal / QRCodeModal）

**方案（不引入新依赖）：** 在现有 Modal 内容顶部统一添加 drag handle bar：

```tsx
<View style={styles.handleBar} />
// handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.small }
```

暂不做手势拖拽关闭（需引入 `@gorhom/bottom-sheet`，列为后续 Phase 4 独立评估）。

**P2 后续：** 评估 `@gorhom/bottom-sheet` 引入（需要 `react-native-reanimated` ✅ + `react-native-gesture-handler` ✅ 已安装）。

**风险：** 极低，仅添加一个 4px 高度的 View。

### Day 11 验收：`pnpm run quality` + blur 性能 profile

---

## Phase 4：收尾验证（Day 12-14）

### 4.1 accessibilityLabel 全量补充

**受影响组件：**

- `ActionButton` — 从 `label` prop 派生
- `MenuItem` — 从 `title` prop 派生
- `NumPad` — 各键加 `accessibilityLabel`（"数字1"/"清除"/"退格"）
- `RoleChip` — 从 `label` prop 派生
- `SeatTile` — "座位N" / "座位N 玩家名"
- `Avatar` — "头像"
- 各 Modal 关闭按钮 — "关闭"

**风险：** 纯增量添加，不影响现有功能。

### 4.2 Modal maxWidth 响应式

**受影响文件：**

- `src/screens/HomeScreen/components/styles.ts` — `modalContent.maxWidth: 340` → `Math.min(400, screenWidth * 0.85)`（需传入 screenWidth 参数）

**方案：** `createHomeScreenStyles` 已接受 `colors` 参数，改为 `createHomeScreenStyles(colors, screenWidth)` 或在 `modalContent` 的消费方用 `useWindowDimensions()` 覆盖。

**风险：** 签名变化需更新调用方。

### 4.3 PlayerGrid 大屏列数自适应

**文件：** `src/screens/RoomScreen/components/SeatTile.tsx` + `PlayerGrid.tsx`

**方案：**

```ts
// 当前固定 4 列
export const GRID_COLUMNS = 4;

// 改为动态计算（PlayerGrid 内部）
const GRID_COLUMNS = screenWidth >= 768 ? 6 : screenWidth >= 600 ? 5 : 4;
```

**风险：** 需验证 5/6 列时 tileSize 足够（(768-48)/6 = 120px，合理）。SeatTile 内部尺寸依赖 tileSize，自动适配。

### 4.4 Auth 表单样式去重（P2）

**问题：** HomeScreen 和 SettingsScreen 各自定义了 ~20 个 auth 相关样式键（input / passwordWrapper / primaryButton / errorText / emailDomainDropdown 等），存在大量重复且有细微不一致（如 formTitle 一个用 `typography.title` bold，另一个用 `typography.subtitle` semibold）。

**方案：** 提取 `createAuthFormStyles(colors: ThemeColors)` 工厂函数到 `src/components/auth/authStyles.ts`，各 screen 通过 spread + override 使用：

```ts
const authBase = createAuthFormStyles(colors);
// 在 screen styles 中 spread
primaryButton: { ...authBase.primaryButton, /* screen-specific overrides */ },
```

**风险：** 低，纯重构。需验证两边 UI 不变。回退：恢复各自文件。

### 4.5 lineHeight 全量落地

将 Phase 1 添加的 `lineHeights` token 逐页应用到所有 `Text` style：

**优先级：**

1. 多行文本段（`actionMessage`、`modalMessage`、`guideStepText`）
2. 正文（`body` 级）
3. 标题/副标题
4. 辅助文字

**方式：** 在各 screen styles 的 `createXxxStyles` 中逐个添加 `lineHeight: typography.lineHeights.xxx`。

**风险：** 行高增大会影响组件高度，可能导致固定高度容器溢出。需逐页验证。

### Day 14 最终验收

- [ ] `pnpm run quality` 通过
- [ ] `pnpm exec tsc --noEmit` 零错误
- [ ] 8 主题 × 4 页面截图对比（light / sand / jade / sky / dark / midnight / blood / forest）
- [ ] iPhone SE（375） / iPhone 16 Pro Max（430） / iPad（768+） / Web（1024+）4种宽度验证
- [ ] E2E 回归：`pnpm exec playwright test --reporter=list`
- [ ] Knip 无新死代码：`npx knip --no-exit-code`

---

## 设计规范汇总（Token 变更总表）

### spacing 新增

| Token     | 值          | 用途         |
| --------- | ----------- | ------------ |
| `screenH` | `scale(20)` | 屏幕水平边距 |

### typography 新增

| Token             | 值     | 用途       |
| ----------------- | ------ | ---------- |
| `lineHeights.*`   | 见 1.1 | 行高系统   |
| `letterSpacing.*` | 见 1.2 | 字间距系统 |

### shadows 变更

| Token    | Before                         | After                          |
| -------- | ------------------------------ | ------------------------------ |
| `sm`     | `0 1px 2px rgba(0,0,0,0.05)`   | `0 1px 3px rgba(0,0,0,0.08)`   |
| `md`     | `0 2px 4px rgba(0,0,0,0.1)`    | `0 2px 8px rgba(0,0,0,0.12)`   |
| `lg`     | `0 4px 8px rgba(0,0,0,0.15)`   | `0 8px 24px rgba(0,0,0,0.16)`  |
| `upward` | `0 -3px 12px rgba(0,0,0,0.08)` | `0 -4px 16px rgba(0,0,0,0.10)` |

### themes 变更

| 主题  | Token       | Before    | After     |
| ----- | ----------- | --------- | --------- |
| light | `textMuted` | `#A1A1AA` | `#78788C` |
| sand  | `textMuted` | `#A08C76` | `#8A7760` |

### 组件规范

| 组件             | 规范                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------- |
| Primary Button   | pill (`borderRadius.full`), `button.md` 高度, `primary` bg, `textInverse`, `semibold` |
| Secondary Button | `borderRadius.medium`, `surfaceHover` bg + 1px `border`, `textSecondary`, `medium`    |
| Danger Button    | 同 Primary, `error` bg                                                                |
| Card             | `borderRadius.large`, `shadows.md`, `surface` bg, `spacing.medium` padding            |
| Bottom Panel     | BlurView + 半透明 surface, `shadows.upward`, topRadius `large`                        |
| Toast            | pill (`borderRadius.full`), icon + 单行文字, `shadows.md`, 无 borderLeft              |
| Bottom Sheet     | handle bar (40×4 pill), topRadius `xlarge`, `overlay` backdrop                        |

---

## 新增依赖

| 包          | 版本                       | 用途                       | Phase   |
| ----------- | -------------------------- | -------------------------- | ------- |
| `expo-blur` | latest (SDK 54 compatible) | Header/Panel backdrop blur | Phase 3 |

已有依赖无需额外安装：

- `react-native-reanimated` ~4.1.1 → PressableScale
- `react-native-gesture-handler` ~2.28.0 → 未来 bottom sheet
- `expo-haptics` ^15.0.8 → PressableScale haptic

---

## 约束

- **不改业务逻辑、不改数据流、不改 API**
- 每个 Phase 独立 git tag，可回滚
- 每天产出可验证（截图对比 / 测试通过）
- 所有变更通过 `pnpm run quality` 验证
