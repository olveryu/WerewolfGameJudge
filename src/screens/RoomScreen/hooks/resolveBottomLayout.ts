/**
 * resolveBottomLayout — Pure function that resolves a BottomLayout from game state.
 *
 * Matches LAYOUT_RULES against current context, materializes ButtonSlots
 * into ButtonConfigs by merging static button definitions and schema-driven
 * buttons (from buildBottomAction).
 *
 * No hooks, no side effects.
 */

import type { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import type { BottomButton } from './bottomActionBuilder';
import {
  type BottomLayout,
  type ButtonConfig,
  type ButtonSlot,
  EMPTY_LAYOUT,
  LAYOUT_RULES,
  type LayoutContext,
  STATIC_BUTTONS,
  type StaticButtonId,
} from './bottomLayoutConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Schema button tier classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keys that represent "skip / empty vote" semantics — the user's primary
 * action is tapping a seat, so these buttons are secondary alternatives.
 */
const SECONDARY_KEYS = new Set(['skip', 'wolfEmpty']);

/**
 * Classify a schema button into primary or secondary tier.
 *
 * Rules:
 * - Single button with a skip/empty key → secondary (main action = tap seat)
 * - Single button with a confirm key → primary
 * - Multiple buttons → first is primary, rest are secondary
 * - Hint override (single button) → primary
 */
function classifySchemaButtons(buttons: readonly BottomButton[]): {
  primary: readonly BottomButton[];
  secondary: readonly BottomButton[];
} {
  if (buttons.length === 0) return { primary: [], secondary: [] };

  if (buttons.length === 1) {
    const btn = buttons[0]!;
    if (SECONDARY_KEYS.has(btn.key)) {
      return { primary: [], secondary: [btn] };
    }
    return { primary: [btn], secondary: [] };
  }

  // Multiple buttons: first = primary, rest = secondary
  return {
    primary: [buttons[0]!],
    secondary: buttons.slice(1),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Static button materialization
// ─────────────────────────────────────────────────────────────────────────────

function materializeStaticButton(
  id: StaticButtonId,
  tier: 'primary' | 'secondary' | 'ghost',
  ctx: LayoutContext,
): ButtonConfig {
  const def = STATIC_BUTTONS[id];

  const config: ButtonConfig = {
    key: id,
    label: def.label,
    variant: tier,
    size: tier === 'primary' ? 'lg' : 'md',
    action: id,
    testID: def.testID,
  };

  // Tier-specific overrides
  if (tier === 'ghost' && def.ghostTextColor) {
    config.textColor = def.ghostTextColor;
  }
  if (tier === 'primary' && def.primaryButtonColor) {
    config.buttonColor = def.primaryButtonColor;
  }

  // Contextual overrides per button
  switch (id) {
    case 'waitForHost':
    case 'audioWaiting':
      config.disabled = true;
      config.fireWhenDisabled = true;
      break;

    case 'prepareToFlip':
    case 'startGame':
      config.disabled = ctx.isHostActionSubmitting;
      config.fireWhenDisabled = true;
      break;

    case 'restart':
      config.disabled = ctx.isHostActionSubmitting;
      config.fireWhenDisabled = true;
      break;
  }

  return config;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot materialization
// ─────────────────────────────────────────────────────────────────────────────

function materializeSlots(
  slots: readonly ButtonSlot[],
  tier: 'primary' | 'secondary' | 'ghost',
  ctx: LayoutContext,
  schemaClassified: { primary: readonly BottomButton[]; secondary: readonly BottomButton[] },
): ButtonConfig[] {
  const result: ButtonConfig[] = [];

  for (const slot of slots) {
    if (slot.source === 'static') {
      result.push(materializeStaticButton(slot.button, tier, ctx));
    } else {
      // Schema slot — pick from classified primary or secondary
      const source =
        slot.tier === 'primary' ? schemaClassified.primary : schemaClassified.secondary;
      for (const btn of source) {
        result.push({
          key: btn.key,
          label: btn.label,
          // Schema buttons in primary slot → primary variant; in secondary slot → secondary variant
          variant: tier === 'ghost' ? 'ghost' : tier,
          size: tier === 'primary' ? 'lg' : 'md',
          intent: btn.intent,
        });
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule matching
// ─────────────────────────────────────────────────────────────────────────────

type UserRole = 'host' | 'player' | 'spectator';

function getUserRole(ctx: LayoutContext): UserRole {
  if (ctx.isHost) return 'host';
  if (ctx.effectiveSeat !== null) return 'player';
  return 'spectator';
}

function matchStatus(ruleStatus: GameStatus | readonly GameStatus[], actual: GameStatus): boolean {
  if (Array.isArray(ruleStatus)) {
    return (ruleStatus as readonly GameStatus[]).includes(actual);
  }
  return ruleStatus === actual;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the three-tier button layout for the current game state.
 *
 * @param ctx        Layout context (game status, user role, flags)
 * @param schemaButtons  Schema-driven buttons from buildBottomAction()
 */
export function resolveBottomLayout(
  ctx: LayoutContext,
  schemaButtons: readonly BottomButton[] = [],
): BottomLayout {
  const role = getUserRole(ctx);

  // Find first matching rule
  const rule = LAYOUT_RULES.find(
    (r) =>
      matchStatus(r.match.status, ctx.roomStatus) &&
      r.match.role === role &&
      (!r.match.when || r.match.when(ctx)),
  );

  if (!rule) return EMPTY_LAYOUT;

  // Classify schema buttons into primary/secondary
  const schemaClassified = classifySchemaButtons(schemaButtons);

  // Materialize all three tiers
  const primary = materializeSlots(rule.layout.primary, 'primary', ctx, schemaClassified);
  const secondary = materializeSlots(rule.layout.secondary, 'secondary', ctx, schemaClassified);
  const ghost = materializeSlots(rule.layout.ghost, 'ghost', ctx, schemaClassified);

  return { primary, secondary, ghost };
}
