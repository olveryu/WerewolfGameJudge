/**
 * resolveNightInteraction — (viewModel, draft, locks) → NightInteractionModel.
 *
 * The one place the ten night schema kinds are mapped to what the viewer
 * can do. Facts come from the engine's viewer-cropped projection
 * (actioner, schema, votes, pending reveal, witch context, bottom cards,
 * actor hint); the client contributes only its local draft (first swap
 * seat, multi-select set) and the two interaction locks (narration,
 * previous ack in flight). Nothing here reads raw GameState.
 *
 * Order of precedence: a lock blocks everything; an owed reveal ack is
 * shown to whoever owes it even when they are no longer the actioner;
 * otherwise a non-actioner (or no night step) is idle; then the schema
 * kind decides, with the actor hint able to restrict a step to skip-only
 * or empty-vote-only.
 */

import type {
  ActionSchema,
  RoleId,
  WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  GameStatus,
  getRoleDisplayName,
  isValidRoleId,
  Team,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import {
  AUDIO_PLAYBACK_LOCK_REASON,
  isAudioPlaybackLocked,
} from '@/features/room/model/audioPlaybackLock';

import type { NightDraft, NightInteractionModel, SwapPick } from './NightInteractionModel';
import {
  nightStepTitle,
  renderNightMessage,
  renderStepPrompt,
  renderWitchPrompt,
  requireSchemaText,
} from './nightPrompt';

const WOLF_WARNING_HINT_KINDS = new Set(['wolf_unanimity_required', 'wolf_tie_random']);

export const PENDING_ACK_LOCK_REASON = '正在确认上一步，请稍候';
const SKIP_CONFIRM_LABEL = '确认跳过';
const WOLF_EMPTY_VOTE_CONFIRM_LABEL = '确认放弃袭击';
const WOLF_VOTE_CHANGE_HINT = '（可点击改票或取消）';

export interface NightInteractionLocks {
  readonly isAudioPlaying: boolean;
  /** A durable command (the previous step's action or ack) has not been decided yet. */
  readonly hasPendingCommand: boolean;
}

export interface NightInteractionInput {
  readonly viewModel: WerewolfViewModel;
  readonly draft: NightDraft;
  /** swap: the second seat, set in the render that opens the confirm. */
  readonly swapSecondSeat: number | null;
  readonly locks: NightInteractionLocks;
  /** The room clock, for the wolf-vote countdown line. */
  readonly nowMs: number;
}

function selectableSeats(viewModel: WerewolfViewModel): readonly number[] {
  return viewModel.seats.filter((seat) => seat.disabledReason === null).map((seat) => seat.seat);
}

function skipLabelOf(schema: ActionSchema & { readonly canSkip: boolean }): string | null {
  return schema.canSkip
    ? requireSchemaText(schema, 'bottomActionText', schema.ui?.bottomActionText)
    : null;
}

/** `voted/total 狼人已确认`, then the countdown or the change hint once the viewer voted. */
function wolfStatusLine(
  wolfVote: NonNullable<WerewolfViewModel['night']['wolfVote']>,
  nowMs: number,
): string {
  const voted = wolfVote.voterSeats.filter((seat) => String(seat) in wolfVote.votes).length;
  const base = `${voted}/${wolfVote.voterSeats.length} 狼人已确认`;
  if (wolfVote.myVote === null) return base;
  if (wolfVote.deadlineAt !== null) {
    const remaining = Math.max(0, Math.ceil((wolfVote.deadlineAt - nowMs) / 1000));
    if (remaining > 0) return `${base}（${remaining}秒后确认）`;
  }
  return `${base}${WOLF_VOTE_CHANGE_HINT}`;
}

/** `查验结果：3号是狼人`; a roleName result is named through the role spec. */
function renderRevealTitle(
  reveal: NonNullable<WerewolfViewModel['night']['pendingReveal']>,
): string {
  const resultLabel = (() => {
    if (reveal.resultFormat === 'factionCheck') return reveal.result;
    if (!isValidRoleId(reveal.result)) {
      throw new Error(`[FAIL-FAST] Reveal result ${reveal.result} is not a role id`);
    }
    return getRoleDisplayName(reveal.result);
  })();
  return `${reveal.titlePrefix}：${formatSeat(reveal.targetSeat)}是${resultLabel}`;
}

export function resolveNightInteraction(input: NightInteractionInput): NightInteractionModel {
  const { viewModel, draft, swapSecondSeat, locks, nowMs } = input;
  const { night } = viewModel;

  if (viewModel.status !== GameStatus.Ongoing) return { kind: 'idle' };
  if (isAudioPlaybackLocked(locks.isAudioPlaying)) {
    return { kind: 'blocked', reason: AUDIO_PLAYBACK_LOCK_REASON };
  }
  if (locks.hasPendingCommand) return { kind: 'blocked', reason: PENDING_ACK_LOCK_REASON };

  if (night.pendingReveal !== null) {
    const reveal = night.pendingReveal;
    return { kind: 'ackReveal', reveal, title: renderRevealTitle(reveal) };
  }

  const schema = night.actionSchema;
  if (schema === null || !night.isActioner) return { kind: 'idle' };
  // Both derive from the current step / the viewer's seat: an actioner on a
  // step always has a role and a seat.
  const actionRole = night.currentActionRole;
  if (actionRole === null) {
    throw new Error(`[FAIL-FAST] Night step ${schema.id} has a schema but no acting role`);
  }
  const mySeat = viewModel.mySeat;
  if (mySeat === null) throw new Error('[FAIL-FAST] Night actioner has no seat');

  // The wolf robot's learn step: once learned, the robot waits on the
  // hunter gate (if any) and is otherwise done for the night.
  if (schema.id === 'wolfRobotLearn' && night.wolfRobot !== null) {
    return resolveWolfRobotGate(viewModel, actionRole) ?? { kind: 'idle' };
  }

  const prompt = renderStepPrompt(schema, actionRole, night.actorHint);
  const hint = night.actorHint;

  if (hint?.bottomAction === 'skipOnly') {
    return { kind: 'skipOnly', prompt, skipLabel: SKIP_CONFIRM_LABEL };
  }

  switch (schema.kind) {
    case 'skip':
      return { kind: 'skipOnly', prompt, skipLabel: SKIP_CONFIRM_LABEL };

    case 'chooseSeat':
      return {
        kind: 'pickSeat',
        stepId: schema.id,
        selectable: selectableSeats(viewModel),
        prompt,
        confirmTitle: requireSchemaText(schema, 'confirmTitle', schema.ui?.confirmTitle),
        confirmText: requireSchemaText(schema, 'confirmText', schema.ui?.confirmText),
        skipLabel: skipLabelOf(schema),
      };

    case 'wolfVote': {
      const wolfVote = night.wolfVote;
      if (wolfVote === null) {
        throw new Error('[FAIL-FAST] Wolf actioner has no wolf vote projection');
      }
      const wolfName = `${formatSeat(mySeat)}狼人`;
      return {
        kind: 'wolfVote',
        selectable: selectableSeats(viewModel),
        myVote: wolfVote.myVote,
        votes: wolfVote.votes,
        deadlineAt: wolfVote.deadlineAt,
        prompt,
        confirmTitle: requireSchemaText(schema, 'confirmTitle', schema.ui?.confirmTitle),
        voteConfirmTemplate: requireSchemaText(
          schema,
          'voteConfirmTemplate',
          schema.ui?.voteConfirmTemplate,
        ).replace('{wolf}', wolfName),
        emptyVoteConfirmText: requireSchemaText(
          schema,
          'emptyVoteConfirmTemplate',
          schema.ui?.emptyVoteConfirmTemplate,
        ).replace('{wolf}', wolfName),
        emptyVoteLabel:
          hint?.bottomAction === 'wolfEmptyOnly'
            ? WOLF_EMPTY_VOTE_CONFIRM_LABEL
            : requireSchemaText(schema, 'emptyVoteText', schema.ui?.emptyVoteText),
        emptyVoteOnly: hint?.bottomAction === 'wolfEmptyOnly',
        immuneSeats: wolfVote.immuneSeats,
        statusLine: wolfStatusLine(wolfVote, nowMs),
      };
    }

    case 'swap': {
      const pick: SwapPick = { first: draft.firstSwapSeat, second: swapSecondSeat };
      return {
        kind: 'pickTwoSeats',
        selectable: selectableSeats(viewModel),
        pick,
        prompt,
        firstPickTitle: requireSchemaText(schema, 'firstTargetTitle', schema.ui?.firstTargetTitle),
        firstPickTemplate: requireSchemaText(
          schema,
          'firstTargetPromptTemplate',
          schema.ui?.firstTargetPromptTemplate,
        ),
        confirmTitle: requireSchemaText(schema, 'confirmTitle', schema.ui?.confirmTitle),
        confirmText: requireSchemaText(schema, 'confirmText', schema.ui?.confirmText),
        skipLabel: skipLabelOf(schema),
      };
    }

    case 'multiChooseSeat':
      return {
        kind: 'multiSelect',
        selectable: selectableSeats(viewModel),
        selected: draft.multiSelectedSeats,
        max: schema.maxTargets,
        prompt,
        confirmText: requireSchemaText(schema, 'confirmText', schema.ui?.confirmText),
        confirmButtonTemplate: requireSchemaText(
          schema,
          'confirmButtonText',
          schema.ui?.confirmButtonText,
        ),
        skipLabel: skipLabelOf(schema),
      };

    case 'compound': {
      const witchContext = night.witchContext;
      if (witchContext === null || witchContext === undefined) {
        throw new Error('[FAIL-FAST] Witch actioner has no witch context');
      }
      const saveStep = schema.steps.find((step) => step.key === 'save');
      const poisonStep = schema.steps.find((step) => step.key === 'poison');
      if (saveStep === undefined || poisonStep === undefined) {
        throw new Error(`[FAIL-FAST] ${schema.id} must declare save and poison steps`);
      }
      return {
        kind: 'witch',
        killedSeat: witchContext.killedSeat >= 0 ? witchContext.killedSeat : null,
        canSave: witchContext.killedSeat >= 0 && witchContext.canSave,
        canPoison: witchContext.canPoison,
        selectable: selectableSeats(viewModel),
        prompt: renderWitchPrompt(schema, witchContext),
        saveLabel:
          witchContext.killedSeat >= 0 ? `对${formatSeat(witchContext.killedSeat)}用解药` : '',
        saveConfirmTitle: requireSchemaText(
          schema,
          'steps.save.confirmTitle',
          saveStep.ui?.confirmTitle,
        ),
        saveConfirmText: requireSchemaText(
          schema,
          'steps.save.confirmText',
          saveStep.ui?.confirmText,
        ),
        poisonConfirmTitle: requireSchemaText(
          schema,
          'steps.poison.confirmTitle',
          poisonStep.ui?.confirmTitle,
        ),
        poisonConfirmText: requireSchemaText(
          schema,
          'steps.poison.confirmText',
          poisonStep.ui?.confirmText,
        ),
        skipLabel: requireSchemaText(
          schema,
          'steps.poison.bottomActionText',
          poisonStep.ui?.bottomActionText,
        ),
      };
    }

    case 'confirm': {
      const status = night.confirmStatus;
      const statusUi = schema.ui?.confirmStatusUi;
      if (status === null || statusUi === undefined) {
        throw new Error(`[FAIL-FAST] Confirm step ${schema.id} has no status or confirmStatusUi`);
      }
      const buttonLabel = requireSchemaText(
        schema,
        'bottomActionText',
        schema.ui?.bottomActionText,
      );
      const dialogTitle = statusUi.statusDialogTitle;
      switch (statusUi.kind) {
        case 'infection': {
          if (status.role !== 'seedWolf') {
            throw new Error('[FAIL-FAST] Seed Wolf confirm step requires infection status');
          }
          if (status.availability === 'unavailable') {
            return {
              kind: 'confirmStatus',
              status,
              prompt,
              dialog: { title: dialogTitle, text: statusUi.unavailableText },
              buttonLabel,
              skipLabel: null,
              isUnavailable: true,
            };
          }
          return {
            kind: 'confirmStatus',
            status,
            prompt,
            dialog: {
              title: dialogTitle,
              text: statusUi.targetTemplate.replace('{seat}', formatSeat(status.targetSeat)),
            },
            buttonLabel,
            skipLabel: statusUi.skipButtonText,
            isUnavailable: false,
          };
        }
        case 'wolfTeammates': {
          const teammates = status.role === 'hiddenWolf' ? status.wolfTeammates : [];
          return {
            kind: 'confirmStatus',
            status,
            prompt,
            dialog: {
              title: dialogTitle,
              text: statusUi.messageTemplate.replace(
                '{seats}',
                teammates.length > 0 ? teammates.map((seat) => formatSeat(seat)).join('、') : '无',
              ),
            },
            buttonLabel,
            skipLabel: null,
            isUnavailable: false,
          };
        }
        case 'faction': {
          if (status.role !== 'avenger') {
            throw new Error('[FAIL-FAST] Faction confirm step requires avenger status');
          }
          const text =
            status.faction === Team.Third
              ? statusUi.bondedText
              : status.faction === Team.Wolf
                ? statusUi.wolfText
                : statusUi.goodText;
          return {
            kind: 'confirmStatus',
            status,
            prompt,
            dialog: { title: dialogTitle, text },
            buttonLabel,
            skipLabel: null,
            isUnavailable: false,
          };
        }
        case 'shoot': {
          if (status.role !== 'hunter' && status.role !== 'darkWolfKing') {
            throw new Error(
              '[FAIL-FAST] Shoot confirm step requires hunter or darkWolfKing status',
            );
          }
          return {
            kind: 'confirmStatus',
            status,
            prompt,
            dialog: {
              title: dialogTitle,
              text: status.canShoot ? statusUi.canText : statusUi.cannotText,
            },
            buttonLabel,
            skipLabel: null,
            isUnavailable: false,
          };
        }
        default: {
          const exhaustive: never = statusUi;
          throw new Error(`[FAIL-FAST] Unknown confirm status ui: ${String(exhaustive)}`);
        }
      }
    }

    case 'chooseCard': {
      const choice = night.chooseCard;
      if (choice === null)
        throw new Error('[FAIL-FAST] Card chooser has no bottom-card projection');
      return {
        kind: 'chooseCard',
        choice,
        prompt,
        confirmText: requireSchemaText(schema, 'confirmText', schema.ui?.confirmText),
        openLabel: requireSchemaText(schema, 'bottomActionText', schema.ui?.bottomActionText),
      };
    }

    case 'groupConfirm': {
      const reveal = night.reveals.find((entry) => entry.stepId === schema.id);
      if (reveal === undefined) {
        throw new Error(`[FAIL-FAST] groupConfirm step ${schema.id} has no reveal view`);
      }
      const ui = schema.ui;
      const personal = (() => {
        switch (schema.id) {
          case 'seedWolfInfectReveal':
            return {
              title: '感染信息',
              text: reveal.isSubject
                ? requireSchemaText(schema, 'hypnotizedText', ui?.hypnotizedText)
                : requireSchemaText(schema, 'notHypnotizedText', ui?.notHypnotizedText),
            };
          case 'awakenedGargoyleConvertReveal':
            return {
              title: '转化信息',
              text: reveal.isSubject
                ? requireSchemaText(schema, 'hypnotizedText', ui?.hypnotizedText)
                : requireSchemaText(schema, 'notHypnotizedText', ui?.notHypnotizedText),
            };
          case 'cupidLoversReveal':
            return {
              title: '情侣信息',
              text:
                reveal.isSubject && reveal.partnerSeat !== null
                  ? requireSchemaText(schema, 'loverText', ui?.loverText).replace(
                      '{seat}',
                      formatSeat(reveal.partnerSeat),
                    )
                  : requireSchemaText(schema, 'notLoverText', ui?.notLoverText),
            };
          default:
            return {
              title: '催眠信息',
              text:
                reveal.isSubject && reveal.subjectSeats !== null
                  ? requireSchemaText(schema, 'hypnotizedText', ui?.hypnotizedText).replace(
                      '{seats}',
                      reveal.subjectSeats.map((seat) => formatSeat(seat)).join('、'),
                    )
                  : requireSchemaText(schema, 'notHypnotizedText', ui?.notHypnotizedText),
            };
        }
      })();
      return {
        kind: 'ackGroupReveal',
        reveal,
        prompt,
        text: {
          ...personal,
          confirmLabel: requireSchemaText(schema, 'confirmButtonText', ui?.confirmButtonText),
        },
        openLabel: requireSchemaText(schema, 'bottomActionText', ui?.bottomActionText),
        hasAcked: reveal.hasAcked,
      };
    }

    case 'confirmTarget':
      throw new Error(`[FAIL-FAST] ${schema.id}: confirmTarget only exists inside a compound step`);
  }
}

/**
 * The hunter-status gate of the wolf robot: once the robot learned a
 * hunter-style role, the night waits on this acknowledgement. Resolved
 * ahead of the schema mapping because the learn action is already
 * recorded and the robot is otherwise idle.
 */
function resolveWolfRobotGate(
  viewModel: WerewolfViewModel,
  actionRole: RoleId,
): Extract<NightInteractionModel, { kind: 'ackHunterStatus' }> | null {
  const { night } = viewModel;
  const schema = night.actionSchema;
  const wolfRobot = night.wolfRobot;
  if (schema === null || schema.id !== 'wolfRobotLearn' || wolfRobot === null) return null;
  if (!wolfRobot.isHunterStatusGatePending) return null;
  const ui = schema.ui;
  const canShoot = wolfRobot.canShootAsHunter === true;
  return {
    kind: 'ackHunterStatus',
    canShoot,
    prompt: {
      title: nightStepTitle(actionRole),
      text: requireSchemaText(schema, 'hunterGatePrompt', ui?.hunterGatePrompt),
    },
    dialog: {
      title: requireSchemaText(schema, 'hunterGateDialogTitle', ui?.hunterGateDialogTitle),
      text: canShoot
        ? requireSchemaText(schema, 'hunterGateCanShootText', ui?.hunterGateCanShootText)
        : requireSchemaText(schema, 'hunterGateCannotShootText', ui?.hunterGateCannotShootText),
    },
    buttonLabel: requireSchemaText(schema, 'hunterGateButtonText', ui?.hunterGateButtonText),
  };
}

/**
 * The bottom-bar message for the actioner: the prompt text, then the
 * wolf status line and the wolf warning (unanimity / tie rule) when the
 * step is the wolf meeting; a skip-only / empty-vote-only hint replaces it.
 */
export function renderActionerMessage(
  model: NightInteractionModel,
  viewModel: WerewolfViewModel,
): string | null {
  const hint = viewModel.night.actorHint;
  if (hint?.bottomAction === 'skipOnly' || hint?.bottomAction === 'wolfEmptyOnly') {
    return hint.message;
  }
  switch (model.kind) {
    case 'idle':
    case 'blocked':
    case 'ackReveal':
      return null;
    case 'wolfVote': {
      const schema = requireActionSchema(viewModel, model.kind);
      return renderNightMessage([
        requireSchemaText(schema, 'prompt', schema.ui?.prompt),
        model.statusLine,
        hint !== null && WOLF_WARNING_HINT_KINDS.has(hint.kind) ? `⚠️ ${hint.message}` : null,
      ]);
    }
    case 'ackHunterStatus':
      // The gate replaces the learn prompt until the status is viewed.
      return model.prompt.text;
    case 'pickSeat':
    case 'pickTwoSeats':
    case 'multiSelect':
    case 'witch':
    case 'confirmStatus':
    case 'chooseCard':
    case 'skipOnly':
    case 'ackGroupReveal': {
      // The bottom line is the step's plain prompt; dialogs carry the
      // personalized text (witch info, group reveal, hint overrides).
      const schema = requireActionSchema(viewModel, model.kind);
      return requireSchemaText(schema, 'prompt', schema.ui?.prompt);
    }
  }
}

function requireActionSchema(viewModel: WerewolfViewModel, kind: string): ActionSchema {
  const schema = viewModel.night.actionSchema;
  if (schema === null) throw new Error(`[FAIL-FAST] ${kind} model without an action schema`);
  return schema;
}
