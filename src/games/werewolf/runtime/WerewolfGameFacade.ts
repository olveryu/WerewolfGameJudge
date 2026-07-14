/**
 * WerewolfGameFacade — game-owned command and audio orchestration.
 *
 * Responsibilities:
 * - Expose Werewolf commands over the shared RoomSession
 * - Delegate Werewolf audio orchestration
 *
 * Not responsible for:
 * - Business logic / validation rules (all in handlers)
 * - Direct state mutation (all in reducers)
 * - Global singleton (getInstance/resetInstance removed)
 *
 * Boundary constraints:
 * - Created by the Werewolf client-module factory via constructor DI
 * - Exposed through the shared client game catalog
 * - Does not own room entry, identity, connection, seat commands, or user-event delivery
 */

import type {
  WerewolfActionInput,
  WerewolfProfileUpdate,
  WerewolfPublicCommand,
} from '@werewolf/game-engine';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { resolveRandomAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

import type { RoomSessionClient } from '@/features/room/session/types';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';
import { type AudioService } from '@/services/infra/AudioService';
import { werewolfRuntimeLog } from '@/utils/logger';

import {
  WerewolfAudioOrchestrator,
  type WerewolfAudioRoomSnapshot,
} from './WerewolfAudioOrchestrator';
// Sub-modules
import type { GameActionsContext } from './werewolfGameActions';
import * as gameActions from './werewolfGameActions';
import type { WerewolfGameClient } from './WerewolfGameClient';

/**
 * WerewolfGameFacade injectable dependencies.
 *
 * All fields required — explicitly created and injected by the Werewolf module factory.
 * Tests likewise explicitly pass mock instances.
 */
interface WerewolfGameFacadeDeps {
  /** Single shared room session instance. */
  roomSession: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent>;
  /** AudioService instance */
  audioService: AudioService;
}

/**
 * Werewolf command/audio client layered over the shared session.
 */
export class WerewolfGameFacade implements WerewolfGameClient {
  readonly roomSession: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent>;
  readonly #audioService: AudioService;
  readonly #audioOrchestrator: WerewolfAudioOrchestrator;
  #activeEpoch: number | null = null;
  #initializedSnapshotEpoch: number | null = null;

  /**
   * Abort flag: set to true when leaving room.
   * Used to abort ongoing Werewolf audio operations.
   * Reset to false when creating/joining a new room.
   */
  #aborted = true;

  /**
   * @param deps - Must be explicitly provided by composition root or tests.
   */
  constructor(deps: WerewolfGameFacadeDeps) {
    this.roomSession = deps.roomSession;
    this.#audioService = deps.audioService;

    this.roomSession.subscribe(() => this.#handleSessionLifecycle());

    // Audio orchestration: reactive playback + ack retry
    this.#audioOrchestrator = new WerewolfAudioOrchestrator({
      roomSource: {
        getSnapshot: () => this.#getAudioRoomSnapshot(),
        subscribe: (listener) =>
          this.roomSession.subscribe(() => listener(this.#getAudioRoomSnapshot())),
      },
      audioService: deps.audioService,
      getActionsContext: () => this.#getActionsContext(),
      isHost: () => this.#isActiveUserHost(),
      isAborted: () => this.#aborted,
    });
  }

  /**
   * Whether audio was interrupted after Host rejoin (cached isAudioPlaying === true)
   * UI layer reads this to decide if "resume game" overlay needs to replay current step audio.
   */
  get wasAudioInterrupted(): boolean {
    return this.#audioOrchestrator.wasAudioInterrupted;
  }

  /**
   * Called after Host rejoin + user clicks "resume game".
   * Triggers user gesture -> unlocks Web AudioContext.
   * Delegates to WerewolfAudioOrchestrator for audio replay and ack.
   */
  async resumeAfterRejoin(): Promise<void> {
    werewolfRuntimeLog.debug('resumeAfterRejoin');
    return this.#audioOrchestrator.resumeAfterRejoin();
  }

  // =========================================================================
  // Progression (Host-only, wolf vote deadline)
  // =========================================================================

  /**
   * Host: triggers server-side progression after wolf vote deadline expires.
   *
   * Called when client countdown expires, server executes inline progression.
   */
  async postProgression(): Promise<ActionResult> {
    werewolfRuntimeLog.debug('postProgression');
    return gameActions.postProgression(this.#getActionsContext());
  }

  // =========================================================================
  // Game Control (delegated to gameActions)
  // =========================================================================

  async assignRoles(): Promise<ActionResult> {
    return gameActions.assignRoles(this.#getActionsContext());
  }

  async updateTemplate(template: GameTemplate): Promise<ActionResult> {
    return gameActions.updateTemplate(this.#getActionsContext(), template);
  }

  async markViewedRole(controlledSeat: number | null): Promise<ActionResult> {
    return gameActions.markViewedRole(this.#getActionsContext(), controlledSeat);
  }

  async startNight(): Promise<ActionResult> {
    return gameActions.startNight(this.#getActionsContext());
  }

  /**
   * Host: restart game (HTTP API)
   *
   * Server resets state -> WS broadcast pushes new state to all clients.
   */
  async restartGame(): Promise<ActionResult> {
    // Stop current audio then release preloaded resources (stop before clearPreloaded)
    this.#audioService.stop();
    this.#audioService.clearPreloaded();
    // Server validates hostUserId, client no longer does redundant gating
    return gameActions.restartGame(this.#getActionsContext());
  }

  // =========================================================================
  // Debug Mode: shared roster commands plus Werewolf progression commands
  // =========================================================================

  /**
   * Host: mark all bots as having viewed roles (Debug-only)
   *
   * Sets hasViewedRole = true only for isBot === true players.
   * Only available when debugMode.botsEnabled === true && status === Assigned.
   */
  async markAllBotsViewed(): Promise<ActionResult> {
    return gameActions.markAllBotsViewed(this.#getActionsContext());
  }

  /**
   * Host: mark all bots as having confirmed groupConfirm step (Debug-only)
   *
   * Batch-submits groupConfirm ack for all isBot players.
   * Only available when debugMode.botsEnabled === true && status === Ongoing && current step is groupConfirm.
   */
  async markAllBotsGroupConfirmed(): Promise<ActionResult> {
    return gameActions.markAllBotsGroupConfirmed(this.#getActionsContext());
  }

  /**
   * Sync player profile to GameState (any seated player)
   *
   * Called after user changes name/avatar in SettingsScreen, broadcasts new profile to all clients.
   * If not seated, server returns NOT_SEATED (silently ignore).
   */
  async updatePlayerProfile(profile: WerewolfProfileUpdate): Promise<ActionResult> {
    return gameActions.updatePlayerProfile(this.#getActionsContext(), {
      ...profile,
      roleRevealEffect: this.#resolveEffect(profile.roleRevealEffect),
    });
  }

  /**
   * Host: share "detailed info" to specified seats
   *
   * In ended phase, Host selects seats allowed to view night action details.
   */
  async shareNightReview(allowedSeats: number[]): Promise<ActionResult> {
    return gameActions.shareNightReview(this.#getActionsContext(), allowedSeats);
  }

  // =========================================================================
  // Board Nomination (delegated to gameActions)
  // =========================================================================

  async boardNominate(displayName: string, roles: RoleId[]): Promise<ActionResult> {
    return gameActions.boardNominate(this.#getActionsContext(), displayName, roles);
  }

  async boardUpvote(targetUserId: string): Promise<ActionResult> {
    return gameActions.boardUpvote(this.#getActionsContext(), targetUserId);
  }

  async boardWithdraw(): Promise<ActionResult> {
    return gameActions.boardWithdraw(this.#getActionsContext());
  }

  // =========================================================================
  // Night Actions (delegated to gameActions)
  // =========================================================================

  /**
   * Submit night action (HTTP API)
   *
   * Host and Player both use HTTP API uniformly.
   * Progression triggered internally by gameActions.submitAction (Host only).
   */
  async submitAction(
    input: WerewolfActionInput,
    controlledSeat: number | null,
  ): Promise<ActionResult> {
    return gameActions.submitAction(this.#getActionsContext(), input, controlledSeat);
  }

  /**
   * Submit reveal confirmation (seer/psychic/gargoyle/wolfRobot) (HTTP API)
   *
   * Host/Player both call HTTP API uniformly
   */
  async submitRevealAck(controlledSeat: number | null): Promise<ActionResult> {
    return gameActions.submitRevealAck(this.#getActionsContext(), controlledSeat);
  }

  /**
   * Submit groupConfirm ack (hypnotize confirmation "I understand") (HTTP API)
   *
   * Any player can call. Server auto-progresses step after receiving all player acks.
   */
  async submitGroupConfirmAck(controlledSeat: number | null): Promise<ActionResult> {
    return gameActions.submitGroupConfirmAck(this.#getActionsContext(), controlledSeat);
  }

  /**
   * Submit wolfRobot hunter status view confirmation (HTTP API)
   *
   * Host/Player both call HTTP API uniformly
   *
   * @param controlledSeat - bot seat controlled by Host, or null for the authenticated player
   */
  async sendWolfRobotHunterStatusViewed(controlledSeat: number | null): Promise<ActionResult> {
    return gameActions.setWolfRobotHunterStatusViewed(this.#getActionsContext(), controlledSeat);
  }

  // =========================================================================
  // Night Flow (delegated to gameActions) - PR6
  // =========================================================================

  /**
   * Host: set audio playing state
   *
   * PR7: audio timing control
   * - When audio starts playing, call setAudioPlaying(true)
   * - When audio ends (or is skipped), call setAudioPlaying(false)
   */
  async setAudioPlaying(isPlaying: boolean): Promise<ActionResult> {
    return gameActions.setAudioPlaying(this.#getActionsContext(), isPlaying);
  }

  // =========================================================================
  // Context Builders (provide context for sub-modules)
  // =========================================================================

  #getActionsContext(): GameActionsContext {
    return {
      getState: () => this.#getReadyState(),
      audioService: this.#audioService,
      commands: this.roomSession,
    };
  }

  #handleSessionLifecycle(): void {
    const session = this.roomSession.getSnapshot();
    if (session.phase === 'idle') {
      if (this.#activeEpoch === null) return;
      this.#aborted = true;
      this.#activeEpoch = null;
      this.#initializedSnapshotEpoch = null;
      this.#audioOrchestrator.reset();
      this.#audioService.stop();
      this.#audioService.stopBgm();
      this.#audioService.clearPreloaded();
      return;
    }

    if (this.#activeEpoch !== session.epoch) {
      this.#activeEpoch = session.epoch;
      this.#initializedSnapshotEpoch = null;
      this.#aborted = false;
      this.#audioOrchestrator.reset();
      this.#audioOrchestrator.setWasAudioInterrupted(
        session.identity.room.hostUserId === session.identity.userId,
      );
    }

    if (session.phase === 'ready' && this.#initializedSnapshotEpoch !== session.epoch) {
      this.#initializedSnapshotEpoch = session.epoch;
      this.#audioOrchestrator.setWasAudioInterrupted(
        session.identity.room.hostUserId === session.identity.userId &&
          session.snapshot.state.status === GameStatus.Ongoing,
      );
    }
  }

  #getReadyState(): GameState {
    const session = this.roomSession.getSnapshot();
    if (session.phase !== 'ready') {
      throw new Error('[FAIL-FAST] Werewolf command requires a ready room session');
    }
    return session.snapshot.state;
  }

  #getAudioRoomSnapshot(): WerewolfAudioRoomSnapshot | null {
    const session = this.roomSession.getSnapshot();
    if (session.phase !== 'ready') return null;
    return { state: session.snapshot.state, connection: session.connection };
  }

  /**
   * Resolve 'random' equippedEffect to a concrete animation ID.
   * Uses roomCode + userId as seed for deterministic per-room selection.
   */
  #resolveEffect(effect: string | undefined): string | undefined {
    if (effect !== 'random') return effect;
    const session = this.roomSession.getSnapshot();
    if (session.phase !== 'ready') {
      throw new Error('[FAIL-FAST] Cannot resolve a room effect outside an active session');
    }
    return resolveRandomAnimation(session.identity.room.roomCode + session.identity.userId);
  }

  #isActiveUserHost(): boolean {
    const session = this.roomSession.getSnapshot();
    return session.phase !== 'idle' && session.identity.room.hostUserId === session.identity.userId;
  }
}
