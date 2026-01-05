import { supabase, isSupabaseConfigured } from '../config/supabase';
import { Room, RoomStatus } from '../models/Room';
import { Player, createPlayer } from '../models/Player';
import { RoleName, ACTION_ORDER, ROLES } from '../constants/roles';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
        role: player.role,  // Store role name directly
        status: player.status,
        skillStatus: player.skillStatus,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
      };
    } else {
      // Explicitly set null to clear the seat in database
      playersMap[seat.toString()] = null;
    }
  });

  const actionsMap: Record<string, number> = {};
  room.actions.forEach((target, role) => {
    actionsMap[role] = target;  // Use role name as key directly
  });

  const wolfVotesMap: Record<string, number> = {};
  room.wolfVotes.forEach((target, wolfSeat) => {
    wolfVotesMap[wolfSeat.toString()] = target;
  });

  return {
    room_number: room.roomNumber,
    host_uid: room.hostUid,
    room_status: room.roomStatus,
    roles: room.template.roles,  // Store role names directly
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
      const seat = parseInt(seatStr);
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
    actions.set(roleName as RoleName, target as number);
  });

  const wolfVotes = new Map<number, number>();
  Object.entries(dbRoom.wolf_votes || {}).forEach(([wolfSeatStr, target]) => {
    wolfVotes.set(parseInt(wolfSeatStr), target as number);
  });

  // Generate action order from roles
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

export class SupabaseService {
  private static instance: SupabaseService;
  private currentUserId: string | null = null;
  private roomChannels: Map<string, RealtimeChannel> = new Map();
  private initPromise: Promise<void> | null = null;

  private constructor() {
    // Auto-initialize auth
    this.initPromise = this.autoSignIn();
  }

  private async autoSignIn(): Promise<void> {
    if (!this.isConfigured()) return;
    
    try {
      // Try to restore existing session first
      const existingUserId = await this.initAuth();
      if (existingUserId) {
        console.log('[SupabaseService] Restored session:', existingUserId);
        return;
      }
      
      // Otherwise sign in anonymously
      const userId = await this.signInAnonymously();
      console.log('[SupabaseService] Auto signed in anonymously:', userId);
    } catch (error) {
      console.error('[SupabaseService] Auto sign in failed:', error);
    }
  }

  // Wait for initialization to complete
  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Generate a random display name based on user ID hash
  private generateDisplayName(uid: string): string {
    const adjectives = [
      // 性格特征
      '快乐', '勇敢', '聪明', '神秘', '可爱', '酷炫', '狡猾', '正义',
      '机智', '沉稳', '热血', '冷静', '傲娇', '呆萌', '腹黑', '高冷',
      '温柔', '霸气', '淡定', '暴躁', '憨厚', '精明', '天真', '老练',
      // 状态描述
      '迷糊', '清醒', '困倦', '亢奋', '悠闲', '忙碌', '饥饿', '满足',
      '微醺', '元气', '慵懒', '活泼', '安静', '躁动', '专注', '发呆',
      // 风格类型
      '优雅', '野性', '文艺', '朋克', '复古', '未来', '古典', '摇滚',
      '甜美', '辛辣', '清新', '浓郁', '梦幻', '现实', '浪漫', '理性',
      // 程度副词
      '超级', '无敌', '绝世', '传说', '史诗', '究极', '至尊', '王者',
    ];
    // 从 ROLES 常量中获取所有角色的 displayName
    const nouns = Object.values(ROLES).map((role) => role.displayName);
    
    // 使用多种哈希方式生成更随机的组合
    const chars = uid.split('');
    const hash1 = chars.reduce((acc, char, i) => acc + (char.codePointAt(0) || 0) * (i + 1), 0);
    const hash2 = chars.reduce((acc, char, i) => acc + (char.codePointAt(0) || 0) * (i + 7), 0);
    const hash3 = chars.reduce((acc, char) => acc ^ (char.codePointAt(0) || 0), 0) * 31;
    
    const idx1 = Math.abs(hash1) % adjectives.length;
    let idx2 = Math.abs(hash2) % adjectives.length;
    // 确保两个形容词不同
    if (idx1 === idx2) {
      idx2 = (idx2 + 1) % adjectives.length;
    }
    const idx3 = Math.abs(hash3) % nouns.length;
    
    return adjectives[idx1] + adjectives[idx2] + nouns[idx3];
  }

  // Get current user's display name (registered name or generated fallback)
  private async getCurrentDisplayName(): Promise<string> {
    if (!this.isConfigured()) {
      return this.generateDisplayName(this.currentUserId || 'anonymous');
    }
    
    try {
      const { data } = await supabase!.auth.getUser();
      const registeredName = data.user?.user_metadata?.display_name;
      if (registeredName) {
        return registeredName;
      }
    } catch {
      // Fall through to generated name
    }
    
    return this.generateDisplayName(this.currentUserId || 'anonymous');
  }

  // Get current user's avatar URL from user metadata
  private async getCurrentAvatarUrl(): Promise<string | null> {
    if (!this.isConfigured()) {
      console.log('[getCurrentAvatarUrl] Supabase not configured');
      return null;
    }
    
    try {
      const { data } = await supabase!.auth.getUser();
      const avatarUrl = data.user?.user_metadata?.avatar_url || null;
      console.log('[getCurrentAvatarUrl] user_metadata:', data.user?.user_metadata);
      console.log('[getCurrentAvatarUrl] avatarUrl:', avatarUrl);
      return avatarUrl;
    } catch (err) {
      console.log('[getCurrentAvatarUrl] Error:', err);
      return null;
    }
  }

  // Check if Supabase is configured
  isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please set up Supabase or use demo mode.');
    }
  }

  // Auth methods
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  getCurrentUser() {
    if (!this.isConfigured()) return null;
    return supabase!.auth.getUser();
  }

  async signInAnonymously(): Promise<string> {
    this.ensureConfigured();
    const { data, error } = await supabase!.auth.signInAnonymously();
    if (error) throw error;
    this.currentUserId = data.user?.id || null;
    return this.currentUserId || '';
  }

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<{ userId: string; user: any }> {
    this.ensureConfigured();
    const { data, error } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
        },
        // No email confirmation required
        emailRedirectTo: undefined,
      },
    });
    if (error) throw error;
    this.currentUserId = data.user?.id || null;
    
    // Return both userId and user object for immediate use
    return { 
      userId: this.currentUserId || '', 
      user: data.user 
    };
  }

  async signInWithEmail(email: string, password: string): Promise<string> {
    this.ensureConfigured();
    const { data, error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    this.currentUserId = data.user?.id || null;
    return this.currentUserId || '';
  }

  async updateProfile(updates: { displayName?: string; avatarUrl?: string }): Promise<void> {
    this.ensureConfigured();
    const { error } = await supabase!.auth.updateUser({
      data: {
        display_name: updates.displayName,
        avatar_url: updates.avatarUrl,
      },
    });
    if (error) throw error;
  }

  async uploadAvatar(fileUri: string): Promise<string> {
    this.ensureConfigured();
    if (!this.currentUserId) throw new Error('Not authenticated');

    // Compress image before upload (512x512 for crisp display on high-DPI screens)
    const compressedBlob = await this.compressImage(fileUri, 512, 0.85);
    
    const fileExt = 'jpg';
    const fileName = `${this.currentUserId}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase!.storage
      .from('avatars')
      .upload(fileName, compressedBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: urlData } = supabase!.storage
      .from('avatars')
      .getPublicUrl(data.path);
    
    // Update user profile with avatar URL
    await this.updateProfile({ avatarUrl: urlData.publicUrl });
    
    return urlData.publicUrl;
  }

  // Compress image to reduce file size while maintaining quality
  private async compressImage(
    fileUri: string, 
    maxSize: number = 512, 
    quality: number = 0.85
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // Calculate new dimensions (max 512x512 for avatar, crisp on retina displays)
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`[SupabaseService] Compressed image: ${Math.round(blob.size / 1024)}KB`);
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = fileUri;
    });
  }

  async signOut(): Promise<void> {
    this.ensureConfigured();
    await supabase!.auth.signOut();
    this.currentUserId = null;
  }

  async initAuth(): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const { data: { session } } = await supabase!.auth.getSession();
    if (session?.user) {
      this.currentUserId = session.user.id;
      return this.currentUserId;
    }
    return null;
  }

  // Room methods
  
  // Clean up inactive rooms (no activity for 2 hours)
  async cleanupInactiveRooms(): Promise<number> {
    if (!this.isConfigured()) return 0;
    
    try {
      // Rooms with no activity (updated_at) for 2 hours are considered inactive
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase!
        .from('rooms')
        .delete()
        .lt('updated_at', twoHoursAgo)
        .select('room_number');
      
      if (error) {
        console.error('[SupabaseService] Cleanup failed:', error);
        return 0;
      }
      
      const count = data?.length || 0;
      if (count > 0) {
        console.log(`[SupabaseService] Cleaned up ${count} inactive rooms`);
      }
      return count;
    } catch (e) {
      console.error('[SupabaseService] Cleanup error:', e);
      return 0;
    }
  }

  async createRoom(roomNumber: string, room: Room): Promise<void> {
    this.ensureConfigured();
    await this.waitForInit(); // Wait for auth to complete
    
    // Clean up inactive rooms before creating new one (non-blocking)
    this.cleanupInactiveRooms().catch(() => {});
    
    const dbRoom = roomToDb(room);
    console.log('[SupabaseService] createRoom dbRoom:', JSON.stringify(dbRoom, null, 2));
    const { error } = await supabase!
      .from('rooms')
      .insert(dbRoom);
    
    if (error) {
      console.error('[SupabaseService] createRoom error:', error.code, error.message, error.details);
      throw error;
    }
    console.log('[SupabaseService] Room created successfully:', roomNumber);
  }

  async getRoom(roomNumber: string): Promise<Room | null> {
    this.ensureConfigured();
    const { data, error } = await supabase!
      .from('rooms')
      .select('*')
      .eq('room_number', roomNumber)
      .maybeSingle();
    
    if (error) {
      console.error('[SupabaseService] getRoom error:', error);
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
            callback(dbToRoom(payload.new as DbRoom));
          }
        }
      )
      .subscribe();

    this.roomChannels.set(roomNumber, channel);

    // Return unsubscribe function
    return () => {
      const ch = this.roomChannels.get(roomNumber);
      if (ch && supabase) {
        supabase.removeChannel(ch);
        this.roomChannels.delete(roomNumber);
      }
    };
  }

  // Seat management
  async takeSeat(
    roomNumber: string,
    seatIndex: number,
    currentSeat: number | null
  ): Promise<number> {
    await this.waitForInit(); // Wait for auth to complete
    console.log('[SupabaseService] takeSeat called:', { roomNumber, seatIndex, currentSeat, userId: this.currentUserId });
    
    const room = await this.getRoom(roomNumber);
    if (!room) {
      console.log('[SupabaseService] Room not found');
      return -1;
    }

    // Check if seat is taken by someone else
    const existingPlayer = room.players.get(seatIndex);
    if (existingPlayer && existingPlayer.uid !== this.currentUserId) {
      console.log('[SupabaseService] Seat taken by someone else:', existingPlayer.uid);
      return -1;
    }

    // Get the role for this seat
    const role = room.template.roles[seatIndex];
    if (!role) {
      console.log('[SupabaseService] No role for seat:', seatIndex);
      return -1;
    }

    // Create new player
    const userId = this.currentUserId || 'anonymous';
    const newPlayer = createPlayer(userId, seatIndex, role);
    // Use the user's registered display name and avatar
    newPlayer.displayName = await this.getCurrentDisplayName();
    newPlayer.avatarUrl = await this.getCurrentAvatarUrl();
    console.log('[SupabaseService] takeSeat - newPlayer:', {
      uid: newPlayer.uid,
      displayName: newPlayer.displayName,
      avatarUrl: newPlayer.avatarUrl,
    });

    // Update players map
    const newPlayers = new Map(room.players);
    if (currentSeat !== null && currentSeat !== seatIndex) {
      console.log('[SupabaseService] Leaving current seat:', currentSeat);
      newPlayers.set(currentSeat, null);
    }
    newPlayers.set(seatIndex, newPlayer);
    
    console.log('[SupabaseService] New players map:');
    newPlayers.forEach((p, seat) => {
      console.log(`  Seat ${seat}:`, p ? p.uid : 'null');
    });

    // Update room
    const updatedRoom = { ...room, players: newPlayers };
    await this.updateRoom(roomNumber, updatedRoom);
    
    console.log('[SupabaseService] Room updated successfully');
    return 0;
  }

  async leaveSeat(roomNumber: string, seatIndex: number): Promise<void> {
    const room = await this.getRoom(roomNumber);
    if (!room) return;

    const newPlayers = new Map(room.players);
    newPlayers.set(seatIndex, null);

    const updatedRoom = { ...room, players: newPlayers };
    await this.updateRoom(roomNumber, updatedRoom);
  }

  // Room existence check
  async roomExists(roomNumber: string): Promise<boolean> {
    this.ensureConfigured();
    const { data } = await supabase!
      .from('rooms')
      .select('room_number')
      .eq('room_number', roomNumber)
      .single();
    
    return !!data;
  }

  // Generate unique room number
  async generateRoomNumber(): Promise<string> {
    let roomNumber: string;
    let exists = true;
    
    while (exists) {
      roomNumber = Math.floor(1000 + Math.random() * 9000).toString();
      exists = await this.roomExists(roomNumber);
    }
    
    return roomNumber!;
  }

  // Fill ALL seats with bots (for testing mode)
  // Host acts as moderator/observer, not as a player
  async fillWithBots(roomNumber: string): Promise<number> {
    const room = await this.getRoom(roomNumber);
    if (!room) return 0;

    const newPlayers = new Map<number, Player>();
    let filledCount = 0;

    // Fill ALL seats with bots - host is moderator, not a player
    room.template.roles.forEach((role, index) => {
      const botId = `bot_${index}_${Math.random().toString(36).substring(2, 8)}`;
      const botPlayer = createPlayer(botId, index, role);
      botPlayer.displayName = this.generateDisplayName(botId);
      newPlayers.set(index, botPlayer);
      filledCount++;
    });

    const updatedRoom = { ...room, players: newPlayers };
    await this.updateRoom(roomNumber, updatedRoom);
    
    console.log(`[SupabaseService] Test mode: filled all ${filledCount} seats with bots, host is moderator`);
    return filledCount;
  }

  // Update a single player seat
  async updatePlayerSeat(
    roomNumber: string,
    seatIndex: number,
    player: Player | null
  ): Promise<void> {
    const room = await this.getRoom(roomNumber);
    if (!room) return;

    const newPlayers = new Map(room.players);
    newPlayers.set(seatIndex, player);

    const updatedRoom = { ...room, players: newPlayers };
    await this.updateRoom(roomNumber, updatedRoom);
  }

  // Save last room to local storage
  async saveLastRoom(roomNumber: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('werewolf_last_room', roomNumber);
    }
  }

  // Get last room from local storage
  async getLastRoom(): Promise<string | null> {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('werewolf_last_room');
    }
    return null;
  }
}

export default SupabaseService;
