# Design System — WerewolfGameJudge

## Product Context

- **What this is:** 狼人杀裁判辅助 app — 管理发牌、夜间行动、揭示身份、计时
- **Who it's for:** 面对面桌游玩家（Host + 远程玩家）
- **Platform:** iOS / Android / Web (React Native + Expo)
- **Theme count:** 8 套（4 浅色 + 4 深色）

## Aesthetic Direction

- **Direction:** iOS 原生质感 — 清晰层级、token 驱动、克制装饰
- **Mood:** 沉浸桌游氛围。浅色主题通透雅致，深色主题各有性格（月蚀=神秘、血月=紧张、幽林=隐秘）
- **Reference:** Apple HIG spacing/typography, 三层 token 架构 (Primitive → Semantic → Component)

## Typography

- **字体:** 系统默认（SF Pro / Roboto / sans-serif）
- **Scale (base 375px, responsive 0.75x–1.25x):**
  - Display: 40px
  - Hero: 32px
  - Heading: 24px
  - Title: 20px
  - Subtitle: 18px
  - Body: 16px
  - Secondary: 14px
  - Caption: 12px
  - CaptionSmall: 10px
- **Line Heights (与字号一一对应):**
  - Display: 50px, Hero: 42px, Heading: 34px, Title: 28px
  - Subtitle: 26px, Body: 24px, Secondary: 20px, Caption: 16px, CaptionSmall: 14px
- **Weights:** normal(400), medium(500), semibold(600), bold(700)
- **Letter Spacing:** hero(-1), tight(-0.5), normal(0), wide(0.5)
- **Text Style Presets:** `textStyles.body`, `textStyles.titleBold` 等，预组合 fontSize + lineHeight + fontWeight（不含 color），消除配对错误

## Color

- **8 主题方案:**

| Key        | Name | Type | Primary   | Background | Surface   | Text      |
| ---------- | ---- | ---- | --------- | ---------- | --------- | --------- |
| `light`    | 月白 | 浅色 | `#5B5BD6` | `#F5F5F7`  | `#FFFFFF` | `#1A1A2E` |
| `sand`     | 暖沙 | 浅色 | `#886830` | `#F3EDE4`  | `#FAF6F0` | `#2D2418` |
| `jade`     | 青瓷 | 浅色 | `#2A8A7A` | `#F3F7F6`  | `#FFFFFF` | `#182828` |
| `sky`      | 晴岚 | 浅色 | `#4A7FBB` | `#F4F6FA`  | `#FFFFFF` | `#1A2030` |
| `dark`     | 石墨 | 深色 | `#7C7CFF` | `#121214`  | `#1C1C1F` | `#F0F0F3` |
| `midnight` | 月蚀 | 深色 | `#8B5CF6` | `#0B0B14`  | `#131320` | `#E8E8F0` |
| `blood`    | 血月 | 深色 | `#DC3B3B` | `#110B0B`  | `#1C1212` | `#F5EAEA` |
| `forest`   | 幽林 | 深色 | `#3DD68C` | `#0A1210`  | `#101D18` | `#E8F5EE` |

- **Semantic colors (每个主题都有):** `primary`, `primaryLight`, `primaryDark`, `background`, `surface`, `surfaceHover`, `card`, `text`, `textSecondary`, `textMuted`, `textInverse`, `border`, `borderLight`, `success`, `warning`, `error`, `info`
- **Game-specific 4 阵营色:** `wolf`(红), `villager`(绿), `god`(紫), `third`(黄)
- **Overlay:** `overlay`(深, 弹窗遮罩), `overlayLight`(浅, 轻遮罩)
- **Default theme:** `light`

## Spacing

- **Base unit:** 响应式 `scale()`, 基准 375px
- **Scale:**
  - micro: 2px, tight: 4px, small: 8px, medium: 16px
  - screenH: 20px (屏幕水平边距，区别于 medium 卡片内距)
  - large: 24px, xlarge: 32px, xxlarge: 48px
- **屏幕边距 vs 卡片内距:** `screenH`(20px) 用于屏幕水平 padding，`medium`(16px) 用于卡片内距

## Border Radius

- none: 0, small: 8px, medium: 12px, large: 16px, xlarge: 24px, full: 9999px
- **Cards/panels:** medium (12px)
- **Buttons:** full (9999px) for primary, medium for secondary
- **Avatars/badges:** full (9999px)

## Component Sizes

- **Button heights:** sm(32), md(44), lg(56)
- **Avatar:** xs(24), sm(32), md(40), lg(56), xl(80)
- **Icon:** xs(12), sm(16), md(20), lg(24), xl(32)
- **Badge:** dot(8), sm(16), md(20)
- **Min touch target:** 44px (fixed)
- **Header/TabBar:** 56px
- **Modal min width:** 280px

## Shadows

```
sm:       0px 1px 3px rgba(0,0,0,0.08)
md:       0px 2px 8px rgba(0,0,0,0.12)
lg:       0px 8px 24px rgba(0,0,0,0.16)
upward:   0px -4px 16px rgba(0,0,0,0.10)
lgUpward: 0px -8px 24px rgba(0,0,0,0.16)
```

使用 RN 0.76+ `boxShadow` 属性，跨 iOS/Android/Web。

## Layout

- **Max content width:** 600px
- **Screen padding:** horizontal=20px, vertical=24px
- **Card padding:** 16px
- **List item gap:** 8px
- **Header height:** 56px

## Fixed Values

- Border width: 1px (normal), 2px (thick), 3px (highlight)
- Active opacity: 0.7 (TouchableOpacity press state)
- Disabled opacity: 0.5

## Motion

- **Approach:** 最小功能性 — 仅辅助理解的过渡。角色揭示动效是例外（Reanimated）。
- **Press feedback:** `activeOpacity: 0.7`（基础），部分组件使用 Reanimated `scale(0.97)` + spring

## Source of Truth

- **Token 定义:** `src/theme/tokens.ts` — spacing, typography, borderRadius, shadows, componentSizes, layout, textStyles, fixed
- **主题颜色:** `src/theme/themes.ts` — 8 套 ThemeColors
- **使用规则:** 禁止 hardcode 颜色（必须从 theme context 取），禁止 hardcode 尺寸（必须从 tokens 取）
