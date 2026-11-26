/**
 * Art layer: paths whose style values are the artwork itself (Pixi scene, reveal effects,
 * generated avatars, name styles, the capsule machine, boot art, night art, the scene bench).
 * Their literals carry no reuse value as tokens, so the value rules (S1/S2/S4 and the inline-style
 * value checks) do not apply to them. Mechanism rules (escapes, style elements, computed keys)
 * still apply.
 *
 * This list is the single registration point (plan D7): `stylelint.config.mjs` reads it (and so
 * will the inline-style value rules when they land), and `scripts/ui-lint/registry.test.mjs` pins
 * its exact contents, so adding an art path changes this file and that test in the same diff.
 *
 * Paths are globs relative to the repository root.
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

/** The token source: the only stylesheet allowed to hold raw style values. */
export const TOKEN_STYLESHEET = 'packages/web/src/theme/tokens.css';
