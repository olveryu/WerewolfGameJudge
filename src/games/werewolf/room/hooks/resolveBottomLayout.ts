/**
 * resolveBottomLayout — Pure function that resolves a BottomLayout from game state.
 *
 * Matches LAYOUT_RULES against current context, materializes ButtonSlots
 * into ButtonConfigs by merging static button definitions and schema-driven
 * buttons (from buildBottomAction).
 *
 * No hooks, no side effects.
 */

import type { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import { resolveRoomViewerAudience } from '@/features/room/model/RoomViewer';

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
const SECONDARY_KEYS = new Set(['skip', 'wolfEmpty', 'wolfCancel']);

/**
 * Classify a schema button into primary or secondary tier.
 *
 * Rules:
 * - Single button with a skip/empty key → secondary (main action = tap seat)
 * - Single button with a confirm key → primary
 * - Confirmation commands are primary; alternatives retain secondary emphasis regardless of order.
 */
function classifySchemaButtons(buttons: readonly BottomButton[]): {
  primary: readonly BottomButton[];
  secondary: readonly BottomButton[];
} {
  return {
    primary: buttons.filter((button) => !SECONDARY_KEYS.has(button.key)),
    secondary: buttons.filter((button) => SECONDARY_KEYS.has(button.key)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Static button materialization
// ─────────────────────────────────────────────────────────────────────────────

function materializeStaticButton(
  id: StaticButtonId,
  tier: 'primary' | 'secondary' | 'ghost',
): ButtonConfig {
  const def = STATIC_BUTTONS[id];
  const base = {
    key: id,
    label: def.label,
    audience: def.audience,
    icon: def.icon,
    variant: tier,
    size: 'md',
    testID: def.testID,
  } as const;

  return {
    ...base,
    isEnabled: true,
    behavior: { kind: 'static', action: id },
  };
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
      // Invariant: viewRole requires a seat (you need a role to view)
      if (slot.button === 'viewRole' && ctx.effectiveSeat === null) continue;
      result.push(materializeStaticButton(slot.button, tier));
    } else {
      // Schema slot — pick from classified primary or secondary
      const source =
        slot.tier === 'primary' ? schemaClassified.primary : schemaClassified.secondary;
      for (const btn of source) {
        result.push({
          key: btn.key,
          label: btn.label,
          // Schema buttons are the actioner's own night commands: seat actions.
          audience: 'participant',
          // Schema buttons in primary slot → primary variant; in secondary slot → secondary variant
          variant: tier === 'ghost' ? 'ghost' : tier,
          size: 'md',
          isEnabled: true,
          behavior: { kind: 'intent', intent: btn.intent },
        });
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule matching
// ─────────────────────────────────────────────────────────────────────────────

function isGameStatusList(
  ruleStatus: GameStatus | readonly GameStatus[],
): ruleStatus is readonly GameStatus[] {
  return Array.isArray(ruleStatus);
}

function matchStatus(ruleStatus: GameStatus | readonly GameStatus[], actual: GameStatus): boolean {
  if (isGameStatusList(ruleStatus)) {
    return ruleStatus.includes(actual);
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
  const role = resolveRoomViewerAudience({ isHost: ctx.isHost, seat: ctx.effectiveSeat });

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
