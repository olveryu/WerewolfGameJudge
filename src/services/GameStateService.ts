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

/** Async handler wrapper to avoid unhandled promise rejection */
const asyncHandler = <T extends (...args: any[]) => Promise<void>>(fn: T) => {
  return (...args: Parameters<T>): void => {
    fn(...args).catch(console.error);
  };
};

// =============================================================================
// Game State Types
// =============================================================================

export enum GameStatus {
  unseated = 'unseated',    // Waiting for players to join
  seated = 'seated',        // All seats filled, waiting for host to assign roles
  assigned = 'assigned',    // Roles assigned, players viewing their cards
  ready = 'ready',          // All players have viewed cards, ready to start
  ongoing = 'ongoing',      // Night phase in progress
  ended = 'ended',          // Game ended (first night complete)
}

// Convert GameStatus to RoomStatus number (for backward compatibility)
export const gameStatusToRoomStatus = (status: GameStatus): number => {
  switch (status) {
    case GameStatus.unseated: return 0;
    case GameStatus.seated: return 1;
    case GameStatus.assigned: return 2;
    case GameStatus.ready: return 3;
    case GameStatus.ongoing: return 4;
    case GameStatus.ended: return 4; // ended is still "ongoing" in old enum
    default: return 0;
  }
};

export interface LocalPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role: RoleName | null;
  hasViewedRole: boolean;
}

export interface LocalGameState {
  roomCode: string;
  hostUid: string;
  status: GameStatus;
  template: GameTemplate;
  players: Map<number, LocalPlayer | null>;  // seat -> player
  actions: Map<RoleName, number>;  // role -> target (negative for witch poison)
  wolfVotes: Map<number, number>;  // wolf seat -> target
  currentActionerIndex: number;
  isAudioPlaying: boolean;
  lastNightDeaths: number[];  // Calculated after night ends
}

// =============================================================================
// State Change Callbacks
// =============================================================================

export type GameStateListener = (state: LocalGameState) => void;

// =============================================================================
// Service Implementation
// =============================================================================

export class GameStateService {
  private static instance: GameStateService;
  
  private state: LocalGameState | null = null;
  private isHost: boolean = false;
  private myUid: string | null = null;
  private mySeatNumber: number | null = null;
  
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
      this.listeners.forEach(listener => listener(this.state!));
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
      console.log('[GameState Host] Seat', seat, 'already taken');
      return;
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
      // Calculate final target
      const finalTarget = this.calculateWolfKillTarget();
      if (finalTarget !== -1) {
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
    const shuffledRoles = this.shuffleArray([...this.state.template.roles]);

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

    // Audio finished
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

    // Advance index
    this.state.currentActionerIndex++;
    this.state.wolfVotes = new Map();  // Clear wolf votes for next role

    // Play next role's audio
    await this.playCurrentRoleAudio();
  }

  private async endNight(): Promise<void> {
    if (!this.isHost || !this.state) return;

    // Play night end audio
    console.log('[GameStateService] Playing night end audio...');
    await this.audioService.playNightEndAudio();

    // Calculate deaths
    const deaths = this.calculateDeaths();
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

  private calculateWolfKillTarget(): number {
    if (!this.state) return -1;

    const wolfSeats = this.getAllWolfSeats();
    const voteCount = new Map<number, number>();

    wolfSeats.forEach(seat => {
      const target = this.state!.wolfVotes.get(seat);
      if (target !== undefined && target !== -1) {
        voteCount.set(target, (voteCount.get(target) ?? 0) + 1);
      }
    });

    if (voteCount.size === 0) return -1;

    let maxVotes = 0;
    voteCount.forEach(count => {
      if (count > maxVotes) maxVotes = count;
    });

    const topTargets: number[] = [];
    voteCount.forEach((count, target) => {
      if (count === maxVotes) topTargets.push(target);
    });

    // Tie = empty kill
    if (topTargets.length > 1) return -1;

    return topTargets[0];
  }

  private calculateDeaths(): number[] {
    if (!this.state) return [];

    const deaths = new Set<number>();
    const actions = this.state.actions;

    // Process wolf kill
    this.processWolfKill(actions, deaths);
    
    // Process witch poison
    this.processWitchPoison(actions, deaths);
    
    // Process wolf queen link
    this.processWolfQueenLink(actions, deaths);
    
    // Process celebrity protection
    this.processCelebrityEffect(actions, deaths);
    
    // Process magician swap
    this.processMagicianSwap(actions, deaths);

    return Array.from(deaths).sort((a, b) => a - b);
  }

  private parseWitchAction(witchAction: number | undefined): { saved: number | null; poisoned: number | null } {
    if (witchAction === undefined) {
      return { saved: null, poisoned: null };
    }
    if (witchAction >= 0) {
      return { saved: witchAction, poisoned: null };
    }
    return { saved: null, poisoned: -(witchAction + 1) };
  }

  private processWolfKill(actions: Map<RoleName, number>, deaths: Set<number>): void {
    const killedByWolf = actions.get('wolf');
    if (killedByWolf === undefined || killedByWolf === -1) return;

    const { saved: savedByWitch } = this.parseWitchAction(actions.get('witch'));
    const guardedBy = actions.get('guard');
    
    const isSaved = savedByWitch === killedByWolf;
    const isGuarded = guardedBy === killedByWolf;
    
    // 同守同救必死, or not saved and not guarded = dies
    const diesFromWolf = (isSaved && isGuarded) || (!isSaved && !isGuarded);
    if (diesFromWolf) {
      deaths.add(killedByWolf);
    }
  }

  private processWitchPoison(actions: Map<RoleName, number>, deaths: Set<number>): void {
    const { poisoned: poisonedByWitch } = this.parseWitchAction(actions.get('witch'));
    if (poisonedByWitch === null) return;

    // Check for witcher immunity
    const witcherSeat = this.findSeatByRole('witcher');
    if (witcherSeat !== poisonedByWitch) {
      deaths.add(poisonedByWitch);
    }
  }

  private processWolfQueenLink(actions: Map<RoleName, number>, deaths: Set<number>): void {
    const linkedBy = actions.get('wolfQueen');
    if (linkedBy === undefined) return;

    const queenSeat = this.findSeatByRole('wolfQueen');
    if (queenSeat !== -1 && deaths.has(queenSeat)) {
      deaths.add(linkedBy);
    }
  }

  private processCelebrityEffect(actions: Map<RoleName, number>, deaths: Set<number>): void {
    const dreamer = actions.get('celebrity');
    if (dreamer === undefined) return;

    // Celebrity protects dreamer
    deaths.delete(dreamer);

    // If celebrity dies, dreamer also dies
    const celebritySeat = this.findSeatByRole('celebrity');
    if (celebritySeat !== -1 && deaths.has(celebritySeat)) {
      deaths.add(dreamer);
    }
  }

  private processMagicianSwap(actions: Map<RoleName, number>, deaths: Set<number>): void {
    const magicianAction = actions.get('magician');
    if (magicianAction === undefined || magicianAction === -1) return;

    const first = magicianAction % 100;
    const second = Math.floor(magicianAction / 100);
    const firstDead = deaths.has(first);
    const secondDead = deaths.has(second);

    if (firstDead && !secondDead) {
      deaths.delete(first);
      deaths.add(second);
    } else if (!firstDead && secondDead) {
      deaths.delete(second);
      deaths.add(first);
    }
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

  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export default GameStateService;
