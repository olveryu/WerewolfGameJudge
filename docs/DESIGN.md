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

The home page uses flat tonal surfaces. Shared shadows in `tokens.css` remain available for
dialogs and other components that need separation; do not combine decoration with redundant
elevation.

## Shapes

Controls and surfaces use the shared radius scale. Full-radius shapes remain appropriate for
avatars, small badges and progress tracks.

## Components

- Reuse the shared `Button` variants for actions, `ScreenHeader` for screen navigation and the
  existing dialog and sheet primitives for overlays.
- The home page groups create, enter and recent-room actions before existing product links.
  Keep the room actions, game imagery, announcements and their interaction behavior intact.
- Configuration controls, room hierarchy and game-owned panels follow
  [room-shell-contract.md](room-shell-contract.md). Visual consistency includes loading, error,
  empty, disabled, selected and submitting states.
- Keyboard focus is visible through the global focus treatment; input focus retains its
  component-specific treatment.

## Do's and Don'ts

- Use the semantic color and size tokens instead of copying values into component styles.
- Keep actions, state and text readable on phones and in the WeChat mini-program web-view.
- Do not replace meaningful game art or faction semantics with decorative styling.
- Do not reintroduce gradients or colored side stripes merely as decoration.
