---
name: WerewolfGameJudge
description: A multi-game judge for people playing together.
colors:
  primary: '#285F86'
  primary-light: '#3B6D91'
  primary-dark: '#1A405D'
  background: '#EDF2F7'
  surface: '#FFFFFF'
  surface-hover: '#E0E9F1'
  text: '#1A3149'
  text-secondary: '#526779'
  text-muted: '#5B6E80'
  border: '#C4D2DE'
  border-light: '#DEE7EE'
  success: '#1A9A4A'
  warning: '#B87D08'
  error: '#D13438'
  info: '#2563EB'
  wolf: '#C82828'
  villager: '#1A9A4A'
  god: '#7B3FBF'
  third: '#B87D08'
typography:
  heading:
    fontFamily: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '24px'
    lineHeight: '34px'
  body:
    fontFamily: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '16px'
    lineHeight: '24px'
  secondary:
    fontFamily: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '14px'
    lineHeight: '20px'
rounded:
  small: '8px'
  medium: '12px'
  large: '16px'
  xlarge: '16px'
  full: '9999px'
spacing:
  micro: '2px'
  tight: '4px'
  small: '8px'
  medium: '16px'
  screen-h: '20px'
  large: '24px'
  xlarge: '32px'
  xxlarge: '48px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.small}'
    height: '44px'
    padding: '0 16px'
---

# Design System: WerewolfGameJudge

## Overview

The web client uses a restrained, directory-like interface: cool blue-grey surroundings, clear
grouping and a single blue for primary actions. People should find room actions and game state
quickly while playing together. Preserve game-specific imagery and meaningful faction colors.

The active palette is defined by `packages/web/src/theme/colors.ts`; sizes, typography, radii
and shadows live in `packages/web/src/theme/tokens.css`. These implementation files are the
source of truth.

## Colors

Primary blue identifies primary actions and selections. White surfaces sit on the blue-grey
background; navy and blue-grey text establish hierarchy. Success, warning, error, info and
faction colors retain their semantic meanings rather than serving as decoration.

Text and primary actions on the shared background and surface must maintain at least 4.5:1
contrast. The focused palette is verified in `packages/web/src/theme/colors.test.ts`.

## Typography

The interface uses the system sans-serif stack with Chinese platform fallbacks. Headings,
body text and secondary text follow the fixed token scale; avoid copying sizes into components.

## Layout

Use the shared spacing tokens. The home task area becomes two columns at 720px; game screens,
catalog pages and room workspaces retain their own existing width owners and responsive rules.
Respect safe-area insets and maintain the existing 44px minimum touch target.

## Elevation & Depth

Use restrained, layered shadows in `tokens.css` to give information panels, interactive cards,
and buttons distinct physical depth. Dialogs sit above the underlying content without heavy
framing, and the blue-grey background stays clean and nearly untextured.

### Tactile redesign

- **Confirmed direction:** a real tabletop-game feel, like handling cards and game pieces,
  textured but not overly cartoonish, for cards and buttons throughout the app including the
  admin console. The user approved the recommended component direction for implementation.
- **Material finish:** clean and refined, like a new tabletop game, with subtle material
  character rather than obvious wear or aging.
- **Paper-surface follow-up — confirmed:** keep the existing blue-grey and clean visual style.
  Paper character should be clear but restrained, with visible edges and gentle depth and fine
  texture that does not interfere with drawing or reading. This direction includes large drawing
  surfaces, small cards, headers, and bottom hand cards. The user requested direct implementation
  without a new mock; exact visual balance remains subject to implementation review.
- **Drawing-surface follow-up — confirmed:** make the canvas look like a flat sheet of drawing
  paper on the tabletop, with a fine paper edge, soft shadow, nearly white interior, and barely
  visible texture. Do not add lines or decorations over the drawing area.
- **Hand-card follow-up — confirmed:** use slightly thicker paper cards from the same material
  family as the canvas, with clearer shadows to communicate interactivity. Preserve the existing
  fan layout and colors; do not add a heavy button-like base.
- **Header follow-up — confirmed:** present the header as a flat paper information strip, with a
  lighter edge and shadow than hand cards. The whole header must not look clickable; actual
  controls inside it remain individually identifiable.
- **Information-card follow-up — confirmed:** use thinner paper pieces with lighter edges and
  shadows than interactive hand cards. Actual buttons inside remain distinct without a heavy,
  raised button treatment.
- **Buttons follow-up — confirmed:** apply the same paper material to actual action buttons
  throughout the app, not only to hand cards. Preserve existing button roles, colors, and
  feedback; do not make titles, status text, or the original room seats look like buttons.
- **Room status slips — confirmed:** Werewolf, Avalon and Secret Hitler use compact paper
  status strips. Keep long instructions intact and allow them to wrap; voting strips show
  submitted counts and pending seat numbers without revealing ballots. Once everyone submits,
  show the pending reveal and any available countdown instead of an empty seat list.
- **Secret Hitler match record:** reuse the Avalon record's paper cards and navigation styling.
  Keep government ballots, policies and presidential actions distinct; do not infer a combined
  chronology or reveal individual secret votes.
- **Role-preview labels — confirmed:** retain the compact faction-colored label shape for
  clickable role previews, with a fine paper texture and shallow edge and shadow. They should
  remain visually thinner than the hand cards, not become chunky buttons.
- **Paper-surface implementation:** the shared paper texture and layered edge shadows cover
  headers, room information surfaces, drawing canvases, hand cards and action buttons, with the
  same material applied to game, role and navigation cards. The drawing texture is visual only
  and is not included in exported artwork.
- **Surface roles:** `tokens.css` exposes separate texture and shadow tokens for panels, cards,
  headers, buttons, hand cards and drawing surfaces. Use the role that matches the surface's
  purpose, not whether its markup happens to be a button. Existing tabletop shadow tokens map
  to the corresponding surface shadows; pressed, disabled and selected states remain owned by
  components. Theme overrides must be applied at the document root so dependent tokens resolve
  together. This provides a foundation, not a theme switcher: colors used directly in TypeScript,
  special artwork and component-specific state styles also need consideration for a future theme.
  `applyColorTokens` writes colors as inline root properties, so changing a future palette must
  update that color publisher as well as CSS surface tokens; a stylesheet override alone is not
  sufficient. Textures and shadows are decorative, not the sole indication of an action or state.
- **Consistency:** keep the tactile styling similarly noticeable across the site, rather than
  making the home page and admin console more restrained than game screens.
- **Visual intensity:** noticeable at first glance but not exaggerated; cards and buttons should
  have discernible depth without overpowering the content.
- **Surface roles:** informational panels and interactive cards should feel physical, but their
  depth should differ to help distinguish information from actions. The latest direction uses a
  light tactile paperboard edge and shadow consistently on information cards and headers, while
  interactive cards remain more prominent.
- **Action affordance:** distinguish interactive cards primarily through depth: they should look
  more prominent than information panels.
- **Nested surfaces:** treat the outside as a board and interactive cards as separate pieces on
  it; avoid a thick frame around every nested grouping.
- **Buttons:** ordinary actions use a light tactile construction: a fine edge, short lower edge,
  soft shadow, and shallow press feedback. Keep primary/destructive meaning through semantic
  colors and sizing, not a heavier button shape. Game hand and selection cards remain visually
  cards. Titles with hidden shortcuts and inline information or progress that opens details should
  retain their title, label, or track appearance rather than look like raised standalone buttons.
- **Other controls:** inputs, switches, tabs, progress indicators, tables, and similar UI also
  follow the tactile language, with treatments suited to their purpose rather than making every
  control a raised card.
- **Room seats:** use the original main-branch seat appearance, including the dashed empty seat
  and plain plus sign, rather than the tactile seat mock. Preserve seat interactions and states.
- **Dense tables:** give the table as a whole a physical panel treatment while keeping its rows
  compact, especially on mobile.
- **Dialogs and sheets:** present them as physical panels above the underlying content, with
  clear but restrained separation.
- **Button feedback:** a short, clear press-down and return without noticeable bouncing. The
  latest all-buttons soft-tactile direction supersedes the earlier heavier “桌游按键” edge.
- **Palette:** retain the existing primary and game faction colors, allow a small number of
  complementary material colors, and show palette alternatives in the component mock.
- **Background:** use the simple blue-grey background as the main direction, with tabletop or
  textured alternatives shown for comparison. Create the tabletop-world feeling primarily
  through the material of buttons, information surfaces, and cards and their arrangement, not a
  decorative background scene.
  After reviewing the mock, the user chose the first, recommended blue-grey tabletop over the
  textured and warm alternatives, keeping it clean and almost untextured. Use the same blue-grey
  background across the site, including game rooms.
- **Layout:** mockups may adjust layout and spacing for visual quality and readability, while
  retaining existing functionality, content, and game flows.
- **Existing art:** retain role illustrations and game art; adapt their framing and layout
  rather than replacing them.
- **Game identity:** use a shared card structure and tactile language across games, retaining
  their illustrations, faction colors, and small game-specific details.
- **Card decoration:** restrained, relying mainly on depth, edges, and layout, with limited
  meaningful details rather than elaborate ornament. Role/identity cards may have a more
  complete, refined collectible frame; ordinary panels and buttons remain restrained.
- **Visual pitfalls to avoid:** childish cartoon styling, cheap-looking heavy black outlines and
  shadows, loud colors, dirty or worn textures, excessive flatness, overcrowding that harms
  reading or interaction, and inconsistent styling between pages.
- **References:** Hearthstone, Yu-Gi-Oh!, and Magic: The Gathering. Desired qualities include
  physical card depth, refined frames and collectible layouts, hand arrangement and selection,
  character art presentation, and an overall tabletop-world feeling.
- **Selected cards:** a selected card should look lifted out and carry a clear selection
  indicator; the momentary press is visually distinct from the persistent selected state.
- **Product rarity:** keep rarity information but subordinate its color treatment to the clean
  paperboard surface. Separate rarity from selection: the selected item gets a clear gold edge
  and marker rather than reusing its rarity color.
- **Unavailable controls:** keep content readable, reduce the tactile emphasis, and make the
  unavailable state or reason clear rather than relying only on fading or color.
- **Action hand:** preserve the selected fan arrangement, category colors, and game actions.
  Match the mock's simple card face with an inset highlight, short lower edge, and soft outer
  shadow; keep action names and states immediately readable.
- **Role/identity cards:** explore the appearance of the front and back only; do not explore
  flip animation or change the identity reveal interaction.
- **Screen priority:** design all pages, including admin, for mobile first; adapt them for
  desktop as well.
- **Design process:** present mockups so the user can see and compare the ideas before any
  product implementation: first compare component alternatives side by side, then combine the
  selected treatments into realistic page mockups. Include small samples of previously
  unselected directions; aim for two or three clearly different options per major component
  type, with more for special components. The user may revise earlier preferences after seeing
  them. The mock should be a standalone interactive web page rather than a change to the
  production UI. Its
  first version covers all major component types and their relevant states, not every existing
  component variant individually. Reuse existing art and page structure with fictional accounts,
  rooms, and admin data; do not connect to production data or execute real game actions. The user
  will review it through a local preview and communicate choices in chat; the mock does not need
  to save preferences or be deployed online. Provide a page directory and simulated navigation
  between major pages. Page mockups should be high fidelity, with realistic text, art, colors,
  frames, and common states, rather than wireframes.
- **Mock component choices:** after reviewing the gallery, the user chose blue-grey tabletop,
  soft-tactile buttons and information surfaces, clean tactile interactive cards,
  refined role-card frames, fan-shaped action cards, clean recessed fields,
  tactile dialog panels, and clean table panels. The latest soft-tactile direction supersedes the
  earlier heavier key and information-panel edges. Unfinished page mockups remain examples, not
  specifications for game behavior.
- **Page mock coverage:** every concrete page and every game should have its own mock, including
  home, rooms, admin, configuration and board selection, dialogs and sheets, role/identity
  cards, and game-action cards. Each game room mock should cover the major states that change
  card or button appearance, without simulating complete game rules. Include user-facing error
  pages; exclude the developer-only performance benchmark.
- **Delivery:** present the complete set of page mockups together rather than delivering a
  small sample first. Compare alternatives in the component gallery, while the page mockups
  initially use one recommended style based on the current preference. Include current-main
  versus redesigned comparisons for key pages such as home, game rooms, and admin. Iterate on
  the mock after feedback. Component options may be mixed, then checked for visual coherence in
  full-page mockups; the user has now explicitly approved starting production implementation.
- **Open:** screen-specific exceptions should be assessed against the approved component
  treatments and existing game behavior.
- **Implementation status:** the user approved implementation across the site and selected all
  mock page/component directions. The mock covers the page directory, nine games and component
  alternatives, but some page content is simplified; preserve production content and behavior
  while matching its selected visual language. Shared, product, room, game, admin, and error-page
  styling now use the tactile language across cards, buttons, forms, tabs, dialogs, sheets,
  panels, and tables. Rarity remains subordinate to the clean paperboard surface, while selected
  cosmetics use a separate gold edge and marker. The latest direction replaces the earlier
  heavier button and information-panel depth with a consistent light tactile finish on all
  buttons, information cards, headers, dialogs, and sheets; game cards retain their distinct card
  depth. The mock gallery now marks these soft-tactile surface choices as recommended. Focused UI
  tests (48 tests), web typecheck/build, ESLint, Prettier, and production-preview inspection pass.
  A full web test run reported two `HomePage.test.tsx` failures (a timeout and a duplicate-title
  query) among 4,268 tests; the focused rerun passed.

## Shapes

Controls and surfaces use the shared radius scale. Full-radius shapes remain appropriate for small
badges and progress tracks.

Avatars are rounded squares at every size: `Avatar` alone sets their corners from
`AVATAR_CORNER_RATIO` in `packages/web/src/config/avatarShape.ts`, the scene draws avatar frames
along the same corner, and `applyAvatarShapeTokens` publishes the ratio as `--avatar-corner-ratio`.
A square box hugging an avatar (a tile, a seat, a mat, a placeholder standing where an avatar
would) is concentric with it through the shared `avatar-concentric` rule and its `--avatar-inset`;
no stylesheet repeats the ratio or gives such a box a fixed radius. The web avatar shape contract
test (`packages/web/src/__tests__/avatarShape.contract.test.ts`) pins the avatar and box rules
over every avatar site its census finds; the frame geometry tests
(`packages/web/src/scene/frames/__tests__/frameBox.test.ts`) pin the frames to the same corner.

## Components

- Reuse the shared `Button` variants for actions, `ScreenHeader` for screen navigation and the
  existing dialog and sheet primitives for overlays.
- Keep all shared `Button` and `IconButton` variants on the same soft-tactile depth; use semantic
  color and size to express action priority rather than switching back to a heavier key.
- The home page groups create, enter and recent-room actions before existing product links.
  Keep the room actions, game imagery, announcements and their interaction behavior intact.
- Configuration controls, room hierarchy and game-owned panels follow
  [room-shell-contract.md](room-shell-contract.md). Visual consistency includes loading, error,
  empty, disabled, selected and submitting states.
- Keyboard focus is visible through the global focus treatment; input focus retains its
  component-specific treatment.

## Do's and Don'ts

- Use the semantic color and size tokens instead of copying values into component styles. Stylelint
  enforces this (`pnpm run lint:css`); existing exceptions are recorded in
  `stylelint-suppressions.json` and may only shrink.
- Keep actions, state and text readable on phones and in the WeChat mini-program web-view.
- Do not replace meaningful game art or faction semantics with decorative styling.
- Do not reintroduce gradients or colored side stripes merely as decoration.
