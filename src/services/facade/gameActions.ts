/**
 * Game Actions — Game HTTP API business orchestration (declarative)
 *
 * Uses the defineGameAction factory to replace the previously manual
 * debug-log -> guard -> callApi pattern with declarative definitions.
 * Each action only declares name / path / optional body / after.
 *
 * Responsibilities same as defineGameAction.ts.
 * Forbidden: business logic/validation rules (all in handler / server), direct state mutation.
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';

import type { AudioService } from '@/services/infra/AudioService';
import { facadeLog } from '@/utils/logger';

import { defineGameAction } from './defineGameAction';

/**
 * Context interface required by gameActions
 * (injected from Facade to avoid circular dependencies)
 */
export interface GameActionsContext {
  readonly store: GameStore;
  myUserId: string | null;
  getMySeat: () => number | null;
  /** AudioService instance (for direct calls like preload) */
  audioService: AudioService;
}

// =============================================================================
// Host-only: room / template management
// =============================================================================

/** Host: assign roles */
export const assignRoles = defineGameAction({
  name: 'assignRoles',
  path: '/game/assign',
});

/** Host: update template */
export const updateTemplate = defineGameAction<[GameTemplate]>({
  name: 'updateTemplate',
  path: '/game/update-template',
  body: (template) => ({ templateRoles: template.roles, isPlagueMode: template.isPlagueMode }),
});

/** Host: restart game */
export const restartGame = defineGameAction({
  name: 'restartGame',
  path: '/game/restart',
});

/** Host: unseat all */
export const clearAllSeats = defineGameAction({
  name: 'clearAllSeats',
  path: '/game/clear-seats',
});

// =============================================================================
// Role viewing
// =============================================================================

/** Host/Player: mark a seat as having viewed role */
export const markViewedRole = defineGameAction<[number]>({
  name: 'markViewedRole',
  path: '/game/view-role',
  needsUserId: true,
  body: (seat) => ({ seat }),
});

// =============================================================================
// Night flow
// =============================================================================

/** Host: start night (preload audio on success) */
export const startNight = defineGameAction({
  name: 'startNight',
  path: '/game/start',
  after: (ctx, result) => {
    if (!result.success) return;
    const stateAfterStart = ctx.store.getState();
    if (stateAfterStart?.templateRoles) {
      ctx.audioService.preloadForRoles(stateAfterStart.templateRoles).catch((err: unknown) => {
        facadeLog.warn('preloadForRoles failed (non-critical)', err);
      });
    }
  },
});

/** Host: share night review with specific seats */
export const shareNightReview = defineGameAction<[number[]]>({
  name: 'shareNightReview',
  path: '/game/share-review',
  body: (allowedSeats) => ({ allowedSeats }),
});

/** Submit night action */
export const submitAction = defineGameAction<[number, RoleId, number | null, unknown?]>({
  name: 'submitAction',
  path: '/game/night/action',
  body: (seat, role, target, extra) => ({ seat, role, target, extra }),
  after: (_ctx, result, seat, role, target) => {
    if (!result.success) {
      facadeLog.warn('submitAction failed', { reason: result.reason, seat, role, target });
    }
  },
});

/** Host: set audio playback state */
export const setAudioPlaying = defineGameAction<[boolean]>({
  name: 'setAudioPlaying',
  path: '/game/night/audio-gate',
  body: (isPlaying) => ({ isPlaying }),
});

// =============================================================================
// Reveal / Group-Confirm Ack
// =============================================================================

/** Host: clear pending reveal acks and progress */
export const clearRevealAcks = defineGameAction({
  name: 'clearRevealAcks',
  path: '/game/night/reveal-ack',
  after: (_ctx, result) => {
    if (!result.success) {
      facadeLog.warn('clearRevealAcks failed', { reason: result.reason });
    }
  },
});

/** Player: submit groupConfirm ack */
export const submitGroupConfirmAck = defineGameAction<[number]>({
  name: 'submitGroupConfirmAck',
  path: '/game/night/group-confirm-ack',
  needsUserId: true,
  body: (seat) => ({ seat }),
  after: (_ctx, result, seat) => {
    if (!result.success) {
      facadeLog.warn('submitGroupConfirmAck failed', { reason: result.reason, seat });
    }
  },
});

/** Host/Player: Wolf Robot viewed Hunter status */
export const setWolfRobotHunterStatusViewed = defineGameAction<[number]>({
  name: 'setWolfRobotHunterStatusViewed',
  path: '/game/night/wolf-robot-viewed',
  body: (seat) => ({ seat }),
  after: (_ctx, result, seat) => {
    if (!result.success) {
      facadeLog.warn('setWolfRobotHunterStatusViewed failed', { reason: result.reason, seat });
    }
  },
});

// =============================================================================
// Audio Ack & Progression
// =============================================================================

/** Host: ack after audio playback completes */
export const postAudioAck = defineGameAction({
  name: 'postAudioAck',
  path: '/game/night/audio-ack',
});

/** Host: trigger server-side progression */
export const postProgression = defineGameAction({
  name: 'postProgression',
  path: '/game/night/progression',
});

// =============================================================================
// Debug Mode
// =============================================================================

/** Host: fill seats with bots (Debug-only) */
export const fillWithBots = defineGameAction({
  name: 'fillWithBots',
  path: '/game/fill-bots',
});

/** Host: mark all bots as having viewed role (Debug-only) */
export const markAllBotsViewed = defineGameAction({
  name: 'markAllBotsViewed',
  path: '/game/mark-bots-viewed',
});

/** Host: mark all bots as having confirmed groupConfirm step (Debug-only) */
export const markAllBotsGroupConfirmed = defineGameAction({
  name: 'markAllBotsGroupConfirmed',
  path: '/game/night/mark-bots-group-confirmed',
});

// =============================================================================
// Player profile sync
// =============================================================================

/** Sync player profile to GameState (any seated player) */
export const updatePlayerProfile = defineGameAction<
  [string?, string?, string?, string?, string?, string?, string?]
>({
  name: 'updatePlayerProfile',
  path: '/game/update-profile',
  needsUserId: true,
  body: (
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    roleRevealEffect,
    seatAnimation,
  ) => ({
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    roleRevealEffect,
    seatAnimation,
  }),
});

// =============================================================================
// Board suggestions
// =============================================================================

/** Submit board suggestion (any connected player, max one per person) */
export const boardNominate = defineGameAction<[string, RoleId[]]>({
  name: 'boardNominate',
  path: '/game/board-nominate',
  needsUserId: true,
  body: (displayName, roles) => ({ displayName, roles }),
});

/** Upvote board suggestion (any connected player) */
export const boardUpvote = defineGameAction<[string]>({
  name: 'boardUpvote',
  path: '/game/board-upvote',
  needsUserId: true,
  body: (targetUserId) => ({ targetUserId }),
});

/** Withdraw board suggestion (submitter only) */
export const boardWithdraw = defineGameAction({
  name: 'boardWithdraw',
  path: '/game/board-withdraw',
  needsUserId: true,
});
