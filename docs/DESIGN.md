# Design System — WerewolfGameJudge

## Product Context

- **What this is:** Multigame face-to-face judge app; Werewolf is the primary UI reference, alongside FibKing, Pictionary and Undercover
- **Who it's for:** Face-to-face tabletop players (Host + remote players)
- **Platform:** iOS / Android / Web (React Native + Expo)
- **Theme count:** Currently 1 theme implemented (Moonlight / light); multi-theme is planned (design has 8 themes: 4 light + 4 dark)

## Aesthetic Direction

- **Cross-game baseline:** Preserve Werewolf's established config controls, compact room hierarchy and interaction patterns. Other games align with it; do not redesign Werewolf to accommodate a new shared abstraction.
- **Integration contract:** [room-shell-contract.md](room-shell-contract.md) owns the config/guide/room component map and acceptance checklist. This includes all game-owned panels and overlay states, not only page frames.
- **Authority:** Current theme tokens and shared component implementations define values. Tables below are a reference, not permission to duplicate numeric constants in new games.

- **Direction:** iOS native feel — clear hierarchy, token-driven, restrained decoration
- **Mood:** Immersive tabletop atmosphere. Light themes are clean and elegant; dark themes each have personality (Eclipse = mysterious, Blood Moon = tense, Forest = secretive)
- **Reference:** Apple HIG spacing/typography, three-layer token architecture (Primitive → Semantic → Component)

## Typography

- **Font:** System default (SF Pro / Roboto / sans-serif)
- **Scale (viewport-independent logical sizes, pixel-aligned):**
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

- **Base unit:** Logical dimensions aligned with `PixelRatio.roundToNearestPixel`; `scale()` does not resize spacing with viewport width
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

- **Content widths:** `GameScreenContent` and `GameScreenFooter` currently cap at 720; the shared catalog layout caps at 1040. Room workspaces own their responsive constraints. Reuse those owners rather than treating one width as universal.
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
- **Theme colors:** `src/theme/colors.ts`, exported through `src/theme/index.ts`; inspect the active implementation rather than assuming a theme-context hook exists
- **Usage rules:** Use exported colors and semantic size tokens; do not copy this document's numeric values into game components
- **Contract maintenance:** Changes to shared controls or room surfaces update [room-shell-contract.md](room-shell-contract.md), their focused tests and applicable agent source rules together. Generated adapters are rebuilt with `pnpm run sync:agents`.
