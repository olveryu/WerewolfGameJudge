/**
 * GameStateService - Manages local game state (Host is authoritative)
 * 
 * This service maintains the game state entirely in memory on the Host device.
 * All state changes are broadcast to other players via BroadcastService.
 * 
 * Key Principles:
 * 1. Host device is the Single Source of Truth
 * 2. No game state is stored in Supabase database
 * 3. Players receive state updates via Realtime Broadcast
 * 4. Death calculations happen locally on Host
 */

import { RoleName, isWolfRole } from '../models/roles';
import { GameTemplate, createTemplateFromRoles, validateTemplateRoles } from '../models/Template';
import { BroadcastService, BroadcastGameState, BroadcastPlayer, HostBroadcast, PlayerMessage } from './BroadcastService';
import AudioService from './AudioService';
import { NightFlowController, NightPhase, NightEvent, InvalidNightTransitionError } from './NightFlowController';
import { shuffleArray } from '../utils/shuffle';
import { calculateDeaths, type NightActions, type RoleSeatMap } from './DeathCalculator';
import { resolveWolfVotes } from './WolfVoteResolver';
import {
  makeActionTarget,
  makeActionWitch,
  makeWitchSave,
  makeWitchPoison,
  makeActionMagicianSwap,
  getActionTargetSeat,
} from '../models/actions';
import { isValidRoleId, getRoleSpec, ROLE_SPECS, type SchemaId, type RoleId, buildNightPlan, getStepsByRoleStrict } from '../models/roles/spec';
import { WOLF_MEETING_VOTE_CONFIG } from '../models/roles/spec/wolfMeetingVoteConfig';
import { getSeerCheckResultForTeam } from '../models/roles/spec/types';
import type { PrivateMessage, WitchContextPayload, PrivatePayload, SeerRevealPayload, PsychicRevealPayload, GargoyleRevealPayload, WolfRobotRevealPayload, ActionRejectedPayload } from './types/PrivateBroadcast';
import { getRoleAfterSwap } from './night/resolvers/types';

// Import types/enums needed internally
import {
  GameStatus,
  LocalPlayer,
  LocalGameState,
} from './types/GameStateTypes';

// Import type-only imports
import type { GameStateListener } from './types/GameStateTypes';

// Re-export types for backward compatibility
// (consumers can still import from GameStateService)
export {
  GameStatus,
  gameStatusToRoomStatus,
  LocalPlayer,
  LocalGameState,
  GameStateListener,
} from './types/GameStateTypes';

/** Async handler wrapper to avoid unhandled promise rejection */
const asyncHandler = <T extends (...args: any[]) => Promise<void>>(fn: T) => {
  return (...args: Parameters<T>): void => {
    fn(...args).catch(console.error);
  };
};

// =============================================================================
// Service Implementation
// =============================================================================

export class GameStateService {
  private static instance: GameStateService;
  
  private state: LocalGameState | null = null;
  private isHost: boolean = false;
  private myUid: string | null = null;
  private mySeatNumber: number | null = null;
  
  /** State revision counter (Host: incremented on each change, Player: received from Host) */
  private stateRevision: number = 0;
  
  /** Last seat error for UI display (BUG-2 fix) */
  private lastSeatError: { seat: number; reason: 'seat_taken' } | null = null;
  
  /** Pending seat action requests (Player: waiting for ACK) */
  private pendingSeatAction: {
    requestId: string;
    action: 'sit' | 'standup';
    seat: number;
    timestamp: number;
    timeoutHandle: ReturnType<typeof setTimeout>;
    resolve: (success: boolean) => void;
    reject: (error: Error) => void;
  } | null = null;
  
  /** Pending snapshot request (Player: waiting for response) */
  private pendingSnapshotRequest: {
    requestId: string;
    timestamp: number;
    timeoutHandle: ReturnType<typeof setTimeout>;
  } | null = null;
  
  /** NightFlowController: explicit state machine for night phase (Host only) */
  private nightFlow: NightFlowController | null = null;
  
  /**
   * Private message inbox (Zero-Trust: only stores messages where toUid === myUid)
   * Key: `${revision}_${kind}` to prevent cross-turn contamination
   * @see docs/phase4-final-migration.md
   */
  private readonly privateInbox: Map<string, PrivatePayload> = new Map();

  // Tracks latest revision for each private payload kind so UI can read reliably
  // even if stateRevision advanced due to unrelated STATE_UPDATE broadcasts.
  // Key: payload kind (e.g. 'SEER_REVEAL'), Value: last seen msg.revision
  private readonly privateInboxLatestRevisionByKind: Map<PrivatePayload['kind'], number> = new Map();

  /**
   * Host-only: gate advancing after a reveal action until the revealer confirms.
   * Key format: `${revision}_${role}`
   */
  private readonly pendingRevealAcks: Set<string> = new Set();
  
  private readonly broadcastService: BroadcastService;
  private readonly audioService: AudioService;

  
  private listeners: GameStateListener[] = [];
  
  private constructor() {
    this.broadcastService = BroadcastService.getInstance();
    this.audioService = AudioService.getInstance();
  }

  static getInstance(): GameStateService {
    if (!GameStateService.instance) {
      GameStateService.instance = new GameStateService();
    }
    return GameStateService.instance;
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  getState(): LocalGameState | null {
    return this.state;
  }

  isHostPlayer(): boolean {
    return this.isHost;
  }

  getMyUid(): string | null {
    return this.myUid;
  }

  getMySeatNumber(): number | null {
    return this.mySeatNumber;
  }

  getMyRole(): RoleName | null {
    if (this.mySeatNumber === null || !this.state) return null;
    return this.state.players.get(this.mySeatNumber)?.role ?? null;
  }

  getLastSeatError(): { seat: number; reason: 'seat_taken' } | null {
    return this.lastSeatError;
  }

  clearLastSeatError(): void {
    this.lastSeatError = null;
  }

  // ===========================================================================
  // State Listeners
  // ===========================================================================

  addListener(listener: GameStateListener): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    if (this.state) {
      // Create a shallow copy of state so React detects the change
      // (Map is a reference type, so we need a new object for React's shallow comparison)
      const stateCopy = { ...this.state };
      this.listeners.forEach(listener => listener(stateCopy));
    }
  }

  // ===========================================================================
  // Room Initialization (Host)
  // ===========================================================================

  /**
   * Initialize a new game as Host
   */
  async initializeAsHost(
    roomCode: string,
    hostUid: string,
    template: GameTemplate
  ): Promise<void> {
    this.isHost = true;
    this.myUid = hostUid;
    this.mySeatNumber = null;

    // Create initial state
    const players = new Map<number, LocalPlayer | null>();
    for (let i = 0; i < template.numberOfPlayers; i++) {
      players.set(i, null);
    }

    this.state = {
      roomCode,
      hostUid,
      status: GameStatus.unseated,
      template,
      players,
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
  currentStepId: undefined,
      isAudioPlaying: false,
      lastNightDeaths: [],
    };

    // Join broadcast channel
    await this.broadcastService.joinRoom(roomCode, hostUid, {
  // Host must also receive its own host broadcasts (broadcast.self=true),
  // including PRIVATE_EFFECT messages addressed to hostUid.
  // Otherwise, reveal roles won't work when the host is the actioner.
  onHostBroadcast: (msg) => this.handleHostBroadcast(msg),
      onPlayerMessage: asyncHandler((msg, senderId) => this.handlePlayerMessage(msg, senderId)),
      onPresenceChange: asyncHandler(async (users) => {
        console.log('[GameState] Users in room:', users.length);
        // Broadcast state when new users join so they receive current state
        if (this.state) {
          await this.broadcastState();
        }
      }),
    });

    // Broadcast initial state
    await this.broadcastState();
    this.notifyListeners();
    
    console.log('[GameStateService] Initialized as Host for room:', roomCode);
  }

  /**
   * Join an existing game as Player
   */
  async joinAsPlayer(
    roomCode: string,
    playerUid: string,
    displayName?: string,
    avatarUrl?: string
  ): Promise<void> {
    this.isHost = false;
    this.myUid = playerUid;
    this.mySeatNumber = null;

    // Join broadcast channel
    await this.broadcastService.joinRoom(roomCode, playerUid, {
      onHostBroadcast: (msg) => this.handleHostBroadcast(msg),
      onPresenceChange: (users) => console.log('[GameState] Users in room:', users.length),
    });

    // Request current state from host
    await this.broadcastService.sendToHost({
      type: 'REQUEST_STATE',
      uid: playerUid,
    });

    console.log('[GameStateService] Joined as Player for room:', roomCode);
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    // If seated, notify host
    if (!this.isHost && this.mySeatNumber !== null && this.myUid) {
      await this.broadcastService.sendToHost({
        type: 'LEAVE',
        seat: this.mySeatNumber,
        uid: this.myUid,
      });
    }

    await this.broadcastService.leaveRoom();
    this.state = null;
    this.isHost = false;
    this.myUid = null;
    this.mySeatNumber = null;
    this.notifyListeners();
    
    console.log('[GameStateService] Left room');
  }

  // ===========================================================================
  // Host: Handle Player Messages
  // ===========================================================================

  private async handlePlayerMessage(msg: PlayerMessage, _senderId: string): Promise<void> {
    if (!this.isHost || !this.state) return;

    console.log('[GameState Host] Received player message:', msg.type);

    switch (msg.type) {
      case 'REQUEST_STATE':
        // Player requesting current state - broadcast it
        console.log('[GameState Host] Broadcasting state for new player:', msg.uid);
        await this.broadcastState();
        break;
      case 'JOIN':
        await this.handlePlayerJoin(msg.seat, msg.uid, msg.displayName, msg.avatarUrl);
        break;
      case 'LEAVE':
        await this.handlePlayerLeave(msg.seat, msg.uid);
        break;
      case 'ACTION':
        await this.handlePlayerAction(msg.seat, msg.role, msg.target, msg.extra);
        break;
      case 'REVEAL_ACK':
        await this.handleRevealAck(msg.seat, msg.role, msg.revision);
        break;
      case 'WOLF_VOTE':
        await this.handleWolfVote(msg.seat, msg.target);
        break;
      case 'VIEWED_ROLE':
        await this.handlePlayerViewedRole(msg.seat);
        break;
      case 'SEAT_ACTION_REQUEST':
        await this.handleSeatActionRequest(msg);
        break;
      case 'SNAPSHOT_REQUEST':
        await this.handleSnapshotRequest(msg);
        break;
    }
  }

  private isRevealRole(role: RoleName): boolean {
    return role === 'seer' || role === 'psychic' || role === 'gargoyle' || role === 'wolfRobot';
  }

  private makeRevealAckKey(revision: number, role: RoleName): string {
    return `${revision}_${role}`;
  }

  private async handleRevealAck(seat: number, role: RoleName, revision: number): Promise<void> {
    if (!this.isHost || !this.state) return;
    if (this.state.status !== GameStatus.ongoing) return;
    if (!this.nightFlow) return;

    // Only relevant for reveal roles
    if (!this.isRevealRole(role)) return;

    const player = this.state.players.get(seat);
    if (!player) return;

    // Must match role and revision; otherwise ignore (idempotent/no-op)
    if (player.role !== role) return;
    if (revision !== this.stateRevision) return;
    if (this.nightFlow.phase !== NightPhase.WaitingForAction) return;
    if (this.nightFlow.currentRole !== role) return;

    const key = this.makeRevealAckKey(revision, role);
    if (!this.pendingRevealAcks.has(key)) return;

    this.pendingRevealAcks.delete(key);

    // Now we can finish the step just like a normal action-submitted flow.
    try {
      this.nightFlow.dispatch(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.debug('[GameStateService] REVEAL_ACK ignored (phase mismatch):', err.message);
        return;
      }
      throw err;
    }

    await this.advanceToNextAction();
  }

  /**
   * Host: Handle seat action request with ACK
   * Uses processSeatAction for unified logic
   */
  private async handleSeatActionRequest(msg: {
    requestId: string;
    action: 'sit' | 'standup';
    seat: number;
    uid: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<void> {
    if (!this.state) return;

    console.log(`[GameState Host] Seat action request: ${msg.action} seat ${msg.seat} from ${msg.uid.substring(0, 8)}`);

    // Use unified processSeatAction
    const result = await this.processSeatAction(
      msg.action,
      msg.seat,
      msg.uid,
      msg.displayName,
      msg.avatarUrl
    );

    // Send ACK to player
    await this.broadcastService.broadcastAsHost({
      type: 'SEAT_ACTION_ACK',
      requestId: msg.requestId,
      toUid: msg.uid,
      success: result.success,
      seat: msg.seat,
      reason: result.reason,
    });
  }

  /**
   * Host: Handle snapshot request (for reconnection/state recovery)
   */
  private async handleSnapshotRequest(msg: {
    requestId: string;
    uid: string;
    lastRevision?: number;
  }): Promise<void> {
    if (!this.state) return;

    console.log(`[GameState Host] Snapshot request from ${msg.uid.substring(0, 8)}, lastRev: ${msg.lastRevision ?? 'none'}`);

    const broadcastState = this.toBroadcastState();
    await this.broadcastService.broadcastAsHost({
      type: 'SNAPSHOT_RESPONSE',
      requestId: msg.requestId,
      toUid: msg.uid,
      state: broadcastState,
      revision: this.stateRevision,
    });
  }

  /**
   * Clear ALL seats occupied by a given uid (defensive: handles dirty data).
   * Optionally skip a specific seat (used when that seat is the new target).
   */
  private clearSeatsByUid(uid: string, skipSeat?: number): void {
    if (!this.state) return;
    for (const [seat, player] of this.state.players.entries()) {
      if (player?.uid === uid && seat !== skipSeat) {
        this.state.players.set(seat, null);
      }
    }
  }

  private async handlePlayerJoin(
    seat: number,
    uid: string,
    displayName?: string,
    avatarUrl?: string
  ): Promise<void> {
    if (!this.state) return;

    // Check if seat is available
    if (this.state.players.get(seat) !== null) {
      console.log('[GameState Host] Seat', seat, 'already taken, sending SEAT_REJECTED');
      await this.broadcastService.broadcastAsHost({
        type: 'SEAT_REJECTED',
        seat,
        requestUid: uid,
        reason: 'seat_taken',
      });
      return;
    }

    // Clear ALL old seats if player is switching (defensive: no break, handles dirty data)
    this.clearSeatsByUid(uid, seat);

    const player: LocalPlayer = {
      uid,
      seatNumber: seat,
      displayName,
      avatarUrl,
      role: null,
      hasViewedRole: false,
    };

    this.state.players.set(seat, player);

    // Check if all seats are filled
    const allSeated = Array.from(this.state.players.values()).every(p => p !== null);
    if (allSeated && this.state.status === GameStatus.unseated) {
      this.state.status = GameStatus.seated;
    }

    await this.broadcastState();
    this.notifyListeners();
  }

  private async handlePlayerLeave(seat: number, uid: string): Promise<void> {
    if (!this.state) return;

    const player = this.state.players.get(seat);
    if (player?.uid !== uid) return;

    this.state.players.set(seat, null);

    // Revert status if needed
    if (this.state.status === GameStatus.seated) {
      this.state.status = GameStatus.unseated;
    }

    await this.broadcastState();
    this.notifyListeners();
  }

  private async handlePlayerAction(
    seat: number,
    role: RoleName,
    target: number | null,
    extra?: any
  ): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.ongoing) return;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    if (!this.nightFlow) {
      console.error(
        '[GameStateService] STRICT INVARIANT VIOLATION: handlePlayerAction() called but nightFlow is null.',
        'seat:', seat, 'role:', role
      );
      throw new Error('handlePlayerAction: nightFlow is null - strict invariant violation');
    }

    // Verify this is the correct role's turn
    const currentRole = this.getCurrentActionRole();
    if (currentRole !== role) {
      console.log('[GameState Host] Wrong role acting:', role, 'expected:', currentRole);
      return;
    }

    // NightFlow guard: only allow action in WaitingForAction phase and matching role
    if (this.nightFlow.phase !== NightPhase.WaitingForAction) {
      console.log('[GameState Host] NightFlow not in WaitingForAction phase, ignoring action');
      return;
    }
    if (this.nightFlow.currentRole !== role) {
      console.log('[GameState Host] NightFlow role mismatch:', role, 'expected:', this.nightFlow.currentRole);
      return;
    }

    // Authoritative gate: reject action if player is blocked by nightmare
    // Blocked players can ONLY skip (target=null, extra=undefined). Any other action is rejected.
    const nightmareAction = this.state.actions.get('nightmare');
    if (nightmareAction?.kind === 'target' && nightmareAction.targetSeat === seat) {
      if (target !== null || extra !== undefined) {
        console.log('[GameState Host] Rejecting non-skip action from nightmare-blocked seat:', seat, 'role:', role, 'target:', target, 'extra:', extra);
        // Send ACTION_REJECTED private message to player
        const playerUid = this.state.players.get(seat)?.uid;
        if (playerUid) {
          const rejectPayload: ActionRejectedPayload = {
            kind: 'ACTION_REJECTED',
            action: 'submitAction',
            reason: '你被梦魇封锁，本回合只能跳过',
          };
          const privateMessage: PrivateMessage = {
            type: 'PRIVATE_EFFECT',
            toUid: playerUid,
            revision: this.stateRevision,
            payload: rejectPayload,
          };
          await this.broadcastService.sendPrivate(privateMessage);
        }
        return;
      }
      // target === null && extra === undefined: allowed (skip)
    }

    // Record action using structured RoleAction
    if (target !== null) {
      if (role === 'witch') {
        // Witch: extra=true means poison, extra=false means save
        if (extra === true) {
          this.state.actions.set(role, makeActionWitch(makeWitchPoison(target)));
        } else {
          this.state.actions.set(role, makeActionWitch(makeWitchSave(target)));
        }
      } else if (role === 'magician') {
        // Magician Wire Protocol: encoded target = firstSeat + secondSeat * 100
        // Constraint: secondSeat must be >= 1 to ensure target >= 100 (protocol invariant)
        // If target < 100, it's a protocol error (cannot distinguish from skip or single-seat action)
        if (target < 100) {
          console.error(
            '[GameStateService] Magician protocol error: encoded target < 100.',
            'target:', target, 'seat:', seat,
            'Protocol requires secondSeat >= 1 (target >= 100).'
          );
          return; // FAIL-FAST: reject malformed magician action
        }
        const firstSeat = target % 100;
        const secondSeat = Math.floor(target / 100);
        // Validate seat range [0..11] for 12-player games
        if (secondSeat > 11 || firstSeat > 11 || firstSeat < 0) {
          console.error(
            '[GameStateService] Magician protocol error: seat out of range.',
            'firstSeat:', firstSeat, 'secondSeat:', secondSeat
          );
          return; // FAIL-FAST: reject invalid seat numbers
        }
        this.state.actions.set(role, makeActionMagicianSwap(firstSeat, secondSeat));
      } else {
        this.state.actions.set(role, makeActionTarget(target));
      }

      // Record action in nightFlow (raw target only for logging/debug)
      try {
        this.nightFlow.recordAction(role, target);
      } catch (err) {
        console.error('[GameStateService] NightFlow recordAction failed:', err);
        throw err; // STRICT: propagate error, don't continue
      }

      // Send private reveal for seer/psychic (anti-cheat: Host computes result)
      if (role === 'seer') {
        await this.sendSeerReveal(seat, target);
      } else if (role === 'psychic') {
        await this.sendPsychicReveal(seat, target);
      } else if (role === 'gargoyle') {
        await this.sendGargoyleReveal(seat, target);
      } else if (role === 'wolfRobot') {
        await this.sendWolfRobotReveal(seat, target);
      }
    }

    // Reveal roles require an explicit "I read it" ACK before advancing.
    // This prevents the next narration ("闭眼") from cutting off the popup.
    if (this.isRevealRole(role) && target !== null) {
      this.pendingRevealAcks.add(this.makeRevealAckKey(this.stateRevision, role));
      // Stay in WaitingForAction until REVEAL_ACK arrives.
      return;
    }

    // Non-reveal roles proceed immediately
    try {
      this.nightFlow.dispatch(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow ActionSubmitted failed:', err.message);
        throw err; // STRICT: propagate error
      } else {
        throw err;
      }
    }

    await this.advanceToNextAction();
  }

  private async handleWolfVote(seat: number, target: number): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.ongoing) return;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    if (!this.nightFlow) {
      console.error(
        '[GameStateService] STRICT INVARIANT VIOLATION: handleWolfVote() called but nightFlow is null.',
        'seat:', seat
      );
      throw new Error('handleWolfVote: nightFlow is null - strict invariant violation');
    }

    const currentRole = this.getCurrentActionRole();
    if (currentRole !== 'wolf') return;

    // Verify this is a wolf
    const player = this.state.players.get(seat);
    if (!player?.role || !isWolfRole(player.role)) return;

    // === Commit 3: Wolf vote rejection checks ===
    const playerUid = player.uid;

    // 1. Actor-specific: spiritKnight cannot vote for self
    if (player.role === 'spiritKnight' && target === seat) {
      if (playerUid) {
        const rejectPayload: ActionRejectedPayload = {
          kind: 'ACTION_REJECTED',
          action: 'submitWolfVote',
          reason: '恶灵骑士不能投自己',
        };
        const privateMessage: PrivateMessage = {
          type: 'PRIVATE_EFFECT',
          toUid: playerUid,
          revision: this.stateRevision,
          payload: rejectPayload,
        };
        await this.broadcastService.sendPrivate(privateMessage);
      }
      return;
    }

    // 2. Target-based: forbiddenTargetRoleIds check (from WOLF_MEETING_VOTE_CONFIG, NOT wolfKill)
    // RED LINE: wolfKill stays neutral (can target ANY seat); restrictions are on meeting vote only
    const forbiddenRoles: readonly RoleId[] = WOLF_MEETING_VOTE_CONFIG.forbiddenTargetRoleIds;
    if (forbiddenRoles.length > 0) {
      const targetPlayer = this.state.players.get(target);
      const targetRole = targetPlayer?.role;
      // Type guard: only compare if targetRole is a valid RoleId
      if (targetRole && isValidRoleId(targetRole) && forbiddenRoles.includes(targetRole)) {
        const targetRoleSpec = getRoleSpec(targetRole);
        const targetRoleName = targetRoleSpec?.displayName ?? targetRole;
        if (playerUid) {
          const rejectPayload: ActionRejectedPayload = {
            kind: 'ACTION_REJECTED',
            action: 'submitWolfVote',
            reason: `不能投${targetRoleName}`,
          };
          const privateMessage: PrivateMessage = {
            type: 'PRIVATE_EFFECT',
            toUid: playerUid,
            revision: this.stateRevision,
            payload: rejectPayload,
          };
          await this.broadcastService.sendPrivate(privateMessage);
        }
        return;
      }
    }
    // === End Commit 3 checks ===

    // Record vote
    this.state.wolfVotes.set(seat, target);

    // Check if all wolves have voted
    const allWolfSeats = this.getAllWolfSeats();
    const allVoted = allWolfSeats.every(s => this.state!.wolfVotes.has(s));

    if (allVoted) {
      // ONCE-GUARD: If wolf action already recorded, this is a duplicate finalize - skip
      if (this.state.actions.has('wolf')) {
        console.debug(
          '[GameStateService] handleWolfVote finalize skipped (once-guard): wolf action already recorded.',
          'phase:', this.nightFlow.phase,
          'currentActionerIndex:', this.state.currentActionerIndex
        );
        return;
      }

  // [Bridge: WolfVoteResolver] Resolve final kill target from wolf votes
      const finalTarget = resolveWolfVotes(this.state.wolfVotes);
      if (finalTarget !== null) {
        this.state.actions.set('wolf', makeActionTarget(finalTarget));
        // Record action in nightFlow
        try {
          this.nightFlow.recordAction('wolf', finalTarget);
        } catch (err) {
          console.debug(
            '[GameStateService] NightFlow recordAction (wolf) failed:',
            err,
            'phase:', this.nightFlow.phase
          );
        }
      }

      // Dispatch ActionSubmitted to nightFlow (required before advanceToNextAction)
      try {
        this.nightFlow.dispatch(NightEvent.ActionSubmitted);
      } catch (err) {
        if (err instanceof InvalidNightTransitionError) {
          // This should NOT happen with proper once-guard above
          // If it does, it indicates a bug in the call chain
          console.debug(
            '[GameStateService] NightFlow ActionSubmitted (wolf) rejected:',
            'phase:', this.nightFlow.phase,
            '(expected WaitingForAction). This may indicate a call chain bug.'
          );
        } else {
          throw err;
        }
      }

      await this.advanceToNextAction();
    } else {
      // Broadcast vote status update
      await this.broadcastState();
      this.notifyListeners();
    }
  }

  private async handlePlayerViewedRole(seat: number): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.assigned) return;

    const player = this.state.players.get(seat);
    if (!player) return;

    player.hasViewedRole = true;

    // Check if all players have viewed
    const allViewed = Array.from(this.state.players.values())
      .filter((p): p is LocalPlayer => p !== null)
      .every(p => p.hasViewedRole);

    if (allViewed) {
      this.state.status = GameStatus.ready;
    }

    await this.broadcastState();
    this.notifyListeners();
  }

  // ===========================================================================
  // Player: Handle Host Broadcasts
  // ===========================================================================

  private handleHostBroadcast(msg: HostBroadcast | PrivateMessage): void {
    // Handle private messages (ANTI-CHEAT: Zero-Trust filtering)
    if (msg.type === 'PRIVATE_EFFECT') {
      this.handlePrivateMessage(msg);
      return;
    }

    console.log('[GameState Player] Received host broadcast:', msg.type);

    switch (msg.type) {
      case 'STATE_UPDATE':
        // Host is authoritative - should not overwrite local state from broadcast
        if (this.isHost) {
          console.log('[GameState Host] Ignoring own STATE_UPDATE broadcast');
          return;
        }
        this.applyStateUpdate(msg.state, msg.revision);
        break;
      case 'ROLE_TURN':
        // UI-only: stash current stepId for schema-driven UI mapping.
        // Logic continues to come from STATE_UPDATE (Host is authoritative).
        if (!this.isHost && this.state) {
          this.state.currentStepId = msg.stepId;
          this.notifyListeners();
        }
        break;
      case 'NIGHT_END':
        // Update local deaths
        if (this.state) {
          this.state.lastNightDeaths = msg.deaths;
          this.state.status = GameStatus.ended;
          this.notifyListeners();
        }
        break;
      case 'SEAT_REJECTED':
        // Only the player who requested the seat should handle this
        if (msg.requestUid === this.myUid) {
          console.log('[GameState Player] My seat request rejected:', msg.seat, msg.reason);
          this.lastSeatError = { seat: msg.seat, reason: msg.reason };
          this.notifyListeners();
        }
        break;
      case 'SEAT_ACTION_ACK':
        // Handle ACK for pending seat action
        this.handleSeatActionAck(msg);
        break;
      case 'SNAPSHOT_RESPONSE':
        // Handle snapshot response (only if we requested it)
        this.handleSnapshotResponse(msg);
        break;
      case 'GAME_RESTARTED':
        // Reset local state
        if (this.state) {
          this.state.status = GameStatus.seated;
          this.state.actions = new Map();
          this.state.wolfVotes = new Map();
          this.state.currentActionerIndex = 0;
          this.state.lastNightDeaths = [];
          this.state.currentStepId = undefined;
          // Clear roles
          this.state.players.forEach((p, _seat) => {
            if (p) {
              p.role = null;
              p.hasViewedRole = false;
            }
          });
          // Clear private inbox on game restart
          this.clearPrivateInbox();
          this.notifyListeners();
        }
        break;
    }
  }

  /**
   * Handle private messages (ANTI-CHEAT: Zero-Trust filtering)
   * Only stores messages where toUid === myUid
   * 
   * @see docs/phase4-final-migration.md
   */
  private handlePrivateMessage(msg: PrivateMessage): void {
    // ZERO-TRUST: Only accept messages addressed to me
    if (msg.toUid !== this.myUid) {
      console.debug('[GameState] Ignoring private message not for me');
      return;
    }

    console.log('[GameState] Received private message:', msg.payload.kind);

  // Store in inbox with revision-bound key (MUST use msg.revision; stateRevision may race)
  const key = `${msg.revision}_${msg.payload.kind}`;
  this.privateInboxLatestRevisionByKind.set(msg.payload.kind, msg.revision);
    
    switch (msg.payload.kind) {
      case 'WITCH_CONTEXT':
        this.privateInbox.set(key, msg.payload);
        console.log('[GameState] Stored WITCH_CONTEXT:', msg.payload.killedIndex, 'canSave:', msg.payload.canSave);
        // Notify listeners so UI can update
        this.notifyListeners();
        break;
      case 'SEER_REVEAL': {
  this.privateInbox.set(key, msg.payload);
        console.log('[GameState] Stored SEER_REVEAL:', msg.payload.targetSeat, '=', msg.payload.result);
        this.notifyListeners();
        break;
      }
      case 'PSYCHIC_REVEAL': {
  this.privateInbox.set(key, msg.payload);
        console.log('[GameState] Stored PSYCHIC_REVEAL:', msg.payload.targetSeat, '=', msg.payload.result);
        this.notifyListeners();
        break;
      }
      case 'GARGOYLE_REVEAL': {
  this.privateInbox.set(key, msg.payload);
        console.log('[GameState] Stored GARGOYLE_REVEAL:', msg.payload.targetSeat, '=', msg.payload.result);
        this.notifyListeners();
        break;
      }
      case 'WOLF_ROBOT_REVEAL': {
  this.privateInbox.set(key, msg.payload);
        console.log('[GameState] Stored WOLF_ROBOT_REVEAL:', msg.payload.targetSeat, '=', msg.payload.result);
        this.notifyListeners();
        break;
      }
      case 'BLOCKED':
        // TODO: Handle blocked message in future commit
        console.log('[GameState] Private message type not yet handled:', msg.payload.kind);
        break;
      case 'ACTION_REJECTED': {
  this.privateInbox.set(key, msg.payload);
        console.log('[GameState] Stored ACTION_REJECTED:', msg.payload.action, 'reason:', msg.payload.reason);
        this.notifyListeners();
        break;
      }
    }
  }

  private getLatestPrivatePayloadByKind<T extends PrivatePayload['kind']>(
    kind: T
  ): Extract<PrivatePayload, { kind: T }> | null {
    const rev = this.privateInboxLatestRevisionByKind.get(kind);
    if (rev === undefined) return null;
    const payload = this.privateInbox.get(`${rev}_${kind}`);
    return payload?.kind === kind
      ? (payload as Extract<PrivatePayload, { kind: T }>)
      : null;
  }

  /**
   * Get witch context from private inbox (for current revision only)
   * Returns null if no WITCH_CONTEXT message received for current revision.
   * 
   * ANTI-CHEAT: Only returns data sent privately to this player.
   * @see docs/phase4-final-migration.md
   */
  getWitchContext(): WitchContextPayload | null {
  return this.getLatestPrivatePayloadByKind('WITCH_CONTEXT');
  }

  /**
   * Get seer reveal from private inbox (for current revision only)
   * Returns null if no SEER_REVEAL message received for current revision.
   * 
   * ANTI-CHEAT: Only returns data sent privately to this player.
   */
  getSeerReveal(): SeerRevealPayload | null {
  return this.getLatestPrivatePayloadByKind('SEER_REVEAL');
  }

  /**
   * Get psychic reveal from private inbox (for current revision only)
   * Returns null if no PSYCHIC_REVEAL message received for current revision.
   * 
   * ANTI-CHEAT: Only returns data sent privately to this player.
   */
  getPsychicReveal(): PsychicRevealPayload | null {
  return this.getLatestPrivatePayloadByKind('PSYCHIC_REVEAL');
  }

  /**
   * Wait for seer reveal to arrive in inbox (with timeout).
   * Used after submitting action to ensure Host's private message has arrived.
   * 
   * @param timeoutMs - Maximum time to wait (default: 3000ms)
   * @returns SeerRevealPayload if received, null if timeout
   */
  async waitForSeerReveal(timeoutMs: number = 3000): Promise<SeerRevealPayload | null> {
    const pollIntervalMs = 50;
    const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
    
    for (let i = 0; i < maxAttempts; i++) {
      const reveal = this.getSeerReveal();
      if (reveal) {
        return reveal;
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    console.warn('[GameStateService] waitForSeerReveal timeout after', timeoutMs, 'ms');
    return null;
  }

  /**
   * Wait for psychic reveal to arrive in inbox (with timeout).
   * Used after submitting action to ensure Host's private message has arrived.
   * 
   * @param timeoutMs - Maximum time to wait (default: 3000ms)
   * @returns PsychicRevealPayload if received, null if timeout
   */
  async waitForPsychicReveal(timeoutMs: number = 3000): Promise<PsychicRevealPayload | null> {
    const pollIntervalMs = 50;
    const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
    
    for (let i = 0; i < maxAttempts; i++) {
      const reveal = this.getPsychicReveal();
      if (reveal) {
        return reveal;
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    console.warn('[GameStateService] waitForPsychicReveal timeout after', timeoutMs, 'ms');
    return null;
  }

  /**
   * Get gargoyle reveal from private inbox (for current revision only)
   * Returns null if no GARGOYLE_REVEAL message received for current revision.
   * 
   * ANTI-CHEAT: Only returns data sent privately to this player.
   */
  getGargoyleReveal(): GargoyleRevealPayload | null {
  return this.getLatestPrivatePayloadByKind('GARGOYLE_REVEAL');
  }

  /**
   * Wait for gargoyle reveal to arrive in inbox (with timeout).
   * Used after submitting action to ensure Host's private message has arrived.
   * 
   * @param timeoutMs - Maximum time to wait (default: 3000ms)
   * @returns GargoyleRevealPayload if received, null if timeout
   */
  async waitForGargoyleReveal(timeoutMs: number = 3000): Promise<GargoyleRevealPayload | null> {
    const pollIntervalMs = 50;
    const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
    
    for (let i = 0; i < maxAttempts; i++) {
      const reveal = this.getGargoyleReveal();
      if (reveal) {
        return reveal;
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    console.warn('[GameStateService] waitForGargoyleReveal timeout after', timeoutMs, 'ms');
    return null;
  }

  /**
   * Get wolf robot reveal from private inbox (for current revision only)
   * Returns null if no WOLF_ROBOT_REVEAL message received for current revision.
   * 
   * ANTI-CHEAT: Only returns data sent privately to this player.
   */
  getWolfRobotReveal(): WolfRobotRevealPayload | null {
  return this.getLatestPrivatePayloadByKind('WOLF_ROBOT_REVEAL');
  }

  /**
   * Wait for wolf robot reveal to arrive in inbox (with timeout).
   * Used after submitting action to ensure Host's private message has arrived.
   * 
   * @param timeoutMs - Maximum time to wait (default: 3000ms)
   * @returns WolfRobotRevealPayload if received, null if timeout
   */
  async waitForWolfRobotReveal(timeoutMs: number = 3000): Promise<WolfRobotRevealPayload | null> {
    const pollIntervalMs = 50;
    const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
    
    for (let i = 0; i < maxAttempts; i++) {
      const reveal = this.getWolfRobotReveal();
      if (reveal) {
        return reveal;
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    console.warn('[GameStateService] waitForWolfRobotReveal timeout after', timeoutMs, 'ms');
    return null;
  }

  /**
   * Get action rejected from private inbox (for current revision only)
   * Returns null if no ACTION_REJECTED message received for current revision.
   * 
   * @see docs/architecture/unified-host-reject-and-wolf-rules.zh-CN.md
   */
  getActionRejected(): ActionRejectedPayload | null {
  return this.getLatestPrivatePayloadByKind('ACTION_REJECTED');
  }

  /**
   * Wait for action rejected from Host.
   * Used by UI to detect if action was rejected before waiting for reveal.
   * 
   * NOTE: Uses short timeout (default 800ms) since reject should arrive quickly.
   * 
   * @param timeoutMs - Maximum time to wait for reject
   * @returns ActionRejectedPayload if received, null if timeout (action was accepted)
   * 
   * @see docs/architecture/unified-host-reject-and-wolf-rules.zh-CN.md
   */
  async waitForActionRejected(timeoutMs: number = 800): Promise<ActionRejectedPayload | null> {
    const pollIntervalMs = 50;
    const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
    
    for (let i = 0; i < maxAttempts; i++) {
      const rejected = this.getActionRejected();
      if (rejected) {
        return rejected;
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    // No rejection received = action was accepted
    return null;
  }

  /**
   * Clear private inbox (called on game restart or revision rollback)
   */
  private clearPrivateInbox(): void {
    this.privateInbox.clear();
  this.privateInboxLatestRevisionByKind.clear();
  }

  /**
   * Player: Handle seat action ACK from Host
   */
  private handleSeatActionAck(msg: {
    requestId: string;
    success: boolean;
    seat: number;
    toUid: string;
    reason?: string;
  }): void {
    // Only handle if addressed to us
    if (msg.toUid !== this.myUid) {
      return;
    }

    // Only handle if we have a pending request with matching ID
    if (!this.pendingSeatAction || this.pendingSeatAction.requestId !== msg.requestId) {
      return;
    }

    console.log(`[GameState Player] Seat action ACK: ${msg.success ? 'success' : 'failed'} for seat ${msg.seat}`);

    // Clear timeout first
    clearTimeout(this.pendingSeatAction.timeoutHandle);

    if (msg.success) {
      // Update local state based on action
      if (this.pendingSeatAction.action === 'sit') {
        this.mySeatNumber = msg.seat;
      } else {
        this.mySeatNumber = null;
      }
      this.pendingSeatAction.resolve(true);
    } else {
      // Action failed
      if (msg.reason === 'seat_taken') {
        this.lastSeatError = { seat: msg.seat, reason: 'seat_taken' };
      }
      this.pendingSeatAction.resolve(false);
    }

    this.pendingSeatAction = null;
    this.notifyListeners();
  }

  /**
   * Player: Handle snapshot response from Host
   */
  private handleSnapshotResponse(msg: {
    requestId: string;
    toUid: string;
    state: BroadcastGameState;
    revision: number;
  }): void {
    // Only handle if addressed to us
    if (msg.toUid !== this.myUid) {
      return;
    }

    // Only handle if we have a pending request with matching ID
    if (!this.pendingSnapshotRequest || this.pendingSnapshotRequest.requestId !== msg.requestId) {
      console.log(`[GameState Player] Ignoring snapshot - no matching pending request`);
      return;
    }

    console.log(`[GameState Player] Snapshot received, revision: ${msg.revision}`);

    // Clear timeout
    clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
    this.pendingSnapshotRequest = null;
    
    // Apply state unconditionally (snapshot is always authoritative)
    this.applyStateUpdate(msg.state, msg.revision);
    
    // Mark connection as live
    this.broadcastService.markAsLive();
  }

  private applyStateUpdate(broadcastState: BroadcastGameState, revision?: number): void {
    // Update revision if provided
    if (revision !== undefined) {
      // Skip if we've already seen a newer revision
      if (revision <= this.stateRevision) {
        console.log(`[GameState Player] Skipping stale update (rev ${revision} <= ${this.stateRevision})`);
        return;
      }
      this.stateRevision = revision;
    }
    
    // Mark connection as live after receiving state
    this.broadcastService.markAsLive();
    // Create or update local state from broadcast
    const template = createTemplateFromRoles(broadcastState.templateRoles);
    
    const players = new Map<number, LocalPlayer | null>();
    Object.entries(broadcastState.players).forEach(([seatStr, bp]) => {
      const seat = Number.parseInt(seatStr);
      if (bp) {
        players.set(seat, {
          uid: bp.uid,
          seatNumber: bp.seatNumber,
          displayName: bp.displayName,
          avatarUrl: bp.avatarUrl,
          role: bp.role ?? null,
          hasViewedRole: bp.hasViewedRole,
        });
        // Track my seat
        if (bp.uid === this.myUid) {
          this.mySeatNumber = seat;
        }
      } else {
        players.set(seat, null);
      }
    });

    this.state = {
      roomCode: broadcastState.roomCode,
      hostUid: broadcastState.hostUid,
      status: broadcastState.status as GameStatus,
      template,
      players,
      actions: new Map(),  // Players don't see actions
      wolfVotes: new Map(),
      currentActionerIndex: broadcastState.currentActionerIndex,
      isAudioPlaying: broadcastState.isAudioPlaying,
      lastNightDeaths: this.state?.lastNightDeaths ?? [],
      nightmareBlockedSeat: broadcastState.nightmareBlockedSeat,
    };

    this.notifyListeners();
  }

  // ===========================================================================
  // Host: Game Flow Control
  // ===========================================================================

  /**
   * Internal: Process seat action (unified logic for Host and Player)
   * This is the single source of truth for seat operations.
   */
  private async processSeatAction(
    action: 'sit' | 'standup',
    seat: number,
    uid: string,
    displayName?: string,
    avatarUrl?: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.state) return { success: false, reason: 'no_state' };

    if (action === 'sit') {
      // Check if seat is available
      if (this.state.players.get(seat) !== null) {
        return { success: false, reason: 'seat_taken' };
      }

      // Clear any old seats for this player
      this.clearSeatsByUid(uid, seat);

      // Assign seat
      const player: LocalPlayer = {
        uid,
        seatNumber: seat,
        displayName,
        avatarUrl,
        role: null,
        hasViewedRole: false,
      };
      this.state.players.set(seat, player);

      // Track my seat if this is me
      if (uid === this.myUid) {
        this.mySeatNumber = seat;
      }

      // Update status if all seated
      const allSeated = Array.from(this.state.players.values()).every(p => p !== null);
      if (allSeated && this.state.status === GameStatus.unseated) {
        this.state.status = GameStatus.seated;
      }

      await this.broadcastState();
      this.notifyListeners();
      return { success: true };

    } else if (action === 'standup') {
      // Verify player is in this seat
      const player = this.state.players.get(seat);
      if (player?.uid !== uid) {
        return { success: false, reason: 'not_seated' };
      }

      // Clear seat
      this.state.players.set(seat, null);

      // Track my seat if this is me
      if (uid === this.myUid) {
        this.mySeatNumber = null;
      }

      // Revert status if needed
      if (this.state.status === GameStatus.seated) {
        this.state.status = GameStatus.unseated;
      }

      await this.broadcastState();
      this.notifyListeners();
      return { success: true };
    }

    return { success: false, reason: 'unknown_action' };
  }

  /**
   * Take a seat (unified path for Host and Player)
   * Both use the same core logic: processSeatAction
   */
  async takeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    if (!this.myUid) return false;

    if (this.isHost) {
      // Host processes directly
      const result = await this.processSeatAction('sit', seat, this.myUid, displayName, avatarUrl);
      return result.success;
    }

    // Player uses ACK-based protocol
    const success = await this.sendSeatActionWithAck('sit', seat, displayName, avatarUrl);
    return success;
  }

  /**
   * Leave seat (unified path for Host and Player)
   * Both use the same core logic: processSeatAction
   */
  async leaveSeat(): Promise<boolean> {
    if (!this.myUid || this.mySeatNumber === null) return false;

    if (this.isHost) {
      // Host processes directly
      const result = await this.processSeatAction('standup', this.mySeatNumber, this.myUid);
      return result.success;
    }

    // Player uses ACK-based protocol
    const success = await this.sendSeatActionWithAck('standup', this.mySeatNumber);
    return success;
  }

  /**
   * Host: Assign roles to all players
   */
  async assignRoles(): Promise<void> {
    if (!this.isHost || !this.state) return;
    if (this.state.status !== GameStatus.seated) return;

    // Shuffle roles
    const shuffledRoles = shuffleArray([...this.state.template.roles]);

    // Assign to players
    let i = 0;
    this.state.players.forEach((player, seat) => {
      if (player) {
        player.role = shuffledRoles[i];
        player.hasViewedRole = false;
        i++;
      }
    });

    this.state.status = GameStatus.assigned;

    await this.broadcastState();
    this.notifyListeners();
    
    console.log('[GameStateService] Roles assigned');
  }

  /**
   * Host: Start the game (begin first night)
   */
  async startGame(): Promise<void> {
    if (!this.isHost || !this.state) return;
    if (this.state.status !== GameStatus.ready) return;

    // [Bridge: NightFlowController] Build NightPlan from template roles (table-driven)
    const nightPlan = buildNightPlan(this.state.template.roles);
    
    // [Bridge: NightFlowController] Initialize night-phase state machine with NightPlan
    this.nightFlow = new NightFlowController(nightPlan);
    
  // [Bridge: NightFlowController] Dispatch StartNight event (STRICT: fail-fast on error)
    try {
      this.nightFlow.dispatch(NightEvent.StartNight);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow StartNight failed:', err.message);
        // STRICT: fail-fast, no legacy fallback
        throw new Error(`[NightFlow] startGame failed: ${err.message}`);
      } else {
        throw err;
      }
    }

    // Reset night state
    this.state.actions = new Map();
    this.state.wolfVotes = new Map();
    this.state.currentActionerIndex = 0;
    this.state.isAudioPlaying = true;

    // Play night begin audio
    console.log('[GameStateService] Playing night begin audio...');
    await this.audioService.playNightBeginAudio();

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

  // [Bridge: NightFlowController] Night begin audio done - dispatch transition event (STRICT)
    try {
      this.nightFlow?.dispatch(NightEvent.NightBeginAudioDone);
      // Sync currentActionerIndex from nightFlow
      if (this.nightFlow) {
        this.state.currentActionerIndex = this.nightFlow.currentActionIndex;
      }
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow NightBeginAudioDone failed:', err.message);
        // STRICT: fail-fast, no legacy fallback
        throw new Error(`[NightFlow] NightBeginAudioDone failed: ${err.message}`);
      } else {
        throw err;
      }
    }

    // Set status to ongoing
    this.state.status = GameStatus.ongoing;
    
    await this.broadcastState();
    this.notifyListeners();

    // Start first role's turn
    await this.playCurrentRoleAudio();
  }

  /**
   * Host: Restart game with same template
   */
  async restartGame(): Promise<void> {
    if (!this.isHost || !this.state) return;

    // Reset nightFlow
    if (this.nightFlow) {
      try {
        this.nightFlow.dispatch(NightEvent.Reset);
      } catch (err) {
        // Reset should always succeed, but handle gracefully
        console.error('[GameStateService] NightFlow Reset failed:', err);
      }
      this.nightFlow = null;
    }

    // Reset state
    this.state.status = GameStatus.seated;
    this.state.actions = new Map();
    this.state.wolfVotes = new Map();
    this.state.currentActionerIndex = 0;
    this.state.isAudioPlaying = false;
    this.state.lastNightDeaths = [];

    // Clear roles but keep players
    this.state.players.forEach((player) => {
      if (player) {
        player.role = null;
        player.hasViewedRole = false;
      }
    });

    await this.broadcastService.broadcastAsHost({ type: 'GAME_RESTARTED' });
    await this.broadcastState();
    this.notifyListeners();
    
    console.log('[GameStateService] Game restarted');
  }

  /**
   * Emergency restart: invalidate current game and reshuffle roles.
   * Used when night flow is stuck or corrupted (rescue protocol).
   * 
   * GUARANTEE: When status === ongoing and all players have roles,
   * this method MUST succeed (return true).
   * 
   * Seats remain unchanged; only roles are reshuffled.
   * 
   * @returns true if restart succeeded, false if preconditions not met
   */
  emergencyRestartAndReshuffleRoles(): boolean {
    // ==========================================================================
    // Layer 1: Hard preconditions (always checked, cannot skip)
    // ==========================================================================
    
    if (!this.isHost) {
      console.warn('[GameStateService] emergencyRestart: not host');
      return false;
    }

    if (!this.state) {
      console.warn('[GameStateService] emergencyRestart: no state');
      return false;
    }

    if (!this.state.template) {
      console.warn('[GameStateService] emergencyRestart: no template');
      return false;
    }

    const players = Array.from(this.state.players.values()).filter(
      (p): p is LocalPlayer => p !== null
    );

    if (players.length === 0) {
      console.warn('[GameStateService] emergencyRestart: no players');
      return false;
    }

    // Role pool is template.roles (already a RoleName[] array)
    const rolePool: RoleName[] = [...this.state.template.roles];

    if (rolePool.length !== players.length) {
      console.warn(
        '[GameStateService] emergencyRestart: rolePool size mismatch',
        `(${rolePool.length} roles vs ${players.length} players)`
      );
      return false;
    }

    // ==========================================================================
    // Layer 2: Status check (rescue guarantee for ongoing + all have roles)
    // ==========================================================================
    
    const allPlayersHaveRoles = players.every(p => p.role != null);

    if (this.state.status === GameStatus.ongoing && allPlayersHaveRoles) {
      // Rescue protocol: skip other checks, proceed with restart
    } else if (this.state.status === GameStatus.unseated) {
      console.warn('[GameStateService] emergencyRestart: cannot restart in unseated status');
      return false;
    }
    // ready, ended, assigned, seated, ongoing (without all roles): proceed

    // ==========================================================================
    // Execution: Perform emergency restart
    // ==========================================================================

    // 1. Stop audio
    this.audioService.stop();

    // 2. Clear night caches
    this.state.actions.clear();
    this.state.wolfVotes.clear();
    this.state.currentActionerIndex = 0;
    this.state.isAudioPlaying = false;
    this.state.lastNightDeaths = [];

    // 3. Reset NightFlowController
    if (this.nightFlow) {
      try {
        this.nightFlow.dispatch(NightEvent.Reset);
      } catch (err) {
        console.warn('[GameStateService] emergencyRestart: NightFlow Reset failed:', err);
      }
      this.nightFlow = null;
    }

    // 4. Clear roles (host will click "准备看牌" to assign new roles)
    this.state.players.forEach((player) => {
      if (player) {
        player.role = null;
        player.hasViewedRole = false;
      }
    });

    // 5. Reset game phase to seated (host needs to click "准备看牌" again)
    this.state.status = GameStatus.seated;

    // 6. Broadcast authoritative state so all clients (and host UI) exit ongoing immediately.
    // Fire-and-forget: this method has a sync signature and is used from UI handlers.
    void (async () => {
      try {
        await this.broadcastService.broadcastAsHost({ type: 'GAME_RESTARTED' });
        await this.broadcastState();
      } catch (err) {
        console.warn('[GameStateService] emergencyRestart: broadcast failed:', err);
      }
    })();

    // 7. Notify listeners (local)
    this.notifyListeners();

    console.log('[GameStateService] Emergency restart completed');
    return true;
  }

  /**
   * Host: Update template (before game starts)
   * Can only be done in unseated or seated status
   */
  async updateTemplate(newTemplate: GameTemplate): Promise<void> {
    if (!this.isHost || !this.state) return;

    // Only allow template changes before game starts
    if (this.state.status !== GameStatus.unseated && this.state.status !== GameStatus.seated) {
      console.warn('[GameStateService] Cannot update template after game starts');
      return;
    }

    // Host-side defensive validation: reject clearly invalid templates
    const validationError = validateTemplateRoles(newTemplate.roles);
    if (validationError) {
      console.warn('[GameStateService] updateTemplate rejected: invalid roles -', validationError);
      return;
    }

    // Update template
    this.state.template = newTemplate;

    // Reset players map to match new template size
    const oldPlayers = this.state.players;
    this.state.players = new Map();
    for (let i = 0; i < newTemplate.numberOfPlayers; i++) {
      // Keep existing players if seat still exists
      const existingPlayer = oldPlayers.get(i);
      this.state.players.set(i, existingPlayer ?? null);
    }

    // Recalculate status based on seating
    const allSeated = Array.from(this.state.players.values()).every(p => p !== null);
    this.state.status = allSeated ? GameStatus.seated : GameStatus.unseated;

    await this.broadcastState();
    this.notifyListeners();
    
    console.log('[GameStateService] Template updated:', newTemplate.name);
  }

  // ===========================================================================
  // Host: Night Phase Control
  // ===========================================================================

  private getCurrentActionRole(): RoleName | null {
    if (!this.state) return null;
    const { currentActionerIndex } = this.state;
    const actionOrder = this.state.template.actionOrder;
    if (currentActionerIndex >= actionOrder.length) return null;
    return actionOrder[currentActionerIndex];
  }

  private async playCurrentRoleAudio(): Promise<void> {
    if (!this.isHost || !this.state) return;

    const currentRole = this.getCurrentActionRole();
    
    if (!currentRole) {
      // Night has ended
      await this.endNight();
      return;
    }

    this.state.isAudioPlaying = true;
    await this.broadcastState();
    this.notifyListeners();

    // Play role audio
    console.log('[GameStateService] Playing audio for role:', currentRole);
    await this.audioService.playRoleBeginningAudio(currentRole);

    // Audio finished - dispatch RoleBeginAudioDone (STRICT)
    try {
      this.nightFlow?.dispatch(NightEvent.RoleBeginAudioDone);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow RoleBeginAudioDone failed:', err.message);
        // STRICT: fail-fast, no legacy fallback
        throw new Error(`[NightFlow] RoleBeginAudioDone failed: ${err.message}`);
      } else {
        throw err;
      }
    }

    this.state.isAudioPlaying = false;

    // Get pending seats for this role
    const pendingSeats = this.getSeatsForRole(currentRole);
    
  // Get stepId from NIGHT_STEPS (fail-safe: only if valid roleId)
    let stepId: SchemaId | undefined;
    if (isValidRoleId(currentRole)) {
      const spec = getRoleSpec(currentRole);
      // stepId only exists when hasAction is true
      if (spec.night1.hasAction) {
    // M3: stepId is derived from NIGHT_STEPS single source of truth.
    // Current assumption (locked by contract tests): each role has at most one NightStep.
    const [step] = getStepsByRoleStrict(currentRole);
    stepId = step?.id;  // step.id is the stepId (= schemaId)
      }
    } else {
      console.warn(`[GameStateService] ROLE_TURN: Invalid roleId "${currentRole}", stepId not sent`);
    }

    // ANTI-CHEAT: For witch, send killedIndex via private message, NOT public broadcast
    if (currentRole === 'witch') {
      const wolfAction = this.state.actions.get('wolf');
      const killedIndex = getActionTargetSeat(wolfAction) ?? -1;
      await this.sendWitchContext(killedIndex);
    }

    // Broadcast role turn (PUBLIC - no killedIndex)
    await this.broadcastService.broadcastAsHost({
      type: 'ROLE_TURN',
      role: currentRole,
      pendingSeats,
      stepId,
      // ❌ killedIndex removed from public broadcast (anti-cheat)
    });

    await this.broadcastState();
    this.notifyListeners();
  }

  private async advanceToNextAction(): Promise<void> {
    if (!this.isHost || !this.state) return;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    // Only enforce this invariant during active night phase
    if (this.state.status === GameStatus.ongoing && !this.nightFlow) {
      console.error(
        '[GameStateService] STRICT INVARIANT VIOLATION: advanceToNextAction() called but nightFlow is null.',
        'status:', this.state.status
      );
      throw new Error('advanceToNextAction: nightFlow is null - strict invariant violation');
    }

    // If not ongoing (e.g., ended, ready), just return silently - not an error
    if (!this.nightFlow) {
      return;
    }

    const currentRole = this.getCurrentActionRole();
    
    // Play role ending audio if available
    if (currentRole) {
      // Set audio playing state during ending audio
      this.state.isAudioPlaying = true;
      await this.broadcastState();
      this.notifyListeners();

      // Ending audio is optional, ignore errors
      await this.audioService.playRoleEndingAudio(currentRole).catch(() => {});

      // Audio done - clear flag
      this.state.isAudioPlaying = false;
    }

  // [Bridge: NightFlowController] Dispatch RoleEndAudioDone to advance state machine
    // STRICT: Only dispatch if nightFlow is in RoleEndAudio phase
    // If phase mismatch, this is a duplicate/stale callback - ignore (idempotent)
    // NO FALLBACK: We never manually advance index; NightFlowController is the single source of truth
    if (this.nightFlow.phase === NightPhase.RoleEndAudio) {
      this.nightFlow.dispatch(NightEvent.RoleEndAudioDone);
      // Sync currentActionerIndex from nightFlow (the ONLY place this should be updated)
      this.state.currentActionerIndex = this.nightFlow.currentActionIndex;
    } else {
      // Phase mismatch - duplicate/stale callback, ignore silently (idempotent)
      console.debug(
        '[GameStateService] RoleEndAudioDone ignored (idempotent): phase is',
        this.nightFlow.phase,
        '- not RoleEndAudio'
      );
      // DO NOT advance index manually - that would violate state machine authority
      return; // Early return: don't proceed to playCurrentRoleAudio again
    }

    this.state.wolfVotes = new Map();  // Clear wolf votes for next role

    // Play next role's audio
    await this.playCurrentRoleAudio();
  }

  private async endNight(): Promise<void> {
    if (!this.isHost || !this.state) return;

    // STRICT INVARIANT: nightFlow must exist when status === ongoing
    // Only enforce this invariant during active night phase
    if (this.state.status === GameStatus.ongoing && !this.nightFlow) {
      console.error(
        '[GameStateService] STRICT INVARIANT VIOLATION: endNight() called but nightFlow is null.',
        'status:', this.state.status
      );
      throw new Error('endNight: nightFlow is null - strict invariant violation');
    }

    // If not ongoing (e.g., ended, ready), just return silently - not an error
    if (!this.nightFlow) {
      return;
    }

    // Play night end audio
    console.log('[GameStateService] Playing night end audio...');
    await this.audioService.playNightEndAudio();

  // [Bridge: NightFlowController] Dispatch NightEndAudioDone to complete state machine
    // STRICT: Only dispatch if nightFlow is in NightEndAudio phase
    // If phase mismatch, this is a duplicate/stale callback - STRICT no-op (no death calc, no broadcast)
    if (this.nightFlow.phase === NightPhase.NightEndAudio) {
      this.nightFlow.dispatch(NightEvent.NightEndAudioDone);
    } else {
      // Phase mismatch - duplicate/stale callback
      // STRICT: Do NOT proceed to death calculation - that would be越权推进
      // NightFlowController hasn't ended, so GameStateService must not end either
      console.debug(
        '[GameStateService] endNight() ignored (strict no-op): phase is',
        this.nightFlow.phase,
        '- not NightEndAudio. No death calc, no status change.'
      );
      return; // STRICT: early return, no side effects
    }

  // [Bridge: DeathCalculator] Calculate deaths via extracted pure function
    const deaths = this.doCalculateDeaths();
    this.state.lastNightDeaths = deaths;
    this.state.status = GameStatus.ended;

    // Broadcast night end
    await this.broadcastService.broadcastAsHost({
      type: 'NIGHT_END',
      deaths,
    });

    await this.broadcastState();
    this.notifyListeners();
    
    console.log('[GameStateService] Night ended. Deaths:', deaths);
  }

  // ===========================================================================
  // Player: Actions
  // ===========================================================================

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Take a seat with ACK (unified path)
   * Returns { success, reason } for detailed error handling
   */
  async takeSeatWithAck(
    seat: number,
    displayName?: string,
    avatarUrl?: string,
    timeoutMs: number = 5000
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.myUid) {
      return { success: false, reason: 'not_authenticated' };
    }

    if (this.isHost) {
      const result = await this.processSeatAction('sit', seat, this.myUid, displayName, avatarUrl);
      return result;
    }

    const success = await this.sendSeatActionWithAck('sit', seat, displayName, avatarUrl, timeoutMs);
    if (!success) {
      const reason = this.lastSeatError?.reason;
      return { success: false, reason: reason ?? 'unknown' };
    }
    return { success: true };
  }

  /**
   * Leave seat with ACK (unified path)
   * Returns { success, reason } for detailed error handling
   */
  async leaveSeatWithAck(timeoutMs: number = 5000): Promise<{ success: boolean; reason?: string }> {
    if (!this.myUid || this.mySeatNumber === null) {
      return { success: false, reason: 'not_seated' };
    }

    if (this.isHost) {
      const result = await this.processSeatAction('standup', this.mySeatNumber, this.myUid);
      return result;
    }

    const success = await this.sendSeatActionWithAck('standup', this.mySeatNumber, undefined, undefined, timeoutMs);
    return { success, reason: success ? undefined : 'timeout_or_rejected' };
  }

  /**
   * Internal: Send seat action and wait for ACK
   */
  private async sendSeatActionWithAck(
    action: 'sit' | 'standup',
    seat: number,
    displayName?: string,
    avatarUrl?: string,
    timeoutMs: number = 5000
  ): Promise<boolean> {
    if (!this.myUid) return false;

    // Cancel any pending action (clear timeout first)
    if (this.pendingSeatAction) {
      clearTimeout(this.pendingSeatAction.timeoutHandle);
      this.pendingSeatAction.reject(new Error('Cancelled by new action'));
      this.pendingSeatAction = null;
    }

    const requestId = this.generateRequestId();
    
    return new Promise<boolean>((resolve, reject) => {
      // Set up timeout first
      const timeoutHandle = setTimeout(() => {
        if (this.pendingSeatAction?.requestId === requestId) {
          console.log(`[GameState Player] Seat action timeout for ${action} seat ${seat}`);
          this.pendingSeatAction = null;
          this.notifyListeners();
          resolve(false);
        }
      }, timeoutMs);

      // Set up pending action with timeout handle
      this.pendingSeatAction = {
        requestId,
        action,
        seat,
        timestamp: Date.now(),
        timeoutHandle,
        resolve,
        reject,
      };

      // Send request
      this.broadcastService.sendToHost({
        type: 'SEAT_ACTION_REQUEST',
        requestId,
        action,
        seat,
        uid: this.myUid!,
        displayName,
        avatarUrl,
      }).catch(err => {
        if (this.pendingSeatAction?.requestId === requestId) {
          clearTimeout(this.pendingSeatAction.timeoutHandle);
          this.pendingSeatAction = null;
          reject(err);
        }
      });

      // Note: resolve/reject will be called by handleSeatActionAck or timeout
    });
  }

  /**
   * Player: Request full state snapshot from Host (for recovery)
   * Returns true if request was sent, false if failed
   * Timeout after 10s will mark connection as disconnected
   */
  async requestSnapshot(timeoutMs: number = 10000): Promise<boolean> {
    if (this.isHost) {
      // Host is authoritative, no need to request
      return true;
    }

    if (!this.myUid) return false;

    // Cancel any pending snapshot request
    if (this.pendingSnapshotRequest) {
      clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
      this.pendingSnapshotRequest = null;
    }

    // Mark as syncing
    this.broadcastService.markAsSyncing();

    const requestId = this.generateRequestId();
    
    console.log(`[GameState Player] Requesting snapshot, lastRev: ${this.stateRevision}`);

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      if (this.pendingSnapshotRequest?.requestId === requestId) {
        console.log(`[GameState Player] Snapshot request timeout`);
        this.pendingSnapshotRequest = null;
        // Mark as disconnected on timeout
        this.broadcastService.setConnectionStatus('disconnected');
        this.notifyListeners();
      }
    }, timeoutMs);

    // Store pending request
    this.pendingSnapshotRequest = {
      requestId,
      timestamp: Date.now(),
      timeoutHandle,
    };
    
    try {
      await this.broadcastService.sendToHost({
        type: 'SNAPSHOT_REQUEST',
        requestId,
        uid: this.myUid,
        lastRevision: this.stateRevision,
      });
    } catch (err) {
      // sendToHost failed - rollback pending state immediately
      if (this.pendingSnapshotRequest?.requestId === requestId) {
        console.log(`[GameState Player] Snapshot request send failed:`, err);
        clearTimeout(this.pendingSnapshotRequest.timeoutHandle);
        this.pendingSnapshotRequest = null;
        this.broadcastService.setConnectionStatus('disconnected');
        this.notifyListeners();
      }
      return false;
    }

    // Response will be handled by handleSnapshotResponse
    // Timeout will mark as disconnected if no response
    return true;
  }

  /**
   * Get current state revision
   */
  getStateRevision(): number {
    return this.stateRevision;
  }

  /**
   * Player: Mark role as viewed
   * Unified path: Both Host and Player call the same handler
   */
  async playerViewedRole(): Promise<void> {
    if (this.mySeatNumber === null) return;

    if (this.isHost) {
      // Host processes directly (same logic as handlePlayerViewedRole)
      await this.handlePlayerViewedRole(this.mySeatNumber);
      return;
    }

    await this.broadcastService.sendToHost({
      type: 'VIEWED_ROLE',
      seat: this.mySeatNumber,
    });
  }

  /**
   * Submit action (unified path for Host and Player)
   * Both call the same handler: handlePlayerAction
   */
  async submitAction(target: number | null, extra?: any): Promise<void> {
    if (this.mySeatNumber === null || !this.state) return;

    const myRole = this.getMyRole();
    if (!myRole) return;

    if (this.isHost) {
      await this.handlePlayerAction(this.mySeatNumber, myRole, target, extra);
      return;
    }

    await this.broadcastService.sendToHost({
      type: 'ACTION',
      seat: this.mySeatNumber,
      role: myRole,
      target,
      extra,
    });
  }

  /**
   * Submit wolf vote (unified path for Host and Player)
   * Both call the same handler: handleWolfVote
   */
  async submitWolfVote(target: number): Promise<void> {
    if (this.mySeatNumber === null) return;

    if (this.isHost) {
      await this.handleWolfVote(this.mySeatNumber, target);
      return;
    }

    await this.broadcastService.sendToHost({
      type: 'WOLF_VOTE',
      seat: this.mySeatNumber,
      target,
    });
  }

  /**
   * Submit reveal acknowledgement (unified path for Host and Player)
   * Both call the same handler: handleRevealAck
   * This lets the Host advance the night flow for reveal roles (seer/psychic/gargoyle/wolfRobot)
   */
  async submitRevealAck(role: RoleName): Promise<void> {
    if (!this.state || this.mySeatNumber === null) return;

    if (this.isHost) {
      await this.handleRevealAck(this.mySeatNumber, role, this.stateRevision);
      return;
    }

    await this.broadcastService.sendToHost({
      type: 'REVEAL_ACK',
      seat: this.mySeatNumber,
      role,
      revision: this.stateRevision,
    });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private getSeatsForRole(role: RoleName): number[] {
    if (!this.state) return [];
    
    const seats: number[] = [];
    this.state.players.forEach((player, seat) => {
      if (player?.role === role) {
        seats.push(seat);
      }
      // For wolf role, include all wolves
      if (role === 'wolf' && player?.role && isWolfRole(player.role)) {
        if (!seats.includes(seat)) {
          seats.push(seat);
        }
      }
    });
    return seats.sort((a, b) => a - b);
  }

  private getAllWolfSeats(): number[] {
    if (!this.state) return [];
    
    const seats: number[] = [];
    this.state.players.forEach((player, seat) => {
      if (player?.role && isWolfRole(player.role)) {
        seats.push(seat);
      }
    });
    return seats.sort((a, b) => a - b);
  }

  /**
   * Get the UID of a player with a specific role.
   * Returns null if role not found in this game.
   */
  private getPlayerUidByRole(role: RoleName): string | null {
    if (!this.state) return null;
    for (const [, player] of this.state.players) {
      if (player?.role === role) {
        return player.uid;
      }
    }
    return null;
  }

  /**
   * Get the seat number of a player with a specific role.
   * Returns -1 if role not found.
   */
  private getPlayerSeatByRole(role: RoleName): number {
    if (!this.state) return -1;
    for (const [seat, player] of this.state.players) {
      if (player?.role === role) {
        return seat;
      }
    }
    return -1;
  }

  // ===========================================================================
  // Private Effect Sending (Anti-cheat: toUid targeted messages)
  // ===========================================================================

  /**
   * Send WITCH_CONTEXT to the witch player.
   * Contains sensitive info: killedIndex, canSave.
   * 
   * @see docs/phase4-final-migration.md for anti-cheat architecture
   */
  private async sendWitchContext(killedIndex: number): Promise<void> {
    const witchUid = this.getPlayerUidByRole('witch');
    if (!witchUid) {
      console.warn('[GameStateService] sendWitchContext: witch not found in game');
      return;
    }

    const witchSeat = this.getPlayerSeatByRole('witch');
    // canSave: Host determines if witch can save (not self, has antidote)
  // Night-1-only: witch always has antidote, and self-save is not allowed per schema constraints
    const canSave = killedIndex !== -1 && killedIndex !== witchSeat;

    const privateMessage: PrivateMessage = {
      type: 'PRIVATE_EFFECT',
      toUid: witchUid,
      revision: this.stateRevision,
      payload: {
        kind: 'WITCH_CONTEXT',
        killedIndex,
        canSave,
        canPoison: true,  // Night-1: always has poison
        phase: 'save',
      } as WitchContextPayload,
    };

    console.log('[GameStateService] Sending WITCH_CONTEXT to witch:', witchUid.substring(0, 8), 'killedIndex:', killedIndex, 'canSave:', canSave);
    await this.broadcastService.sendPrivate(privateMessage);
  }

  /**
   * Send SEER_REVEAL to the seer player after they check a target.
   * Contains sensitive info: target's alignment (好人/狼人).
   * 
   * @see docs/phase4-final-migration.md for anti-cheat architecture
   */
  private async sendSeerReveal(seerSeat: number, targetSeat: number): Promise<void> {
    const seerUid = this.getPlayerUidByRole('seer');
    if (!seerUid || !this.state) {
      console.warn('[GameStateService] sendSeerReveal: seer not found or no state');
      return;
    }

    // Build role map and get swapped seats for identity check
    const roleMap = this.buildRoleMap();
    const swappedSeats = this.getMagicianSwappedSeats();
    
    // Get target's role AFTER magician swap (identity swap)
    const effectiveRoleId = getRoleAfterSwap(targetSeat, roleMap, swappedSeats);
    if (!effectiveRoleId) {
      console.warn('[GameStateService] sendSeerReveal: target not found at seat', targetSeat);
      return;
    }

    const targetSpec = ROLE_SPECS[effectiveRoleId];
    const result = getSeerCheckResultForTeam(targetSpec.team);

    const privateMessage: PrivateMessage = {
      type: 'PRIVATE_EFFECT',
      toUid: seerUid,
      revision: this.stateRevision,
      payload: {
        kind: 'SEER_REVEAL',
        targetSeat,
        result,
      } as SeerRevealPayload,
    };

    console.log('[GameStateService] Sending SEER_REVEAL to seer:', seerUid.substring(0, 8), 'target:', targetSeat, 'result:', result);
    await this.broadcastService.sendPrivate(privateMessage);
  }

  /**
   * Send PSYCHIC_REVEAL to the psychic player after they check a target.
   * Contains sensitive info: target's exact role name.
   * 
   * @see docs/phase4-final-migration.md for anti-cheat architecture
   */
  private async sendPsychicReveal(psychicSeat: number, targetSeat: number): Promise<void> {
    const psychicUid = this.getPlayerUidByRole('psychic');
    if (!psychicUid || !this.state) {
      console.warn('[GameStateService] sendPsychicReveal: psychic not found or no state');
      return;
    }

    // Build role map and get swapped seats for identity check
    const roleMap = this.buildRoleMap();
    const swappedSeats = this.getMagicianSwappedSeats();
    
    // Get target's role AFTER magician swap (identity swap)
    const effectiveRoleId = getRoleAfterSwap(targetSeat, roleMap, swappedSeats);
    if (!effectiveRoleId) {
      console.warn('[GameStateService] sendPsychicReveal: target not found at seat', targetSeat);
      return;
    }

    const targetSpec = ROLE_SPECS[effectiveRoleId];
    const result = targetSpec.displayName;

    const privateMessage: PrivateMessage = {
      type: 'PRIVATE_EFFECT',
      toUid: psychicUid,
      revision: this.stateRevision,
      payload: {
        kind: 'PSYCHIC_REVEAL',
        targetSeat,
        result,
      } as PsychicRevealPayload,
    };

    console.log('[GameStateService] Sending PSYCHIC_REVEAL to psychic:', psychicUid.substring(0, 8), 'target:', targetSeat, 'result:', result);
    await this.broadcastService.sendPrivate(privateMessage);
  }

  /**
   * Send GARGOYLE_REVEAL to the gargoyle player after they check a target.
   * Contains sensitive info: target's exact role name.
   * 
   * @see docs/phase4-final-migration.md for anti-cheat architecture
   */
  private async sendGargoyleReveal(gargoyleSeat: number, targetSeat: number): Promise<void> {
    const gargoyleUid = this.getPlayerUidByRole('gargoyle');
    if (!gargoyleUid || !this.state) {
      console.warn('[GameStateService] sendGargoyleReveal: gargoyle not found or no state');
      return;
    }

    // Build role map and get swapped seats for identity check
    const roleMap = this.buildRoleMap();
    const swappedSeats = this.getMagicianSwappedSeats();
    
    // Get target's role AFTER magician swap (identity swap)
    const effectiveRoleId = getRoleAfterSwap(targetSeat, roleMap, swappedSeats);
    if (!effectiveRoleId) {
      console.warn('[GameStateService] sendGargoyleReveal: target not found at seat', targetSeat);
      return;
    }

    const targetSpec = ROLE_SPECS[effectiveRoleId];
    const result = targetSpec.displayName;

    const privateMessage: PrivateMessage = {
      type: 'PRIVATE_EFFECT',
      toUid: gargoyleUid,
      revision: this.stateRevision,
      payload: {
        kind: 'GARGOYLE_REVEAL',
        targetSeat,
        result,
      } as GargoyleRevealPayload,
    };

    console.log('[GameStateService] Sending GARGOYLE_REVEAL to gargoyle:', gargoyleUid.substring(0, 8), 'target:', targetSeat, 'result:', result);
    await this.broadcastService.sendPrivate(privateMessage);
  }

  /**
   * Send WOLF_ROBOT_REVEAL to the wolf robot player after they learn a target's identity.
   * Contains sensitive info: target's exact role name.
   * 
   * @see docs/phase4-final-migration.md for anti-cheat architecture
   */
  private async sendWolfRobotReveal(robotSeat: number, targetSeat: number): Promise<void> {
    const robotUid = this.getPlayerUidByRole('wolfRobot');
    if (!robotUid || !this.state) {
      console.warn('[GameStateService] sendWolfRobotReveal: wolfRobot not found or no state');
      return;
    }

    // Build role map and get swapped seats for identity check
    const roleMap = this.buildRoleMap();
    const swappedSeats = this.getMagicianSwappedSeats();
    
    // Get target's role AFTER magician swap (identity swap)
    const effectiveRoleId = getRoleAfterSwap(targetSeat, roleMap, swappedSeats);
    if (!effectiveRoleId) {
      console.warn('[GameStateService] sendWolfRobotReveal: target not found at seat', targetSeat);
      return;
    }

    const targetSpec = ROLE_SPECS[effectiveRoleId];
    const result = targetSpec.displayName;

    const privateMessage: PrivateMessage = {
      type: 'PRIVATE_EFFECT',
      toUid: robotUid,
      revision: this.stateRevision,
      payload: {
        kind: 'WOLF_ROBOT_REVEAL',
        targetSeat,
        result,
      } as WolfRobotRevealPayload,
    };

    console.log('[GameStateService] Sending WOLF_ROBOT_REVEAL to wolfRobot:', robotUid.substring(0, 8), 'target:', targetSeat, 'result:', result);
    await this.broadcastService.sendPrivate(privateMessage);
  }

  // ===========================================================================
  // Death Calculation Bridge (DeathCalculator)
  // ===========================================================================

  /**
   * Build NightActions from structured actions Map
   */
  private buildNightActions(): NightActions {
    if (!this.state) return {};

    const actions = this.state.actions;
    const nightActions: NightActions = {};

    // Wolf kill
    const wolfAction = actions.get('wolf');
    if (wolfAction && wolfAction.kind === 'target') {
      nightActions.wolfKill = wolfAction.targetSeat;
    }

    // Guard protect
    const guardAction = actions.get('guard');
    if (guardAction && guardAction.kind === 'target') {
      nightActions.guardProtect = guardAction.targetSeat;
    }

    // Witch action (structured)
    const witchRoleAction = actions.get('witch');
    if (witchRoleAction && witchRoleAction.kind === 'witch') {
      nightActions.witchAction = witchRoleAction.witchAction;
    }

    // Wolf Queen charm
    const wolfQueenAction = actions.get('wolfQueen');
    if (wolfQueenAction && wolfQueenAction.kind === 'target') {
      nightActions.wolfQueenCharm = wolfQueenAction.targetSeat;
    }

    // Dreamcatcher dream
    const dreamcatcherAction = actions.get('dreamcatcher');
    if (dreamcatcherAction && dreamcatcherAction.kind === 'target') {
      nightActions.dreamcatcherDream = dreamcatcherAction.targetSeat;
    }

    // Magician swap
    const magicianAction = actions.get('magician');
    if (magicianAction && magicianAction.kind === 'magicianSwap') {
      nightActions.magicianSwap = {
        first: magicianAction.firstSeat,
        second: magicianAction.secondSeat,
      };
    }

    // Seer check (for spirit knight reflection)
    const seerAction = actions.get('seer');
    if (seerAction && seerAction.kind === 'target') {
      nightActions.seerCheck = seerAction.targetSeat;
    }

    // Nightmare block
    const nightmareAction = actions.get('nightmare');
    if (nightmareAction?.kind === 'target') {
      nightActions.nightmareBlock = nightmareAction.targetSeat;

      // Check if nightmare blocked a wolf player on night 1
      // If so, wolves cannot kill this night
      const blockedSeat = nightmareAction.targetSeat;
      const blockedPlayer = this.state.players.get(blockedSeat);
      if (blockedPlayer?.role && isWolfRole(blockedPlayer.role)) {
        nightActions.nightmareBlockedWolf = true;
      }
    }

    return nightActions;
  }

  /**
   * Build RoleSeatMap for death calculation context
   */
  private buildRoleSeatMap(): RoleSeatMap {
    return {
      witcher: this.findSeatByRole('witcher'),
  wolfQueen: this.findSeatByRole('wolfQueen'),
  dreamcatcher: this.findSeatByRole('dreamcatcher'),
      spiritKnight: this.findSeatByRole('spiritKnight'),
      seer: this.findSeatByRole('seer'),
      witch: this.findSeatByRole('witch'),
      guard: this.findSeatByRole('guard'),
    };
  }

  /**
   * Build a seat -> roleId map for resolver context.
   * Used for identity checks (seer, psychic, gargoyle).
   */
  private buildRoleMap(): ReadonlyMap<number, RoleId> {
    if (!this.state) return new Map();
    
    const roleMap = new Map<number, RoleId>();
    for (const [seat, player] of this.state.players) {
      if (player?.role && isValidRoleId(player.role)) {
        roleMap.set(seat, player.role);
      }
    }
    return roleMap;
  }

  /**
   * Get magician swapped seats from current night actions.
   * Returns undefined if no swap happened.
   */
  private getMagicianSwappedSeats(): readonly [number, number] | undefined {
    if (!this.state) return undefined;
    
    const magicianAction = this.state.actions.get('magician');
    if (magicianAction?.kind === 'magicianSwap') {
      return [magicianAction.firstSeat, magicianAction.secondSeat];
    }
    return undefined;
  }

  /**
   * Calculate deaths using DeathCalculator
   */
  private doCalculateDeaths(): number[] {
    if (!this.state) return [];

    const nightActions = this.buildNightActions();
    const roleSeatMap = this.buildRoleSeatMap();

  // [Bridge: DeathCalculator] Invoke extracted pure function
    return calculateDeaths(nightActions, roleSeatMap);
  }

  private findSeatByRole(role: RoleName): number {
    if (!this.state) return -1;
    
    for (const [seat, player] of this.state.players) {
      if (player?.role === role) return seat;
    }
    return -1;
  }

  /**
   * Get last night info string (deaths only)
   */
  getLastNightInfo(): string {
    if (!this.state) return '';

    const deaths = this.state.lastNightDeaths;
    if (deaths.length === 0) {
      return '昨天晚上是平安夜。';
    }

    const deathNumbers = deaths.map(d => `${d + 1}号`).join(', ');
    return `昨天晚上${deathNumbers}玩家死亡。`;
  }

  private async broadcastState(): Promise<void> {
    if (!this.isHost || !this.state) return;

    // Increment revision on each broadcast
    this.stateRevision++;
    
    const broadcastState = this.toBroadcastState();
    await this.broadcastService.broadcastAsHost({
      type: 'STATE_UPDATE',
      state: broadcastState,
      revision: this.stateRevision,
    });
  }

  private toBroadcastState(): BroadcastGameState {
    if (!this.state) throw new Error('No state');

    const players: Record<number, BroadcastPlayer | null> = {};
    this.state.players.forEach((p, seat) => {
      if (p) {
        // Only include role for the player themselves
        // Wolves can see each other (handled on client side)
        players[seat] = {
          uid: p.uid,
          seatNumber: p.seatNumber,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          role: p.role,  // Include role - client decides what to show
          hasViewedRole: p.hasViewedRole,
        };
      } else {
        players[seat] = null;
      }
    });

    // Wolf vote status
    const wolfVoteStatus: Record<number, boolean> = {};
    this.getAllWolfSeats().forEach(seat => {
      wolfVoteStatus[seat] = this.state!.wolfVotes.has(seat);
    });

    // Get nightmare blocked seat from actions
    const nightmareAction = this.state.actions.get('nightmare');
    const nightmareBlockedSeat = nightmareAction?.kind === 'target' 
      ? nightmareAction.targetSeat 
      : undefined;

    return {
      roomCode: this.state.roomCode,
      hostUid: this.state.hostUid,
      status: this.state.status,
      templateRoles: this.state.template.roles,
      players,
      currentActionerIndex: this.state.currentActionerIndex,
      isAudioPlaying: this.state.isAudioPlaying,
      wolfVoteStatus,
      nightmareBlockedSeat,
    };
  }
}

export default GameStateService;
