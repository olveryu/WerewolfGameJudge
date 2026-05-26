> ⚠️ Historical document — for reference only, does not reflect current code state

# Apple Design Uplift Plan

> Systematic UI audit + 2-week execution plan
> Goal: Achieve iOS native feel, clear hierarchy, high usability

## Assessment

- **Score: 72 / 100**
- **Maturity: Shippable** (clear gap from "high quality", far from Apple-level)
- **Strengths:** Complete token system (three-layer Primitive → Semantic → Component), 8 theme schemes, component memo-ization for performance, responsive scale()

---

## Top 10 Issues (Priority Ordered)

| #   | Issue                                     | Location                                                           | Severity |
| --- | ----------------------------------------- | ------------------------------------------------------------------ | -------- |
| 1   | Missing lineHeight system                 | `src/theme/tokens.ts` typography has no lineHeight                 | P0       |
| 2   | Modal/Sheet custom-built, no gesture/blur | All bottom sheet components                                        | P1       |
| 3   | Button feedback weak (opacity only)       | ActionButton / MenuItem / TouchableOpacity                         | P1       |
| 4   | No page transition animation              | `src/navigation/AppNavigator.tsx` no animation config              | P1       |
| 5   | HomeScreen flat info hierarchy            | 4 MenuItems equal weight, no primary CTA                           | P0       |
| 6   | Spacing system conflates inner/outer      | `spacing.medium` (16) used for both screen margin and card padding | P1       |
| 7   | Insufficient font weight gradient         | tokens.ts only 400/500/600/700 four levels                         | P2       |
| 8   | SeatTile small screen readability         | 12px name + 10px role name hard to read on SE                      | P2       |
| 9   | Shadows too light                         | `shadows.sm` = `0 1px 2px` very weak depth                         | P1       |
| 10  | Toast left color bar is Material style    | `ThemedToast.tsx` borderLeftWidth: 5                               | P1       |

---

## Phase 1: Token Foundation Layer (Day 1-3)

### 1.1 Add lineHeight Token

**File:** `src/theme/tokens.ts`

**Change:** Add `lineHeights` sub-object to `typography` object:

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

**Usage:** Gradually add `lineHeight: typography.lineHeights.body` etc. to style files.

**Risk:** Global text height changes, requires per-page UI check. Rollback: delete lineHeights.

### 1.2 Add letterSpacing Token

**File:** `src/theme/tokens.ts`

**Change:** Add `letterSpacing` sub-object to `typography` object:

```ts
letterSpacing: {
  tight:   -0.5,  // heading+ 大标题
  normal:   0,    // body 正文
  wide:     0.5,  // caption / button label
  hero:    -1,    // display / hero
}
```

**Risk:** Very low, only affects text where explicitly used.

### 1.3 Fix textMuted Contrast

**File:** `src/theme/themes.ts`

**Change:**

| Theme | Current   | New       | Contrast (vs background) |
| ----- | --------- | --------- | ------------------------ |
| light | `#A1A1AA` | `#78788C` | 2.8:1 → ~4.6:1 ✅        |
| sand  | `#A08C76` | `#8A7760` | ~3.2:1 → ~4.5:1 ✅       |

**Risk:** Only color value change, slightly darker visually. Rollback: restore old values.

### 1.4 Upgrade Shadow Values

**File:** `src/theme/tokens.ts`

**Change:**

```ts
shadows: {
  none:   {} as ViewStyle,
  sm:     { boxShadow: '0px 1px 3px rgba(0,0,0,0.08)' } as ViewStyle,
  md:     { boxShadow: '0px 2px 8px rgba(0,0,0,0.12)' } as ViewStyle,
  lg:     { boxShadow: '0px 8px 24px rgba(0,0,0,0.16)' } as ViewStyle,
  upward: { boxShadow: '0px -4px 16px rgba(0,0,0,0.10)' } as ViewStyle,
}
```

**Risk:** Dark themes need verification that shadows are visible (dark shadow on dark bg may disappear). Rollback: restore old values.

### 1.5 Add screenH Spacing + Separate Screen Margin from Card Padding

**File:** `src/theme/tokens.ts`

**Change:** 在 `spacing` 中增加：

```ts
/** 20px - 屏幕水平边距（区别于卡片内距 medium=16） */
screenH: scale(primitiveSpace[7]),  // 20
```

Update in `layout`:

```ts
screenPaddingH: spacing.screenH,  // 20 (was spacing.medium = 16)
```

**Affected files (need marginHorizontal / paddingHorizontal update):**

- `src/screens/HomeScreen/components/styles.ts` — `userBar.marginHorizontal`, `menu.marginHorizontal`
- `src/screens/RoomScreen/RoomScreen.styles.ts` — `header.paddingHorizontal`, `scrollContent.padding`
- `src/screens/RoomScreen/components/styles.ts` — multiple `marginHorizontal: spacing.medium`
- `src/screens/ConfigScreen/components/styles.ts` — header, cardA, cardB
- `src/screens/SettingsScreen/components/styles.ts` — card outer margin

**Risk:** Spacing increases 4px, may be slightly tight on small screens (320px). Verify iPhone SE layout. Rollback: change `screenH` back to `spacing.medium`.

### 1.6 Unify Button Styles

**Spec:**

- **Primary:** `borderRadius: borderRadius.full` (pill), `colors.primary` bg, `textInverse` text
- **Secondary:** `borderRadius: borderRadius.medium` (12px), `surfaceHover` bg + `borderWidth: 1` + `border` color
- **Danger:** Same as Primary, `colors.error` bg

**Affected files:**

- `src/screens/HomeScreen/components/styles.ts` — `primaryButton` from `borderRadius.medium` → `borderRadius.full`
- `src/screens/ConfigScreen/components/styles.ts` — `bottomCreateBtn` already `borderRadius.full`, unchanged
- `src/screens/RoomScreen/components/styles.ts` — already `borderRadius.full`, unchanged
- `src/screens/SettingsScreen/components/styles.ts` — `logoutBtn` from `borderRadius.medium` → `borderRadius.full`

**Risk:** Noticeable shape change but no functional impact. Rollback: restore individual borderRadius values.

### Day 3 Acceptance: Full screenshot comparison (8 themes × 4 pages), `pnpm run quality` passes

---

## Phase 2: Interaction Layer (Day 4-7)

### 2.1 Implement PressableScale Component

**New file:** `src/components/PressableScale.tsx`

**Implementation:** Use `react-native-reanimated` (installed ~4.1.1) `useSharedValue` + `withSpring`. On press `scale(0.97)` + `opacity(0.9)`, spring back on release. Optional `expo-haptics` (installed ^15.0.8) `impactAsync(ImpactFeedbackStyle.Light)`.

**Interface:**

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

> **Important contract:** ActionButton's `onPress` signature is `(meta: { disabled: boolean }) => void`; the button still fires onPress in disabled state passing `{ disabled: true }`, with policy deciding NOOP or showAlert. PressableScale **must preserve this meta callback pattern**, cannot use RN `disabled` prop to block onPress.

**Replacement strategy:** Batch replacement, prioritizing high-frequency interactions:

1. ActionButton (RoomScreen primary actions) — preserve `(meta) => void` callback signature
2. MenuItem (HomeScreen menu items) — standard `() => void`
3. ConfigScreen RoleChip
4. Remaining TouchableOpacity

**Risk:** Reanimated needs Web verification. Existing RoleRevealEffects using Reanimated proves feasibility. Rollback: component-internal fallback to `Pressable` + `Animated`.

### 2.2 Page Transition Animations

**File:** `src/navigation/AppNavigator.tsx`

**Change:**

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

**Risk:** `presentation: 'modal'` changes gesture on NativeStack (iOS swipe-left becomes swipe-down). Need to verify ConfigScreen back behavior (currently uses `navigation.goBack()`, compatible). Web `slide_from_bottom` may not have built-in animation, fallback to `fade` after verification. Rollback: remove animation/presentation.

### 2.3 HomeScreen Information Hierarchy Restructure

**File:** `src/screens/HomeScreen/HomeScreen.tsx` + `styles.ts` + possibly new components

**Approach:**

Current 4 equal-weight MenuItems → restructured to 3 levels:

1. **Hero CTA**: "创建房间" large pill button (full-width, primary bg, icon + text)
2. **Action Row**: "进入房间" + "返回上局" horizontal dual cards (surface bg, icon + title)
3. **List item**: "设置" keeps MenuItem style

Also add inline `ActivityIndicator` to all network request CTAs (currently HomeScreen only changes text to "创建中...", ConfigScreen already has spinner for reference).

**Risk:** Component structure changes but data flow unchanged (all handlers unchanged). Need to update HomeScreen test case testID queries. Rollback: git revert the commit.

### 2.4 Toast Redesign to iOS Capsule Style

**File:** `src/components/ThemedToast.tsx`

**Approach:** 自定义 `toastConfig` 渲染函数（`react-native-toast-message` 支持完全自定义），替代 `BaseToast`：

- Shape: `borderRadius: borderRadius.full` (pill)
- Layout: Horizontal icon (Ionicons checkmark-circle / alert-circle / information-circle) + text
- Remove `borderLeftWidth: 5`
- Position: Unified to `position: 'top'` (currently mixed top/bottom, need to unify callers)
- Shadow: `shadows.md`
- Auto-dismiss: Keep default 3s (`react-native-toast-message` default behavior)

> **Note:** Some current `Toast.show` calls explicitly pass `position: 'bottom'` (useAuthForm, useRoomScreenState), others use default top. After unifying to top, need to update these callers and remove `position: 'bottom'`.

**Risk:** Toast is global, need to verify all showToast call scenarios (success/failure/info). Rollback: restore BaseToast wrapper.

### Day 7 Acceptance: Interaction feedback feel testing, `pnpm run quality` + E2E passes

---

## Phase 3: Visual Quality Upgrade (Day 8-11)

### 3.1 Add Blur Background to BottomActionPanel

**Dependency:** Install `expo-blur`

```sh
pnpm add expo-blur
```

**File:** `src/screens/RoomScreen/components/BottomActionPanel.tsx`

**Approach:** 用 `BlurView` 包裹面板内容：

```tsx
import { BlurView } from 'expo-blur';

// isDark ? 'dark' : 'light'
<BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={styles.container}>
  {children}
</BlurView>;
```

`container` `backgroundColor` changed to semi-transparent: `colors.surface + 'CC'` (80% opacity).

**Web fallback:** `expo-blur` uses CSS `backdrop-filter: blur()` on Web, supported by Chrome/Safari, Firefox 84+. Older versions fall back to solid background.

**Affected components:** Only BottomActionPanel. Need to get `isDark` from `useTheme()`.

**Risk:** Performance — blur may lag on low-end Android. Can degrade to solid color via `Platform.OS === 'android' && !isHighEnd`. Rollback: remove BlurView, restore solid color.

### 3.2 RoomScreen Header Blur

**File:** `src/screens/RoomScreen/RoomScreen.tsx` + `RoomScreen.styles.ts`

**Approach:** Header 的 `backgroundColor: colors.surface` → `BlurView` 包裹，背景色改半透明。`ScrollView` 加 `contentInsetAdjustmentBehavior` 或 `paddingTop` 确保内容不被遮挡。

**Risk:** Same as 3.1, performance related. Need to verify ScrollView content scrolls correctly under header. Rollback: restore solid color header.

### 3.3 ConfigScreen FactionTabs → Segmented Control Style

**File:** `src/screens/ConfigScreen/components/FactionTabs.tsx` + `styles.ts`

**Approach:** 当前是底部下划线指示器 → 改为 iOS Segmented Control 样式：

- Container: `borderRadius.full`, `colors.surfaceHover` background
- Active tab: `colors.surface` background pill + `shadows.sm`, translation animation
- Inactive tab: transparent background

**Risk:** Large visual change but no logic impact. `activeTab` state and `onTabPress` callback unchanged. Rollback: restore underline style.

### 3.4 Unified Bottom Sheet Handle Bar

**Files:** All custom bottom sheets (SettingsSheet / TemplatePicker / VariantPicker / RoleInfoSheet / NightReviewModal / ShareReviewModal / QRCodeModal)

**Approach (no new dependencies):** Uniformly add drag handle bar at the top of existing Modal content:

```tsx
<View style={styles.handleBar} />
// handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.small }
```

Gesture drag-to-dismiss deferred (requires `@gorhom/bottom-sheet`, listed as independent Phase 4 evaluation).

**P2 Follow-up:** Evaluate `@gorhom/bottom-sheet` adoption (requires `react-native-reanimated` ✅ + `react-native-gesture-handler` ✅ already installed).

**Risk:** Very low, only adding a 4px height View.

### Day 11 Acceptance: `pnpm run quality` + blur performance profile

---

## Phase 4: Final Verification (Day 12-14)

### 4.1 Complete accessibilityLabel Coverage

**Affected components:**

- `ActionButton` — derived from `label` prop
- `MenuItem` — derived from `title` prop
- `NumPad` — add `accessibilityLabel` to each key ("数字1"/"清除"/"退格")
- `RoleChip` — derived from `label` prop
- `SeatTile` — "座位N" / "座位N 玩家名"
- `Avatar` — "头像"
- All Modal close buttons — "关闭"

**Risk:** Purely additive, no impact on existing functionality.

### 4.2 Modal maxWidth Responsive

**Affected files:**

- `src/screens/HomeScreen/components/styles.ts` — `modalContent.maxWidth: 340` → `Math.min(400, screenWidth * 0.85)` (need to pass screenWidth param)

**Approach:** `createHomeScreenStyles` 已接受 `colors` 参数，改为 `createHomeScreenStyles(colors, screenWidth)` 或在 `modalContent` 的消费方用 `useWindowDimensions()` 覆盖。

**Risk:** Signature change requires updating callers.

### 4.3 PlayerGrid Adaptive Column Count for Large Screens

**File:** `src/screens/RoomScreen/components/SeatTile.tsx` + `PlayerGrid.tsx`

**Approach:**

```ts
// 当前固定 4 列
export const GRID_COLUMNS = 4;

// 改为动态计算（PlayerGrid 内部）
const GRID_COLUMNS = screenWidth >= 768 ? 6 : screenWidth >= 600 ? 5 : 4;
```

**Risk:** Need to verify tileSize is sufficient at 5/6 columns ((768-48)/6 = 120px, reasonable). SeatTile internal dimensions depend on tileSize, auto-adapts.

### 4.4 Auth Form Style Deduplication (P2)

**Problem:** HomeScreen and SettingsScreen each define ~20 auth-related style keys (input / passwordWrapper / primaryButton / errorText / emailDomainDropdown etc.), with significant duplication and subtle inconsistencies (e.g. formTitle uses `typography.title` bold in one, `typography.subtitle` semibold in the other).

**Approach:** 提取 `createAuthFormStyles(colors: ThemeColors)` 工厂函数到 `src/components/auth/authStyles.ts`，各 screen 通过 spread + override 使用：

```ts
const authBase = createAuthFormStyles(colors);
// 在 screen styles 中 spread
primaryButton: { ...authBase.primaryButton, /* screen-specific overrides */ },
```

**Risk:** Low, pure refactoring. Need to verify UI unchanged on both sides. Rollback: restore individual files.

### 4.5 lineHeight Full Rollout

Apply Phase 1 `lineHeights` token to all `Text` styles page by page:

**Priority:**

1. Multi-line text paragraphs (`actionMessage`, `modalMessage`, `guideStepText`)
2. Body text (body level)
3. Titles/subtitles
4. Auxiliary text

**Method:** Add `lineHeight: typography.lineHeights.xxx` individually in each screen style's `createXxxStyles`.

**Risk:** Increased line height affects component height, may cause fixed-height container overflow. Requires per-page verification.

### Day 14 Final Acceptance

- [ ] `pnpm run quality` passes
- [ ] `pnpm exec tsc --noEmit` zero errors
- [ ] 8 themes × 4 pages screenshot comparison (light / sand / jade / sky / dark / midnight / blood / forest)
- [ ] iPhone SE (375) / iPhone 16 Pro Max (430) / iPad (768+) / Web (1024+) 4 width verification
- [ ] E2E regression: `pnpm exec playwright test --reporter=list`
- [ ] Knip no new dead code: `npx knip --no-exit-code`

---

## Design Spec Summary (Token Change Table)

### spacing Added

| Token     | Value       | Purpose                  |
| --------- | ----------- | ------------------------ |
| `screenH` | `scale(20)` | Screen horizontal margin |

### typography Added

| Token             | Value   | Purpose               |
| ----------------- | ------- | --------------------- |
| `lineHeights.*`   | See 1.1 | Line height system    |
| `letterSpacing.*` | See 1.2 | Letter spacing system |

### shadows Changed

| Token    | Before                         | After                          |
| -------- | ------------------------------ | ------------------------------ |
| `sm`     | `0 1px 2px rgba(0,0,0,0.05)`   | `0 1px 3px rgba(0,0,0,0.08)`   |
| `md`     | `0 2px 4px rgba(0,0,0,0.1)`    | `0 2px 8px rgba(0,0,0,0.12)`   |
| `lg`     | `0 4px 8px rgba(0,0,0,0.15)`   | `0 8px 24px rgba(0,0,0,0.16)`  |
| `upward` | `0 -3px 12px rgba(0,0,0,0.08)` | `0 -4px 16px rgba(0,0,0,0.10)` |

### themes Changed

| Theme | Token       | Before    | After     |
| ----- | ----------- | --------- | --------- |
| light | `textMuted` | `#A1A1AA` | `#78788C` |
| sand  | `textMuted` | `#A08C76` | `#8A7760` |

### Component Spec

| Component        | Spec                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------- |
| Primary Button   | pill (`borderRadius.full`), `button.md` height, `primary` bg, `textInverse`, `semibold` |
| Secondary Button | `borderRadius.medium`, `surfaceHover` bg + 1px `border`, `textSecondary`, `medium`      |
| Danger Button    | Same as Primary, `error` bg                                                             |
| Card             | `borderRadius.large`, `shadows.md`, `surface` bg, `spacing.medium` padding              |
| Bottom Panel     | BlurView + semi-transparent surface, `shadows.upward`, topRadius `large`                |
| Toast            | pill (`borderRadius.full`), icon + single-line text, `shadows.md`, no borderLeft        |
| Bottom Sheet     | handle bar (40×4 pill), topRadius `xlarge`, `overlay` backdrop                          |

---

## New Dependencies

| Package     | Version                    | Purpose                    | Phase   |
| ----------- | -------------------------- | -------------------------- | ------- |
| `expo-blur` | latest (SDK 54 compatible) | Header/Panel backdrop blur | Phase 3 |

Existing dependencies, no additional installation needed:

- `react-native-reanimated` ~4.1.1 → PressableScale
- `react-native-gesture-handler` ~2.28.0 → Future bottom sheet
- `expo-haptics` ^15.0.8 → PressableScale haptic

---

## Constraints

- **No business logic changes, no data flow changes, no API changes**
- Each Phase has independent git tag, can be rolled back
- Daily output verifiable (screenshot comparison / tests passing)
- All changes verified via `pnpm run quality`
