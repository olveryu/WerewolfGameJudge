/**
 * nightPrompt — the night step's dialog copy, rendered from the schema
 * templates and the engine's actor hint.
 *
 * Every string the night dialog, the bottom message and the seat confirm
 * show comes from `schema.ui` (authored once in the role specs) or from
 * `state.ui.currentActorHint` (the engine's per-night override: a
 * nightmare block, a disabled wolf kill, a unanimity rule). A missing
 * template is a spec bug and throws; nothing falls back to generic copy.
 */

import type {
  ActionSchema,
  RoleId,
  WerewolfNightView,
} from '@game-judge/game-engine/games/werewolf/public';
import { getRoleDisplayName } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import type { NightPrompt } from './NightInteractionModel';

type ActorHint = NonNullable<WerewolfNightView['actorHint']>;

const GENERIC_NIGHT_TITLE = '夜间行动';

/** `{role}行动`, the title of every role's step dialog. */
export function nightStepTitle(currentActionRole: RoleId | null): string {
  return currentActionRole === null
    ? GENERIC_NIGHT_TITLE
    : `${getRoleDisplayName(currentActionRole)}行动`;
}

/** A required schema.ui field; absence is a spec bug. */
export function requireSchemaText(
  schema: ActionSchema,
  field: string,
  value: string | undefined,
): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`[FAIL-FAST] Missing schema.ui.${field} for ${schema.id}`);
  }
  return value;
}

/**
 * The step prompt: the hint's full override when it carries one, else
 * the schema prompt with the hint's warning appended.
 */
export function renderStepPrompt(
  schema: ActionSchema,
  currentActionRole: RoleId | null,
  actorHint: ActorHint | null,
): NightPrompt {
  if (actorHint?.promptOverride !== undefined) {
    const override = actorHint.promptOverride;
    if (override.title === undefined || override.text === undefined) {
      throw new Error(`[FAIL-FAST] Actor hint ${actorHint.kind} override is missing title or text`);
    }
    return { title: override.title, text: override.text };
  }
  const prompt = requireSchemaText(schema, 'prompt', schema.ui?.prompt);
  return {
    title: nightStepTitle(currentActionRole),
    text: actorHint === null ? prompt : `${prompt}\n\n⚠️ ${actorHint.message}`,
  };
}

/** The witch's information dialog: killed seat + antidote, cannot save, or an empty kill. */
export function renderWitchPrompt(
  schema: Extract<ActionSchema, { kind: 'compound' }>,
  witchContext: { readonly killedSeat: number; readonly canSave: boolean },
): NightPrompt {
  const saveStep = schema.steps.find((step) => step.key === 'save');
  const poisonStep = schema.steps.find((step) => step.key === 'poison');
  if (saveStep === undefined || poisonStep === undefined) {
    throw new Error(`[FAIL-FAST] ${schema.id} must declare save and poison steps`);
  }
  const title = requireSchemaText(schema, 'prompt', schema.ui?.prompt);
  if (witchContext.killedSeat >= 0) {
    if (witchContext.canSave) {
      const template = requireSchemaText(
        schema,
        'steps.save.promptTemplate',
        saveStep.ui?.promptTemplate,
      );
      return { title, text: template.replace('{seat}', formatSeat(witchContext.killedSeat)) };
    }
    return {
      title,
      text: requireSchemaText(schema, 'steps.save.cannotSavePrompt', saveStep.ui?.cannotSavePrompt),
    };
  }
  return {
    title: requireSchemaText(schema, 'emptyKillTitle', schema.ui?.emptyKillTitle),
    text: requireSchemaText(schema, 'steps.poison.prompt', poisonStep.ui?.prompt),
  };
}

/** The bottom-bar message during a night step: prompt + optional status / warning lines. */
export function renderNightMessage(parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => part !== null && part.length > 0).join('\n');
}
