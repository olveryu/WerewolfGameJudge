import { supabase, isSupabaseConfigured } from '../config/supabase';
import { Room, RoomStatus } from '../models/Room';
import { Player } from '../models/Player';
import { RoleName, ACTION_ORDER } from '../constants/roles';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { AuthService } from './AuthService';

// Database types for Supabase
interface DbRoom {
  room_number: string;
  host_uid: string;
  room_status: number;
  roles: string[];  // RoleName strings
  players: Record<string, any>;
  actions: Record<string, number>;  // RoleName -> target
  wolf_votes: Record<string, number>;
  current_actioner_index: number;
  has_poison: boolean;
  has_antidote: boolean;
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
    has_poison: room.hasPoison,
    has_antidote: room.hasAntidote,
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
      const role = playerData.role as RoleName;
      if (role) {
        players.set(seat, {
          uid: playerData.uid,
          seatNumber: playerData.seatNumber,
          role,
          status: playerData.status,
          skillStatus: playerData.skillStatus,
          displayName: playerData.displayName,
          avatarUrl: playerData.avatarUrl,
        });
      }
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
    hasPoison: dbRoom.has_poison,
    hasAntidote: dbRoom.has_antidote,
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
    const { data, error } = await supabase!
      .from('rooms')
      .select('*')
      .eq('room_number', roomNumber)
      .maybeSingle();
    
    if (error) {
      console.error('[RoomService] getRoom error:', error);
      return null;
    }
    if (!data) return null;
    return dbToRoom(data);
  }

  async updateRoom(roomNumber: string, room: Room): Promise<void> {
    this.ensureConfigured();
    const dbRoom = roomToDb(room);
    const { error } = await supabase!
      .from('rooms')
      .update(dbRoom)
      .eq('room_number', roomNumber);
    
    if (error) throw error;
  }

  async deleteRoom(roomNumber: string): Promise<void> {
    this.ensureConfigured();
    const { error } = await supabase!
      .from('rooms')
      .delete()
      .eq('room_number', roomNumber);
    
    if (error) throw error;
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
}

export default RoomService;
