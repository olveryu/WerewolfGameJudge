/**
 * Stylelint for the web client's stylesheets (UI drift lock plan §3, community tools only).
 *
 * Design values come from the theme: colors, corners, z-index, spacing, type and shadows are
 * written as `var(--token)` (`scale-unlimited/declaration-strict-value`), and every custom
 * property read is one some stylesheet declares or the theme publishes at start-up
 * (`csstools/value-no-unknown-custom-properties`). Existing problems are recorded in
 * `stylelint-suppressions.json` (Stylelint bulk suppressions); after fixing some, rerun
 * `pnpm run lint:css:suppress` to drop their entries.
 */

import { globSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root: globs and imports resolve from here, whatever the working directory. */
const ROOT = fileURLToPath(new URL('.', import.meta.url));

import { createJiti } from 'jiti';

/** The theme's token sheet: the one place raw design values are written. */
const TOKEN_SHEET = 'packages/web/src/theme/tokens.css';

/**
 * Custom properties the app publishes from TypeScript, read from their sources: on the document
 * root at start-up (`--color-*`, `--report-*`, `--avatar-corner-ratio`) and on the gacha pages'
 * roots (`--gacha-*`, `GACHA_PALETTE_VARS`).
 */
async function publishedProperties() {
  const jiti = createJiti(import.meta.url, {
    // The web client's `@/` import alias (packages/web/tsconfig.json `paths`).
    alias: { '@/': join(ROOT, 'packages/web/src/') },
  });
  const { applyColorTokens } = await jiti.import('./packages/web/src/theme/colors.ts');
  const { applyAvatarShapeTokens } = await jiti.import('./packages/web/src/config/avatarShape.ts');
  const customProperties = {};
  const root = { style: { setProperty: (name, value) => (customProperties[name] = value) } };
  applyColorTokens(root);
  applyAvatarShapeTokens(root);
  const { GACHA_PALETTE_VARS } = await jiti.import(
    './packages/web/src/routes/gacha/gachaPalette.ts',
  );
  Object.assign(customProperties, GACHA_PALETTE_VARS);
  return { customProperties };
}

/** Art sheets draw illustrations, not UI; their selectors stay under their own prefix. */
const ART_SHEETS = {
  'packages/web/src/boot/bootSplash.css': 'boot',
  'packages/web/src/components/nameStyles/nameStyles.css': 'name-style',
  'packages/web/src/features/gacha/machine/CapsuleMachine.css': 'capsule-machine',
  'packages/web/src/routes/bench/SceneBench.css': 'bench',
  'packages/web/src/scene/scene.css': 'scene-canvas',
  'packages/web/src/theme/nightArt.css': 'night-art',
};

/**
 * One avatar shape (config/avatarShape.ts, plan §3 P9). `Avatar` sets its own corners; the
 * elements hosting it and the stages it enters through cut nothing; a square box around it takes
 * its corners from the shared `avatar-concentric` rule alone. Any class named with an `avatar`
 * segment (`seat-avatar`, `lobby-player-avatar`) is held to this by its name; a host or box named
 * otherwise is listed below. The rendered shapes are pinned by the visual gate's avatar gallery.
 */
const AVATAR_NAMED = '[\\w-]*avatar[\\w-]*';
const AVATAR_HOSTS_AND_STAGES = [
  'account-entry',
  'appearance-avatar-preview',
  'appearance-cell-thumb',
  'appearance-hero-avatar',
  'login-strip-portrait',
  'resident-tile-avatar',
  'resident-tile-ghosts',
  'resident-tile-stage',
  'reward-preview',
  'seat-avatar',
  'seat-avatar-ghosts',
  'seat-avatar-stage',
  'settings-teaser-item',
  'toolbox-room-avatar',
  'ui-gallery-avatars',
  'undercover-reveal-identity',
  'unlocks-thumb',
];
const AVATAR_CONCENTRIC_BOXES = [
  'admin-avatar',
  'appearance-cell',
  'appearance-cell-upload',
  'avatar-concentric',
  'profile-avatar',
  'profile-equip-preview',
  'resident-tile',
  'seat-status-emphasis',
  'seat-tile-button',
  'settings-avatar',
  'settings-teaser-lock',
  'unlocks-cell-frame',
];
const AVATAR_SHEET = 'packages/web/src/components/avatar/Avatar.css';
const AVATAR_CONCENTRIC_SHEET = 'packages/web/src/components/avatar/avatarConcentric.css';
/** Only Avatar.css (the avatar's corners) and avatarConcentric.css (boxes around it) read the ratio. */
const AVATAR_RATIO_READ = '/--avatar-corner-ratio/';
/**
 * The raw radius scale (`--radius-8`, `--radius-12` …) is read only by tokens.css: a component
 * names its corner by purpose (`--radius-control`, `--radius-card` …, plan §4 P3).
 */
const RAW_RADIUS_READ = '/--radius-\\d/';
const VALUE_READ_MESSAGE =
  'Only Avatar.css and avatarConcentric.css read --avatar-corner-ratio; only tokens.css reads the raw --radius-<n> scale (use a purpose token such as --radius-control).';
const SHAPING = ['/radius$/', 'corner-shape', 'clip-path', '/^mask/', 'all'];
/**
 * A keyframe block (`from`, `to`, `50%`): an animation outranks every normal declaration, inline
 * styles included, so a keyframe that shapes would reshape whatever runs it. No animation shapes.
 */
const KEYFRAME_SELECTOR = '/^\\s*(from|to|[\\d.]+%)(\\s*,\\s*(from|to|[\\d.]+%))*\\s*$/';

/**
 * Shared components own their look (plan §4 P4): each class below is styled only by the sheet
 * that ships it. Another sheet places the component from its own wrapper element and may only
 * exclude these classes inside `:not()`.
 */
const SHARED_COMPONENT_CLASSES = {
  'packages/web/src/components/BottomSheet.css': ['bottom-sheet[\\w-]*'],
  'packages/web/src/components/Button.css': ['button', 'icon-button'],
  'packages/web/src/components/CenterDialog.css': ['center-dialog[\\w-]*'],
  'packages/web/src/components/nameStyles/nameStyles.css': ['name-style'],
  'packages/web/src/components/ChoiceCard.css': [
    'choice-card',
    'choice-check',
    'choice-image',
    'choice-label',
    'choice-row',
  ],
  'packages/web/src/components/FactionChip.css': ['faction-chip[\\w-]*'],
  'packages/web/src/components/GameGuide.css': ['game-guide[\\w-]*'],
  'packages/web/src/components/GameSettings.css': ['game-settings[\\w-]*'],
  'packages/web/src/components/GameStatsPanel.css': ['game-stats[\\w-]*'],
  'packages/web/src/components/HeaderSurface.css': ['page-header-surface'],
  'packages/web/src/components/IndeterminateProgressBar.css': ['indeterminate-progress[\\w-]*'],
  'packages/web/src/components/LoadingScreen.css': ['loading-screen[\\w-]*'],
  'packages/web/src/components/NumPad.css': ['numpad[\\w-]*'],
  'packages/web/src/components/PaperboardPanel.css': ['paperboard-panel'],
  'packages/web/src/components/ScreenHeader.css': ['screen-header[\\w-]*'],
  'packages/web/src/components/SeatDot.css': ['seat-dot[\\w-]*'],
  'packages/web/src/components/Spinner.css': ['spinner'],
  'packages/web/src/components/Switch.css': ['switch'],
  'packages/web/src/features/room/components/RoomStagePanel.css': ['room-stage-panel[\\w-]*'],
  'packages/web/src/features/room/components/RoomTaskFrame.css': [
    'room-task-frame[\\w-]*',
    'room-task-viewport[\\w-]*',
  ],
};
/** A class selector for any of `names`, outside `:not()`. */
const componentSelector = (names) => `/(?<!:not\\([^)]*)\\.(${names.join('|')})(?![\\w-])/`;
const SHARED_COMPONENT_MESSAGE =
  'Shared components are styled only by their own sheet: pass a variant, size or tone, and place the component from a wrapper element.';
/**
 * The `button` element outside `:not()`: shared `<Button>`/`<IconButton>` render one, so an element selector
 * restyles them as surely as `.button` does. A native button is styled by its own class (`button.home-card`).
 */
const BUTTON_ELEMENT_SELECTOR = '/(?<![\\w\'"=.#-]|:not\\([^)]*)button(?![\\w.-])/';
const sharedComponentRule = (ownedNames, { buttonReset = false } = {}) => [
  [
    componentSelector(
      Object.values(SHARED_COMPONENT_CLASSES)
        .flat()
        .filter((name) => !ownedNames.includes(name)),
    ),
    ...(ownedNames.includes('button') || buttonReset ? [] : [BUTTON_ELEMENT_SELECTOR]),
  ],
  { splitList: true, message: SHARED_COMPONENT_MESSAGE },
];
/**
 * A class selector for any of `names`, outside `:not()`. Excepted: pseudo-elements (a lining `::before` inherits
 * the corners) and `:not(.avatar-concentric)`, a card of the same class that holds no avatar.
 */
const classSelector = (names) =>
  `/(?<!:not\\()\\.(${names.join('|')})(?![\\w-])(?!:not\\(\\.avatar-concentric\\))(?![^,]*::)/`;

export default {
  ignoreFiles: ['**/dist/**'],
  plugins: ['stylelint-declaration-strict-value', 'stylelint-value-no-unknown-custom-properties'],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  rules: {
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'fill',
        'stroke',
        'background',
        '/radius$/',
        'z-index',
        '/^(margin|padding)/',
        '/gap$/',
        'font-size',
        'font-weight',
        'font-family',
        'line-height',
        'box-shadow',
      ],
      {
        // `border: 1px solid #ddd` is checked as its `border-color`.
        expandShorthand: true,
        ignoreValues: [
          '0',
          'auto',
          'none',
          'inherit',
          'initial',
          'unset',
          'currentColor',
          'transparent',
          'normal',
          // The plugin splits a comma-separated layer list (shadows, backgrounds) on spaces: a
          // token or a function followed by the comma is still a token or a function.
          '/^(var|[a-z-]+)\\(.*\\),$/',
          // Box-shadow's keyword.
          'inset',
          // CSS system colors, used under `forced-colors`.
          '/^(Canvas|CanvasText|LinkText|Highlight|HighlightText|ButtonFace|ButtonText|ButtonBorder|GrayText|Field|FieldText|Mark|MarkText|AccentColor|AccentColorText)$/',
        ],
      },
    ],
    // A sheet's own custom property holds a design value too: `--r: 13px` is a raw length. The
    // strict-value plugin skips custom properties, so their values may carry no unit at all —
    // lengths, angles and times come from tokens (`--r: var(--radius-control)`).
    'declaration-property-unit-allowed-list': [{ '/^--/': [] }],
    // Literal colors anywhere in a value (gradients, text-shadow, filters): colors come from tokens.
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': [
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
      'color',
    ],
    'csstools/value-no-unknown-custom-properties': [
      true,
      {
        importFrom: [
          ...globSync('packages/web/src/**/*.css', { cwd: ROOT }).map((file) => join(ROOT, file)),
          await publishedProperties(),
        ],
      },
    ],
    'at-rule-allowed-list': [
      'media',
      'keyframes',
      'supports',
      'container',
      'import',
      'starting-style',
      // Registers a custom property's type (`--avatar-inset` is a length).
      'property',
    ],
    'rule-selector-property-disallowed-list': [
      {
        [classSelector([AVATAR_NAMED])]: SHAPING,
        [classSelector(AVATAR_HOSTS_AND_STAGES)]: SHAPING,
        [classSelector(AVATAR_CONCENTRIC_BOXES)]: SHAPING,
        [KEYFRAME_SELECTOR]: SHAPING,
      },
      {
        message:
          'The avatar shape has one source: Avatar sets its corners, hosts cut nothing, boxes add the avatar-concentric class.',
      },
    ],
    'selector-disallowed-list': sharedComponentRule([]),
    'property-disallowed-list': [
      ['--avatar-corner-ratio'],
      { message: 'config/avatarShape.ts publishes the avatar corner ratio.' },
    ],
    'declaration-property-value-disallowed-list': [
      { '/.*/': [AVATAR_RATIO_READ, RAW_RADIUS_READ] },
      { message: VALUE_READ_MESSAGE },
    ],
  },
  overrides: [
    {
      files: [TOKEN_SHEET],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
        'declaration-property-unit-allowed-list': null,
        'color-no-hex': null,
        'color-named': null,
        'function-disallowed-list': null,
        'selector-disallowed-list': [['/^(?!:root$|\\.admin-console$)/'], { splitList: true }],
        'declaration-property-value-disallowed-list': [
          { '/.*/': [AVATAR_RATIO_READ] },
          { message: VALUE_READ_MESSAGE },
        ],
      },
    },
    {
      // The document reset: every button starts from the same box.
      files: ['packages/web/src/global.css'],
      rules: { 'selector-disallowed-list': sharedComponentRule([], { buttonReset: true }) },
    },
    ...Object.entries(SHARED_COMPONENT_CLASSES).map(([file, names]) => ({
      files: [file],
      rules: { 'selector-disallowed-list': sharedComponentRule(names) },
    })),
    ...Object.entries(ART_SHEETS).map(([file, prefix]) => ({
      files: [file],
      rules: { 'selector-class-pattern': `^${prefix}(-[a-z0-9]+)*$` },
    })),
    {
      // Avatar owns its shape: its corners and the fallback's mask are declared here alone.
      files: [AVATAR_SHEET, AVATAR_CONCENTRIC_SHEET],
      rules: {
        'rule-selector-property-disallowed-list': null,
        'declaration-property-value-disallowed-list': [
          { '/.*/': [RAW_RADIUS_READ] },
          { message: VALUE_READ_MESSAGE },
        ],
      },
    },
  ],
};
