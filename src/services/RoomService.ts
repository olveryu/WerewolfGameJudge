import { supabase, isSupabaseConfigured } from '../config/supabase';
import { Room, RoomStatus } from '../models/Room';
import { Player } from '../models/Player';
import { RoleName, ACTION_ORDER } from '../models/roles';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { AuthService } from './AuthService';

// Default timeout for RPC/DB operations (10 seconds)
// Note: Some operations like witch_poison require multiple RPC calls,
// so we need enough time for the full sequence
const RPC_TIMEOUT = 10000;

// Timeout wrapper for async operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, _operation: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`请求超时，请检查网络连接后重试`)), timeoutMs)
    )
  ]);
};

// Safe RPC call with timeout - returns error for UI to handle
const safeRpc = async <T = any>(
  rpcName: string, 
  params: Record<string, any>,
  timeoutMs: number = RPC_TIMEOUT
): Promise<{ data: T | null; error: Error | null }> => {
  try {
    console.log(`[safeRpc] ${rpcName} starting...`);
    const rpcPromise = Promise.resolve(supabase!.rpc(rpcName, params));
    const result = await withTimeout(rpcPromise, timeoutMs, `RPC ${rpcName}`);
    console.log(`[safeRpc] ${rpcName} completed`);
    return { data: result.data as T, error: result.error };
  } catch (err) {
    console.error(`[safeRpc] ${rpcName} failed:`, err);
    return { data: null, error: err as Error };
  }
};

// Safe DB query with timeout
const safeQuery = async <T = any>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  operation: string,
  timeoutMs: number = RPC_TIMEOUT
): Promise<{ data: T | null; error: Error | null }> => {
  try {
    console.log(`[safeQuery] ${operation} starting...`);
    const result = await withTimeout(queryFn(), timeoutMs, operation);
    console.log(`[safeQuery] ${operation} completed`);
    return { data: result.data, error: result.error };
  } catch (err) {
    console.error(`[safeQuery] ${operation} failed:`, err);
    return { data: null, error: err as Error };
  }
};

// Database types for Supabase
interface DbRoom {
  room_number: string;
  host_uid: string;
  room_status: number;
  roles: string[];  // RoleName strings
  players: Record<string, any>;
  actions: Record<string, number>;  // RoleName -> target (negative for witch poison)
  wolf_votes: Record<string, number>;
  current_actioner_index: number;
  created_at: string;
  updated_at: string;
}

// Convert Room to database format
const roomToDb = (room: Room): Omit<DbRoom, 'created_at' | 'updated_at'> => {
  const playersMap: Record<string, any> = {};
  room.players.forEach((player, seat) => {
    if (player) {
      playersMap[seat.toString()] = {
        uid: player.uid,
        seatNumber: player.seatNumber,
        role: player.role,
        status: player.status,
        skillStatus: player.skillStatus,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        hasViewedRole: player.hasViewedRole,
      };
    } else {
      playersMap[seat.toString()] = null;
    }
  });

  const actionsMap: Record<string, number> = {};
  room.actions.forEach((target, role) => {
    actionsMap[role] = target;
  });

  const wolfVotesMap: Record<string, number> = {};
  room.wolfVotes.forEach((target, wolfSeat) => {
    wolfVotesMap[wolfSeat.toString()] = target;
  });

  return {
    room_number: room.roomNumber,
    host_uid: room.hostUid,
    room_status: room.roomStatus,
    roles: room.template.roles,
    players: playersMap,
    actions: actionsMap,
    wolf_votes: wolfVotesMap,
    current_actioner_index: room.currentActionerIndex,
  };
};

// Convert database format to Room
const dbToRoom = (dbRoom: DbRoom): Room => {
  const roles = dbRoom.roles as RoleName[];
  
  const players = new Map<number, Player | null>();
  roles.forEach((_, index) => {
    players.set(index, null);
  });
  
  Object.entries(dbRoom.players || {}).forEach(([seatStr, playerData]) => {
    if (playerData) {
      const seat = Number.parseInt(seatStr);
      const role = playerData.role as RoleName | null;
      // Set player even if role is null (during seating phase)
      players.set(seat, {
        uid: playerData.uid,
        seatNumber: playerData.seatNumber,
        role,
        status: playerData.status,
        skillStatus: playerData.skillStatus,
        hasViewedRole: playerData.hasViewedRole ?? false,
        displayName: playerData.displayName,
        avatarUrl: playerData.avatarUrl,
      });
    }
  });

  const actions = new Map<RoleName, number>();
  Object.entries(dbRoom.actions || {}).forEach(([roleName, target]) => {
    actions.set(roleName as RoleName, target);
  });

  const wolfVotes = new Map<number, number>();
  Object.entries(dbRoom.wolf_votes || {}).forEach(([wolfSeatStr, target]) => {
    wolfVotes.set(Number.parseInt(wolfSeatStr), target);
  });

  const roleSet = new Set(roles);
  const actionOrder = ACTION_ORDER.filter((role) => roleSet.has(role));

  return {
    timestamp: new Date(dbRoom.created_at).getTime(),
    hostUid: dbRoom.host_uid,
    roomNumber: dbRoom.room_number,
    roomStatus: dbRoom.room_status as RoomStatus,
    template: {
      name: 'Custom',
      roles,
      numberOfPlayers: roles.length,
      actionOrder,
    },
    players,
    actions,
    wolfVotes,
    currentActionerIndex: dbRoom.current_actioner_index,
    isAudioPlaying: false,
  };
};

export class RoomService {
  private static instance: RoomService;
  private readonly roomChannels: Map<string, RealtimeChannel> = new Map();
  private readonly authService: AuthService;

  private constructor() {
    this.authService = AuthService.getInstance();
  }

  static getInstance(): RoomService {
    if (!RoomService.instance) {
      RoomService.instance = new RoomService();
    }
    return RoomService.instance;
  }

  private isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please set up Supabase or use demo mode.');
    }
  }

  // Clean up inactive rooms (no activity for 2 hours)
  async cleanupInactiveRooms(): Promise<number> {
    if (!this.isConfigured()) return 0;
    
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase!
        .from('rooms')
        .delete()
        .lt('updated_at', twoHoursAgo)
        .select('room_number');
      
      if (error) {
        console.error('[RoomService] Cleanup failed:', error);
        return 0;
      }
      
      const count = data?.length || 0;
      if (count > 0) {
        console.log(`[RoomService] Cleaned up ${count} inactive rooms`);
      }
      return count;
    } catch (e) {
      console.error('[RoomService] Cleanup error:', e);
      return 0;
    }
  }

  async createRoom(roomNumber: string, room: Room): Promise<void> {
    this.ensureConfigured();
    await this.authService.waitForInit();
    
    // Clean up inactive rooms before creating new one (non-blocking)
    this.cleanupInactiveRooms().catch(() => {});
    
    const dbRoom = roomToDb(room);
    console.log('[RoomService] createRoom dbRoom:', JSON.stringify(dbRoom, null, 2));
    const { error } = await supabase!
      .from('rooms')
      .insert(dbRoom);
    
    if (error) {
      console.error('[RoomService] createRoom error:', error.code, error.message, error.details);
      throw error;
    }
    console.log('[RoomService] Room created successfully:', roomNumber);
  }

  async getRoom(roomNumber: string): Promise<Room | null> {
    this.ensureConfigured();
    const { data, error } = await safeQuery(
      () => Promise.resolve(supabase!
        .from('rooms')
        .select('*')
        .eq('room_number', roomNumber)
        .maybeSingle()),
      `getRoom(${roomNumber})`
    );
    
    if (error) {
      console.error('[RoomService] getRoom error:', error);
      return null;
    }
    if (!data) return null;
    return dbToRoom(data);
  }

  /**
   * V2: Atomic operation to mark a player as having viewed their role.
   * Uses atomic_field_update to partially update player data.
   */
  async markPlayerViewedRole(roomNumber: string, seatNumber: number): Promise<{
    success: boolean;
    alreadyViewed?: boolean;
    allViewed?: boolean;
    roomStatus?: number;
    error?: string;
  }> {
    this.ensureConfigured();
    
    // First get current player data
    const room = await this.getRoom(roomNumber);
    if (!room) {
      return { success: false, error: 'room_not_found' };
    }
    
    const player = room.players.get(seatNumber);
    if (!player) {
      return { success: false, error: 'player_not_found' };
    }
    
    if (player.hasViewedRole) {
      return { success: true, alreadyViewed: true };
    }
    
    // Update player with hasViewedRole = true
    const updatedPlayer = { ...player, hasViewedRole: true };
    
    const { data, error } = await safeRpc('atomic_field_update', {
      p_room_number: roomNumber,
      p_field: 'players',
      p_key: seatNumber.toString(),
      p_value: updatedPlayer,
    });
    
    if (error) {
      console.error('[RoomService] markPlayerViewedRole RPC error:', error);
      return { success: false, error: error.message };
    }
    
    if (!data?.success) {
      return { success: false, error: data?.error };
    }
    
    // Check if all players have viewed
    const updatedRoom = await this.getRoom(roomNumber);
    if (updatedRoom) {
      const allViewed = Array.from(updatedRoom.players.values())
        .filter(p => p !== null)
        .every(p => p?.hasViewedRole === true);
      
      if (allViewed && updatedRoom.roomStatus === 2) {
        // Advance to ready status
        await this.updateRoomStatus(roomNumber, 3, 2);
      }
      
      return { 
        success: true, 
        allViewed,
        roomStatus: allViewed ? 3 : updatedRoom.roomStatus,
      };
    }
    
    return { success: true };
  }

  async deleteRoom(roomNumber: string): Promise<void> {
    this.ensureConfigured();
    const { error } = await supabase!
      .from('rooms')
      .delete()
      .eq('room_number', roomNumber);
    
    if (error) throw error;
  }

  // ============================================
  // V2 RPC Methods for atomic game operations
  // ============================================

  /**
   * V2: Update room status atomically.
   */
  async updateRoomStatus(
    roomNumber: string,
    newStatus: number,
    expectedStatus?: number,
    hostUid?: string,
    resetFields: boolean = false
  ): Promise<{
    success: boolean;
    newStatus?: number;
    error?: string;
  }> {
    this.ensureConfigured();
    
    const { data, error } = await safeRpc('update_room_status', {
      p_room_number: roomNumber,
      p_new_status: newStatus,
      p_expected_status: expectedStatus ?? null,
      p_host_uid: hostUid ?? null,
      p_reset_fields: resetFields,
    });
    
    if (error) {
      console.error('[RoomService] updateRoomStatus RPC error:', error);
      return { success: false, error: error.message };
    }
    
    return {
      success: data?.success ?? false,
      newStatus: data?.new_status,
      error: data?.error,
    };
  }

  /**
   * V2: Proceed to next action in the game.
   * Uses advance_action_index for atomic index advancement.
   */
  async proceedAction(
    roomNumber: string,
    targetIndex: number | null = null,
    actionType: 'normal' | 'witch_save' | 'witch_poison' | 'witch_skip' | 'skip' = 'normal',
    expectedIndex?: number,
    currentRole?: RoleName
  ): Promise<{
    success: boolean;
    previousIndex?: number;
    newIndex?: number;
    error?: string;
  }> {
    this.ensureConfigured();
    
    // Build action data based on action type
    // For witch: target >= 0 means save, target < 0 means poison (encoded as -target-1)
    // This encoding is handled by the caller (RoomScreen)
    let actionData: { role: string; target: number } | null = null;
    
    if (actionType === 'witch_save' && targetIndex !== null) {
      // Save: store target as-is (positive number = saved player seat)
      actionData = { role: 'witch', target: targetIndex };
    } else if (actionType === 'witch_poison' && targetIndex !== null) {
      // Poison: encode as negative number (-target-1)
      actionData = { role: 'witch', target: -targetIndex - 1 };
    } else if (actionType === 'normal' && currentRole && targetIndex !== null) {
      actionData = { role: currentRole, target: targetIndex };
    }
    // For 'skip' and 'witch_skip', actionData remains null
    
    const { data, error } = await safeRpc('advance_action_index', {
      p_room_number: roomNumber,
      p_expected_index: expectedIndex ?? 0,
      p_action_data: actionData,
    });
    
    if (error) {
      console.error('[RoomService] proceedAction RPC error:', error);
      return { success: false, error: error.message };
    }
    
    // Handle already_advanced (idempotency for retries)
    if (data?.already_advanced) {
      console.log('[RoomService] proceedAction: already advanced, treating as success');
      return { success: true, newIndex: data.current_index };
    }
    
    console.log(`[RoomService] proceedAction result:`, data);
    return {
      success: data?.success ?? false,
      previousIndex: data?.previous_index,
      newIndex: data?.new_index,
      error: data?.error,
    };
  }

  /**
   * V2: Record a wolf's vote for their kill target.
   * Uses atomic_field_update for conflict-free voting.
   * Automatically advances when all wolves have voted.
   */
  async recordWolfVote(
    roomNumber: string,
    wolfSeat: number,
    targetSeat: number,  // -1 for 空刀
    wolfSeats: number[]  // Client provides list of all wolf seats
  ): Promise<{
    success: boolean;
    alreadyVoted?: boolean;
    allWolvesVoted?: boolean;
    newIndex?: number;
    voteCount?: number;
    totalWolves?: number;
    error?: string;
  }> {
    this.ensureConfigured();
    
    // Use atomic_field_update for conflict-free wolf voting
    const { data, error } = await safeRpc('atomic_field_update', {
      p_room_number: roomNumber,
      p_field: 'wolf_votes',
      p_key: wolfSeat.toString(),
      p_value: targetSeat,
    });
    
    if (error) {
      console.error('[RoomService] recordWolfVote RPC error:', error);
      return { success: false, error: error.message };
    }
    
    // Handle already_voted response
    if (data?.already_voted) {
      return { success: true, alreadyVoted: true };
    }
    
    if (!data?.success) {
      return { success: false, error: data?.error };
    }
    
    // Check if all wolves have voted
    const room = await this.getRoom(roomNumber);
    if (room) {
      const voteCount = room.wolfVotes.size;
      const totalWolves = wolfSeats.length;
      const allWolvesVoted = voteCount >= totalWolves;
      
      console.log(`[RoomService] recordWolfVote seat ${wolfSeat} -> ${targetSeat}: ${voteCount}/${totalWolves}`);
      
      if (allWolvesVoted) {
        // Calculate the final wolf target (majority vote)
        const voteCounts = new Map<number, number>();
        room.wolfVotes.forEach((target) => {
          voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
        });
        
        // Find the target with most votes
        let finalTarget = -1;
        let maxVotes = 0;
        voteCounts.forEach((count, target) => {
          if (count > maxVotes) {
            maxVotes = count;
            finalTarget = target;
          }
        });
        
        console.log(`[RoomService] Wolf final target: ${finalTarget} (votes: ${maxVotes})`);
        
        // Advance to next action with wolf's kill target
        const advanceResult = await this.proceedAction(
          roomNumber,
          finalTarget,
          'normal',
          room.currentActionerIndex,
          'wolf'
        );
        
        return {
          success: true,
          allWolvesVoted: true,
          newIndex: advanceResult.newIndex,
          voteCount,
          totalWolves,
        };
      }
      
      return {
        success: true,
        allWolvesVoted: false,
        voteCount,
        totalWolves,
      };
    }
    
    return { success: true };
  }

  /**
   * V2: Start the game. Only host can call this.
   */
  async startGame(
    roomNumber: string,
    hostUid: string
  ): Promise<{
    success: boolean;
    roomStatus?: number;
    error?: string;
  }> {
    this.ensureConfigured();
    
    // Use update_room_status to change from ready (3) to ongoing (4)
    const { data, error } = await safeRpc('update_room_status', {
      p_room_number: roomNumber,
      p_new_status: 4,  // ongoing
      p_expected_status: 3,  // ready
      p_host_uid: hostUid,
      p_reset_fields: false,
    });
    
    if (error) {
      console.error('[RoomService] startGame RPC error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[RoomService] startGame result:', data);
    return {
      success: data?.success ?? false,
      roomStatus: data?.new_status,
      error: data?.error,
    };
  }

  /**
   * V2: Take a seat in the room using atomic_field_update.
   */
  async takeSeat(
    roomNumber: string,
    seatNumber: number,
    uid: string,
    displayName?: string,
    avatarUrl?: string
  ): Promise<{
    success: boolean;
    alreadySeated?: boolean;
    allSeated?: boolean;
    seatedCount?: number;
    totalSeats?: number;
    error?: string;
  }> {
    this.ensureConfigured();
    
    const playerData = {
      uid,
      seatNumber,
      role: null,
      status: 'alive',
      skillStatus: 'not_used',
      hasViewedRole: false,
      displayName: displayName ?? null,
      avatarUrl: avatarUrl ?? null,
    };
    
    const { data, error } = await safeRpc('atomic_field_update', {
      p_room_number: roomNumber,
      p_field: 'players',
      p_key: seatNumber.toString(),
      p_value: playerData,
    });
    
    if (error) {
      console.error('[RoomService] takeSeat RPC error:', error);
      return { success: false, error: error.message };
    }
    
    if (!data?.success) {
      if (data?.error === 'already_taken') {
        return { success: false, alreadySeated: true, error: 'seat_taken' };
      }
      return { success: false, error: data?.error };
    }
    
    // Check if all seats are filled
    const room = await this.getRoom(roomNumber);
    if (room) {
      const seatedCount = Array.from(room.players.values()).filter(p => p !== null).length;
      const totalSeats = room.template.numberOfPlayers;
      const allSeated = seatedCount >= totalSeats;
      
      if (allSeated && room.roomStatus === 0) {
        // Advance to seated status
        await this.updateRoomStatus(roomNumber, 1, 0);
      }
      
      console.log(`[RoomService] takeSeat ${seatNumber}: ${seatedCount}/${totalSeats}`);
      return {
        success: true,
        allSeated,
        seatedCount,
        totalSeats,
      };
    }
    
    return { success: true };
  }

  /**
   * V2: Leave a seat in the room using remove_field_key.
   */
  async leaveSeat(
    roomNumber: string,
    seatNumber: number,
    uid: string
  ): Promise<{
    success: boolean;
    alreadyEmpty?: boolean;
    error?: string;
  }> {
    this.ensureConfigured();
    
    // First verify the player in this seat is the one leaving
    const room = await this.getRoom(roomNumber);
    if (room) {
      const player = room.players.get(seatNumber);
      if (!player) {
        return { success: true, alreadyEmpty: true };
      }
      if (player.uid !== uid) {
        return { success: false, error: 'not_your_seat' };
      }
    }
    
    const { data, error } = await safeRpc('remove_field_key', {
      p_room_number: roomNumber,
      p_field: 'players',
      p_key: seatNumber.toString(),
    });
    
    if (error) {
      console.error('[RoomService] leaveSeat RPC error:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`[RoomService] leaveSeat ${seatNumber}:`, data);
    return {
      success: data?.success ?? false,
      error: data?.error,
    };
  }

  /**
   * V2: Restart the game. Only host can call this.
   * Uses update_room_status with reset_fields=true.
   */
  async restartGame(
    roomNumber: string,
    hostUid: string
  ): Promise<{
    success: boolean;
    roomStatus?: number;
    error?: string;
  }> {
    this.ensureConfigured();
    
    // Use update_room_status with reset_fields=true to reset game state
    // Status 1 = seated (players are still in their seats, waiting for "准备看牌")
    const { data, error } = await safeRpc('update_room_status', {
      p_room_number: roomNumber,
      p_new_status: 1,  // seated (players still in seats)
      p_expected_status: null,  // Any status
      p_host_uid: hostUid,
      p_reset_fields: true,  // Reset all game fields
    });
    
    if (error) {
      console.error('[RoomService] restartGame RPC error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[RoomService] restartGame result:', data);
    return {
      success: data?.success ?? false,
      roomStatus: data?.new_status,
      error: data?.error,
    };
  }

  /**
   * V2: Assign roles to players.
   * Uses batch_update_players for atomic role assignment.
   */
  async assignRoles(
    roomNumber: string,
    hostUid: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    this.ensureConfigured();
    
    // Get room and shuffle roles on client side
    const room = await this.getRoom(roomNumber);
    if (!room) {
      return { success: false, error: 'room_not_found' };
    }
    
    const roles = [...room.template.roles];
    // Fisher-Yates shuffle
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    
    // Build updates object
    const updates: Record<string, any> = {};
    room.players.forEach((player, seat) => {
      if (player) {
        updates[seat.toString()] = {
          ...player,
          role: roles[seat],
        };
      }
    });
    
    const { data, error } = await safeRpc('batch_update_players', {
      p_room_number: roomNumber,
      p_players: updates,
      p_host_uid: hostUid,
    });
    
    if (error) {
      console.error('[RoomService] assignRoles RPC error:', error);
      return { success: false, error: error.message };
    }
    
    if (!data?.success) {
      return { success: false, error: data?.error };
    }
    
    // Update room status to assigned (2)
    await this.updateRoomStatus(roomNumber, 2, 1, hostUid);
    
    return { success: true };
  }

  /**
   * V2: Update room template (roles array).
   */
  async updateRoomTemplate(
    roomNumber: string,
    hostUid: string,
    roles: RoleName[]
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    this.ensureConfigured();
    
    const { data, error } = await safeRpc('update_roles_array', {
      p_room_number: roomNumber,
      p_roles: roles,
      p_host_uid: hostUid,
    });
    
    if (error) {
      console.error('[RoomService] updateRoomTemplate RPC error:', error);
      return { success: false, error: error.message };
    }
    
    return {
      success: data?.success ?? false,
      error: data?.error,
    };
  }

  // Real-time subscription
  subscribeToRoom(
    roomNumber: string,
    callback: (room: Room | null) => void
  ): () => void {
    if (!this.isConfigured()) {
      console.warn('Supabase not configured, subscription not available');
      return () => {};
    }

    // First, get the current room state
    this.getRoom(roomNumber).then(room => {
      callback(room);
    });

    // Set up real-time subscription
    const channel = supabase!
      .channel(`room:${roomNumber}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `room_number=eq.${roomNumber}`,
        },
        (payload: RealtimePostgresChangesPayload<DbRoom>) => {
          if (payload.eventType === 'DELETE') {
            callback(null);
          } else if (payload.new) {
            callback(dbToRoom(payload.new));
          }
        }
      )
      .subscribe();

    this.roomChannels.set(roomNumber, channel);

    return () => {
      const ch = this.roomChannels.get(roomNumber);
      if (ch && supabase) {
        supabase.removeChannel(ch);
        this.roomChannels.delete(roomNumber);
      }
    };
  }

  async roomExists(roomNumber: string): Promise<boolean> {
    this.ensureConfigured();
    const { data } = await supabase!
      .from('rooms')
      .select('room_number')
      .eq('room_number', roomNumber)
      .single();
    
    return !!data;
  }

  async generateRoomNumber(): Promise<string> {
    let roomNumber: string;
    let exists = true;
    
    while (exists) {
      roomNumber = Math.floor(1000 + Math.random() * 9000).toString();
      exists = await this.roomExists(roomNumber);
    }
    
    return roomNumber!;
  }

  // Save/get last room from local storage
  async saveLastRoom(roomNumber: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('werewolf_last_room', roomNumber);
    }
  }

  async getLastRoom(): Promise<string | null> {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('werewolf_last_room');
    }
    return null;
  }

  /**
   * V2: Set audio playing state.
   * Uses update_room_scalar RPC for atomic update.
   */
  async setAudioPlaying(
    roomNumber: string,
    isPlaying: boolean
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    this.ensureConfigured();
    
    const { data, error } = await supabase!
      .rpc('update_room_scalar', {
        p_room_number: roomNumber,
        p_field: 'is_audio_playing',
        p_value: isPlaying,
        p_expected_value: null,
      });
    
    if (error) {
      console.error('[RoomService] setAudioPlaying RPC error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[RoomService] setAudioPlaying result:', data);
    return {
      success: data?.success ?? false,
      error: data?.error,
    };
  }

  /**
   * V2: Update room template (roles array).
   * Uses update_roles_array RPC for atomic update.
   * Only host can call this.
   */
  async updateRolesArray(
    roomNumber: string,
    roles: string[],
    hostUid: string
  ): Promise<{
    success: boolean;
    rolesCount?: number;
    error?: string;
  }> {
    this.ensureConfigured();
    
    const { data, error } = await supabase!
      .rpc('update_roles_array', {
        p_room_number: roomNumber,
        p_roles: roles,
        p_host_uid: hostUid,
      });
    
    if (error) {
      console.error('[RoomService] updateRolesArray RPC error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[RoomService] updateRolesArray result:', data);
    return {
      success: data?.success ?? false,
      rolesCount: data?.roles_count,
      error: data?.error,
    };
  }

  /**
   * V2: Batch update players.
   * Uses batch_update_players RPC for atomic bulk player updates.
   */
  async batchUpdatePlayers(
    roomNumber: string,
    updates: Record<string, {
      uid: string;
      displayName?: string;
      avatarUrl?: string;
      role?: string | null;
    }>,
    hostUid: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    this.ensureConfigured();
    
    // Convert updates to proper player format
    const playerUpdates: Record<string, object> = {};
    Object.entries(updates).forEach(([seatNumber, playerData]) => {
      playerUpdates[seatNumber] = {
        uid: playerData.uid,
        seatNumber: Number.parseInt(seatNumber, 10),
        role: playerData.role ?? null,
        status: 'alive',
        skillStatus: 'not_used',
        hasViewedRole: false,
        displayName: playerData.displayName ?? null,
        avatarUrl: playerData.avatarUrl ?? null,
      };
    });
    
    const { data, error } = await supabase!
      .rpc('batch_update_players', {
        p_room_number: roomNumber,
        p_players: playerUpdates,
        p_host_uid: hostUid,
      });
    
    if (error) {
      console.error('[RoomService] batchUpdatePlayers RPC error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[RoomService] batchUpdatePlayers result:', data);
    return {
      success: data?.success ?? false,
      error: data?.error,
    };
  }
}

export default RoomService;
