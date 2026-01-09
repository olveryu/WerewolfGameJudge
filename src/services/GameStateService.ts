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
import { GameTemplate, createTemplateFromRoles } from '../models/Template';
import { BroadcastService, BroadcastGameState, BroadcastPlayer, HostBroadcast, PlayerMessage } from './BroadcastService';
import AudioService from './AudioService';
import { NightFlowController, NightPhase, NightEvent, InvalidNightTransitionError } from './NightFlowController';
import { shuffleArray } from '../utils/shuffle';
import { calculateDeaths, type NightActions, type RoleSeatMap } from './DeathCalculator';
import { resolveWolfVotes } from './WolfVoteResolver';

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
  
  /** Last seat error for UI display (BUG-2 fix) */
  private lastSeatError: { seat: number; reason: 'seat_taken' } | null = null;
  
  /** NightFlowController: explicit state machine for night phase (Host only) */
  private nightFlow: NightFlowController | null = null;
  
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
      isAudioPlaying: false,
      lastNightDeaths: [],
    };

    // Join broadcast channel
    await this.broadcastService.joinRoom(roomCode, hostUid, {
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
      case 'WOLF_VOTE':
        await this.handleWolfVote(msg.seat, msg.target);
        break;
      case 'VIEWED_ROLE':
        await this.handlePlayerViewedRole(msg.seat);
        break;
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

    // Clear old seat if player is switching seats (find by uid, not trusting client)
    for (const [oldSeat, oldPlayer] of this.state.players.entries()) {
      if (oldPlayer?.uid === uid) {
        this.state.players.set(oldSeat, null);
        break;
      }
    }

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

    // Verify this is the correct role's turn
    const currentRole = this.getCurrentActionRole();
    if (currentRole !== role) {
      console.log('[GameState Host] Wrong role acting:', role, 'expected:', currentRole);
      return;
    }

    // NightFlow guard: only allow action in WaitingForAction phase and matching role
    if (this.nightFlow) {
      if (this.nightFlow.phase !== NightPhase.WaitingForAction) {
        console.log('[GameState Host] NightFlow not in WaitingForAction phase, ignoring action');
        return;
      }
      if (this.nightFlow.currentRole !== role) {
        console.log('[GameState Host] NightFlow role mismatch:', role, 'expected:', this.nightFlow.currentRole);
        return;
      }
    }

    // Record action
    if (target !== null) {
      if (role === 'witch') {
        // Witch: extra=true means poison, extra=false means save
        if (extra === true) {
          this.state.actions.set(role, -(target + 1));  // Poison encoding
        } else {
          this.state.actions.set(role, target);  // Save
        }
      } else {
        this.state.actions.set(role, target);
      }

      // Record action in nightFlow (use raw target, encoding handled above)
      try {
        const rawTarget = role === 'witch' && extra === true ? -(target + 1) : target;
        this.nightFlow?.recordAction(role, rawTarget);
      } catch (err) {
        console.error('[GameStateService] NightFlow recordAction failed:', err);
        // Continue with legacy flow
      }
    }

    // Dispatch ActionSubmitted to nightFlow
    try {
      this.nightFlow?.dispatch(NightEvent.ActionSubmitted);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow ActionSubmitted failed:', err.message);
      } else {
        throw err;
      }
    }

    // Advance to next action
    await this.advanceToNextAction();
  }

  private async handleWolfVote(seat: number, target: number): Promise<void> {
    if (!this.state || this.state.status !== GameStatus.ongoing) return;

    const currentRole = this.getCurrentActionRole();
    if (currentRole !== 'wolf') return;

    // Verify this is a wolf
    const player = this.state.players.get(seat);
    if (!player?.role || !isWolfRole(player.role)) return;

    // Record vote
    this.state.wolfVotes.set(seat, target);

    // Check if all wolves have voted
    const allWolfSeats = this.getAllWolfSeats();
    const allVoted = allWolfSeats.every(s => this.state!.wolfVotes.has(s));

    if (allVoted) {
  // [Bridge: WolfVoteResolver] Resolve final kill target from wolf votes
      const finalTarget = resolveWolfVotes(this.state.wolfVotes);
      if (finalTarget !== null) {
        this.state.actions.set('wolf', finalTarget);
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

  private handleHostBroadcast(msg: HostBroadcast): void {
    console.log('[GameState Player] Received host broadcast:', msg.type);

    switch (msg.type) {
      case 'STATE_UPDATE':
        // Host is authoritative - should not overwrite local state from broadcast
        if (this.isHost) {
          console.log('[GameState Host] Ignoring own STATE_UPDATE broadcast');
          return;
        }
        this.applyStateUpdate(msg.state);
        break;
      case 'ROLE_TURN':
        // State will be updated via STATE_UPDATE
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
      case 'GAME_RESTARTED':
        // Reset local state
        if (this.state) {
          this.state.status = GameStatus.seated;
          this.state.actions = new Map();
          this.state.wolfVotes = new Map();
          this.state.currentActionerIndex = 0;
          this.state.lastNightDeaths = [];
          // Clear roles
          this.state.players.forEach((p, seat) => {
            if (p) {
              p.role = null;
              p.hasViewedRole = false;
            }
          });
          this.notifyListeners();
        }
        break;
    }
  }

  private applyStateUpdate(broadcastState: BroadcastGameState): void {
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
    };

    this.notifyListeners();
  }

  // ===========================================================================
  // Host: Game Flow Control
  // ===========================================================================

  /**
   * Host: Take a seat (host is also a player)
   */
  async hostTakeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    if (!this.isHost || !this.state) return false;

    if (this.state.players.get(seat) !== null) return false;

    const player: LocalPlayer = {
      uid: this.myUid!,
      seatNumber: seat,
      displayName,
      avatarUrl,
      role: null,
      hasViewedRole: false,
    };

    this.state.players.set(seat, player);
    this.mySeatNumber = seat;

    // Check if all seats are filled
    const allSeated = Array.from(this.state.players.values()).every(p => p !== null);
    if (allSeated) {
      this.state.status = GameStatus.seated;
    }

    await this.broadcastState();
    this.notifyListeners();
    return true;
  }

  /**
   * Host: Add a bot to a seat
   */
  async hostAddBot(seat: number, displayName?: string): Promise<boolean> {
    if (!this.isHost || !this.state) return false;

    if (this.state.players.get(seat) !== null) return false;

    // Generate bot uid
    const botId = `bot_${seat}_${Math.random().toString(36).substring(2, 8)}`;

    const player: LocalPlayer = {
      uid: botId,
      seatNumber: seat,
      displayName: displayName ?? `机器人 ${seat + 1}`,
      avatarUrl: undefined,
      role: null,
      hasViewedRole: false,
    };

    this.state.players.set(seat, player);

    // Check if all seats are filled
    const allSeated = Array.from(this.state.players.values()).every(p => p !== null);
    if (allSeated) {
      this.state.status = GameStatus.seated;
    }

    await this.broadcastState();
    this.notifyListeners();
    return true;
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
   * Host: Mark that I (host) have viewed my role
   */
  async hostViewedRole(): Promise<void> {
    if (!this.isHost || !this.state || this.mySeatNumber === null) return;

    const player = this.state.players.get(this.mySeatNumber);
    if (player) {
      player.hasViewedRole = true;
    }

    // Check if all viewed
    const allViewed = Array.from(this.state.players.values())
      .filter((p): p is LocalPlayer => p !== null)
      .every(p => p.hasViewedRole);

    if (allViewed) {
      this.state.status = GameStatus.ready;
    }

    await this.broadcastState();
    this.notifyListeners();
  }

  /**
   * Host: Start the game (begin first night)
   */
  async startGame(): Promise<void> {
    if (!this.isHost || !this.state) return;
    if (this.state.status !== GameStatus.ready) return;

  // [Bridge: NightFlowController] Initialize night-phase state machine with action order
    this.nightFlow = new NightFlowController(this.state.template.actionOrder);
    
  // [Bridge: NightFlowController] Dispatch StartNight event (with error recovery)
    try {
      this.nightFlow.dispatch(NightEvent.StartNight);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow StartNight failed:', err.message);
        // Continue with legacy flow
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

  // [Bridge: NightFlowController] Night begin audio done - dispatch transition event
    try {
      this.nightFlow?.dispatch(NightEvent.NightBeginAudioDone);
      // Sync currentActionerIndex from nightFlow
      if (this.nightFlow) {
        this.state.currentActionerIndex = this.nightFlow.currentActionIndex;
      }
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow NightBeginAudioDone failed:', err.message);
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

    // 4. Shuffle roles
    const shuffledRoles = shuffleArray(rolePool);

    // 5. Assign roles to players (seats unchanged)
    let i = 0;
    this.state.players.forEach((player) => {
      if (player) {
        player.role = shuffledRoles[i];
        player.hasViewedRole = false;
        i++;
      }
    });

    // 6. Reset game phase
    this.state.status = GameStatus.ready;

    // 7. Notify listeners (uses existing mechanism)
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

  /**
   * Fill all empty seats with bots (host only).
   * This is a convenience method for filling the room quickly.
   */
  async fillWithBots(): Promise<void> {
    if (!this.isHost || !this.state) {
      console.warn('[GameStateService] fillWithBots: Not host or no state');
      return;
    }

    // Only allow before game starts
    if (this.state.status !== GameStatus.unseated && this.state.status !== GameStatus.seated) {
      console.warn('[GameStateService] Cannot fill bots after game starts');
      return;
    }

    // Fill all empty seats with bots
    for (let i = 0; i < this.state.template.numberOfPlayers; i++) {
      const player = this.state.players.get(i);
      if (player === null) {
        await this.hostAddBot(i, `机器人 ${i + 1}`);
      }
    }
    
    console.log('[GameStateService] Filled empty seats with bots');
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

    // Audio finished - dispatch RoleBeginAudioDone
    try {
      this.nightFlow?.dispatch(NightEvent.RoleBeginAudioDone);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow RoleBeginAudioDone failed:', err.message);
      } else {
        throw err;
      }
    }

    this.state.isAudioPlaying = false;

    // Get pending seats for this role
    const pendingSeats = this.getSeatsForRole(currentRole);
    
    // For wolf role, include kill target info
    const killedIndex = currentRole === 'witch' ? this.state.actions.get('wolf') : undefined;

    // Broadcast role turn
    await this.broadcastService.broadcastAsHost({
      type: 'ROLE_TURN',
      role: currentRole,
      pendingSeats,
      killedIndex,
    });

    await this.broadcastState();
    this.notifyListeners();
  }

  private async advanceToNextAction(): Promise<void> {
    if (!this.isHost || !this.state) return;

    const currentRole = this.getCurrentActionRole();
    
    // Play role ending audio if available
    if (currentRole) {
      // Ending audio is optional, ignore errors
      await this.audioService.playRoleEndingAudio(currentRole).catch(() => {});
    }

  // [Bridge: NightFlowController] Dispatch RoleEndAudioDone to advance state machine
    try {
      this.nightFlow?.dispatch(NightEvent.RoleEndAudioDone);
      // Sync currentActionerIndex from nightFlow
      if (this.nightFlow) {
        this.state.currentActionerIndex = this.nightFlow.currentActionIndex;
      }
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow RoleEndAudioDone failed:', err.message);
        // Fallback: advance manually
        this.state.currentActionerIndex++;
      } else {
        throw err;
      }
    }

    this.state.wolfVotes = new Map();  // Clear wolf votes for next role

    // Play next role's audio
    await this.playCurrentRoleAudio();
  }

  private async endNight(): Promise<void> {
    if (!this.isHost || !this.state) return;

    // Play night end audio
    console.log('[GameStateService] Playing night end audio...');
    await this.audioService.playNightEndAudio();

  // [Bridge: NightFlowController] Dispatch NightEndAudioDone to complete state machine
    try {
      this.nightFlow?.dispatch(NightEvent.NightEndAudioDone);
    } catch (err) {
      if (err instanceof InvalidNightTransitionError) {
        console.error('[GameStateService] NightFlow NightEndAudioDone failed:', err.message);
      } else {
        throw err;
      }
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
   * Player: Request to take a seat
   */
  async playerTakeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<void> {
    if (this.isHost) {
      // Host uses hostTakeSeat
      await this.hostTakeSeat(seat, displayName, avatarUrl);
      return;
    }

    if (!this.myUid) return;

    await this.broadcastService.sendToHost({
      type: 'JOIN',
      seat,
      uid: this.myUid,
      displayName: displayName ?? '',
      avatarUrl,
    });

    this.mySeatNumber = seat;  // Optimistic update
  }

  /**
   * Player: Leave seat
   */
  async playerLeaveSeat(): Promise<void> {
    if (!this.myUid || this.mySeatNumber === null) return;

    if (this.isHost) {
      // Host can leave their seat
      if (this.state) {
        this.state.players.set(this.mySeatNumber, null);
        this.mySeatNumber = null;
        await this.broadcastState();
        this.notifyListeners();
      }
      return;
    }

    await this.broadcastService.sendToHost({
      type: 'LEAVE',
      seat: this.mySeatNumber,
      uid: this.myUid,
    });

    this.mySeatNumber = null;
  }

  /**
   * Player: Mark role as viewed
   */
  async playerViewedRole(): Promise<void> {
    if (this.isHost) {
      await this.hostViewedRole();
      return;
    }

    if (this.mySeatNumber === null) return;

    await this.broadcastService.sendToHost({
      type: 'VIEWED_ROLE',
      seat: this.mySeatNumber,
    });
  }

  /**
   * Player: Submit action
   */
  async submitAction(target: number | null, extra?: any): Promise<void> {
    if (this.mySeatNumber === null || !this.state) return;

    const myRole = this.getMyRole();
    if (!myRole) return;

    if (this.isHost) {
      // Host processes action directly
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
   * Player: Submit wolf vote
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

  // ===========================================================================
  // Death Calculation Bridge (DeathCalculator)
  // ===========================================================================

  /**
   * Build NightActions from internal actions Map (decode encoding)
   */
  private buildNightActions(): NightActions {
    if (!this.state) return {};

    const actions = this.state.actions;
    const nightActions: NightActions = {};

    // Wolf kill
    const wolfKill = actions.get('wolf');
    if (wolfKill !== undefined && wolfKill !== -1) {
      nightActions.wolfKill = wolfKill;
    }

    // Guard protect
    const guardProtect = actions.get('guard');
    if (guardProtect !== undefined && guardProtect !== -1) {
      nightActions.guardProtect = guardProtect;
    }

    // Witch action (decode: >=0 = save, <0 = poison)
    const witchAction = actions.get('witch');
    if (witchAction !== undefined) {
      if (witchAction >= 0) {
        nightActions.witchSave = witchAction;
      } else {
        nightActions.witchPoison = -(witchAction + 1);
      }
    }

    // Wolf Queen charm
    const wolfQueenCharm = actions.get('wolfQueen');
    if (wolfQueenCharm !== undefined) {
      nightActions.wolfQueenCharm = wolfQueenCharm;
    }

    // Celebrity dream
    const celebrityDream = actions.get('celebrity');
    if (celebrityDream !== undefined) {
      nightActions.celebrityDream = celebrityDream;
    }

    // Magician swap (decode: first = action % 100, second = action / 100)
    const magicianAction = actions.get('magician');
    if (magicianAction !== undefined && magicianAction !== -1) {
      nightActions.magicianSwap = {
        first: magicianAction % 100,
        second: Math.floor(magicianAction / 100),
      };
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
      celebrity: this.findSeatByRole('celebrity'),
    };
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

    const broadcastState = this.toBroadcastState();
    await this.broadcastService.broadcastAsHost({
      type: 'STATE_UPDATE',
      state: broadcastState,
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

    return {
      roomCode: this.state.roomCode,
      hostUid: this.state.hostUid,
      status: this.state.status,
      templateRoles: this.state.template.roles,
      players,
      currentActionerIndex: this.state.currentActionerIndex,
      isAudioPlaying: this.state.isAudioPlaying,
      wolfVoteStatus,
    };
  }
}

export default GameStateService;
