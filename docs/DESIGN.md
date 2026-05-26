# Design System — WerewolfGameJudge

## Product Context

- **What this is:** Werewolf judge assistant app — manages card dealing, night actions, identity reveals, timers
- **Who it's for:** Face-to-face tabletop players (Host + remote players)
- **Platform:** iOS / Android / Web (React Native + Expo)
- **Theme count:** Currently 1 theme implemented (Moonlight / light); multi-theme is planned (design has 8 themes: 4 light + 4 dark)

## Aesthetic Direction

- **Direction:** iOS native feel — clear hierarchy, token-driven, restrained decoration
- **Mood:** Immersive tabletop atmosphere. Light themes are clean and elegant; dark themes each have personality (Eclipse = mysterious, Blood Moon = tense, Forest = secretive)
- **Reference:** Apple HIG spacing/typography, three-layer token architecture (Primitive → Semantic → Component)

## Typography

- **Font:** System default (SF Pro / Roboto / sans-serif)
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
- **Line Heights (corresponding to each font size):**
  - Display: 50px, Hero: 42px, Heading: 34px, Title: 28px
  - Subtitle: 26px, Body: 24px, Secondary: 20px, Caption: 16px, CaptionSmall: 14px
- **Weights:** normal(400), medium(500), semibold(600), bold(700)
- **Letter Spacing:** hero(-1), tight(-0.5), normal(0), wide(0.5)
- **Text Style Presets:** `textStyles.body`, `textStyles.titleBold` etc., pre-composed fontSize + lineHeight + fontWeight (no color), eliminating pairing errors

## Color

- **8 Theme Schemes:**

| Key        | Name       | Type  | Primary   | Background | Surface   | Text      |
| ---------- | ---------- | ----- | --------- | ---------- | --------- | --------- |
| `light`    | Moonlight  | Light | `#5B5BD6` | `#F5F5F7`  | `#FFFFFF` | `#1A1A2E` |
| `sand`     | Warm Sand  | Light | `#886830` | `#F3EDE4`  | `#FAF6F0` | `#2D2418` |
| `jade`     | Celadon    | Light | `#2A8A7A` | `#F3F7F6`  | `#FFFFFF` | `#182828` |
| `sky`      | Clear Sky  | Light | `#4A7FBB` | `#F4F6FA`  | `#FFFFFF` | `#1A2030` |
| `dark`     | Graphite   | Dark  | `#7C7CFF` | `#121214`  | `#1C1C1F` | `#F0F0F3` |
| `midnight` | Eclipse    | Dark  | `#8B5CF6` | `#0B0B14`  | `#131320` | `#E8E8F0` |
| `blood`    | Blood Moon | Dark  | `#DC3B3B` | `#110B0B`  | `#1C1212` | `#F5EAEA` |
| `forest`   | Forest     | Dark  | `#3DD68C` | `#0A1210`  | `#101D18` | `#E8F5EE` |

- **Semantic colors (every theme has):** `primary`, `primaryLight`, `primaryDark`, `background`, `surface`, `surfaceHover`, `card`, `text`, `textSecondary`, `textMuted`, `textInverse`, `border`, `borderLight`, `success`, `warning`, `error`, `info`
- **Game-specific 4 faction colors:** `wolf`(red), `villager`(green), `god`(purple), `third`(yellow)
- **Overlay:** `overlay`(dark, modal backdrop), `overlayLight`(light, subtle overlay)
- **Default theme:** `light`

## Spacing

- **Base unit:** Responsive `scale()`, reference 375px
- **Scale:**
  - micro: 2px, tight: 4px, small: 8px, medium: 16px
  - screenH: 20px (screen horizontal margin, distinct from medium card padding)
  - large: 24px, xlarge: 32px, xxlarge: 48px
- **Screen margin vs card padding:** `screenH`(20px) for screen horizontal padding, `medium`(16px) for card internal padding

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

Uses RN 0.76+ `boxShadow` property, cross-platform iOS/Android/Web.

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

- **Approach:** Minimal functional — only transitions that aid comprehension. Role reveal animation is the exception (Reanimated).
- **Press feedback:** `activeOpacity: 0.7` (base), some components use Reanimated `scale(0.97)` + spring

## Source of Truth

- **Token definitions:** `src/theme/tokens.ts` — spacing, typography, borderRadius, shadows, componentSizes, layout, textStyles, fixed
- **Theme colors:** `src/theme/themes.ts` — 8 ThemeColors sets
- **Usage rules:** Hardcoding colors is forbidden (must get from theme context), hardcoding sizes is forbidden (must get from tokens)
