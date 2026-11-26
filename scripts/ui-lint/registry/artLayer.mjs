/**
 * Art layer: paths whose style values are the artwork itself (Pixi scene, reveal effects,
 * generated avatars, name styles, the capsule machine, boot art, night art, the scene bench).
 * Their literals carry no reuse value as tokens, so the value rules (S1/S2/S4 and the inline-style
 * value checks) do not apply to them. Mechanism rules (escapes, style elements, computed keys)
 * still apply.
 *
 * This file is the single registration point (plan D7): `stylelint.config.mjs` reads it (and so
 * will the inline-style value rules when they land), and `scripts/ui-lint/registry.test.mjs` pins
 * its exact contents, so adding art changes this file and that test in the same diff.
 *
 * - `ART_LAYER_PATHS`: the art areas (globs relative to the repository root).
 * - `ART_LAYER_STYLESHEETS`: the stylesheets exempt from the Stylelint value rules, file by file.
 *   An area is not exempt as a whole: a new stylesheet under `scene/` is ordinary UI CSS until it
 *   is registered here, so writing plain UI styles into an art directory buys nothing.
 */
export const ART_LAYER_PATHS = Object.freeze([
  'packages/web/src/scene/**',
  'packages/web/src/features/room/components/RoleRevealEffects/**',
  'packages/web/src/components/avatar/GeneratedAvatar.tsx',
  'packages/web/src/components/nameStyles/**',
  'packages/web/src/features/gacha/machine/**',
  'packages/web/src/boot/bootSplash.css',
  'packages/web/src/theme/nightArt.css',
  'packages/web/src/routes/bench/**',
]);

export const ART_LAYER_STYLESHEETS = Object.freeze([
  'packages/web/src/scene/scene.css',
  'packages/web/src/components/nameStyles/nameStyles.css',
  'packages/web/src/features/gacha/machine/CapsuleMachine.css',
  'packages/web/src/boot/bootSplash.css',
  'packages/web/src/theme/nightArt.css',
  'packages/web/src/routes/bench/SceneBench.css',
]);

/** The token source: the only stylesheet allowed to hold raw style values. */
export const TOKEN_STYLESHEET = 'packages/web/src/theme/tokens.css';
