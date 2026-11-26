import {
  type SecrethitlerCommand,
  secrethitlerEngine,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { ServiceContextValue } from '@/contexts/ServiceContext';
import type { SecrethitlerAudioRuntime } from '@/games/secrethitler/audio/secrethitlerAudioRuntime';
import { createInboxWakeSignal } from '@/platform/inbox/inboxWake';
import type { LinkSnapshot, RoomIdentity, RoomLink } from '@/platform/realtime/types';
import type { AuthUser, IAuthService } from '@/services/types/IAuthService';

const unavailable = async (): Promise<never> => {
  throw new Error('此操作不支持离线预览');
};

/** Provides a fictional identity without reading or writing a real account. */
export function createPreviewServices(userId: string): ServiceContextValue {
  const user: AuthUser = {
    id: userId,
    email: null,
    is_anonymous: true,
    has_wechat: false,
    user_metadata: {
      display_name: userId === 'host' ? '房主' : userId === 'u1' ? '小明' : '预览玩家',
      avatar_url: null,
      custom_avatar_url: null,
      avatar_frame: null,
      seat_flair: null,
      name_style: null,
      equipped_effect: null,
      seat_animation: null,
    },
  };
  const authSession = { userId, initialUser: user };
  const authService: IAuthService = {
    getAuthSession: () => authSession,
    subscribeAuth: () => () => undefined,
    waitForInit: async () => undefined,
    needsWechatLogin: false,
    ensureAuthenticated: async () => userId,
    isConfigured: () => true,
    getCurrentUserId: () => userId,
    getCurrentUser: async () => ({ data: { user } }),
    signInAnonymously: unavailable,
    signUpWithEmail: unavailable,
    signInWithEmail: unavailable,
    updateProfile: unavailable,
    signOut: unavailable,
    changePassword: unavailable,
    forgotPassword: unavailable,
    resetPassword: unavailable,
    initAuth: async () => userId,
    onAuthExpired: () => () => undefined,
  };
  return {
    authService,
    roomDirectory: { createRoom: unavailable, getRoom: unavailable },
    roomCreator: { createRoom: unavailable },
    loadRoomLinks: unavailable,
    releaseRoomLinksOutside: () => undefined,
    loadAudioService: unavailable,
    avatarUploadService: { uploadAvatar: unavailable },
    inboxWakes: createInboxWakeSignal(),
  };
}

/** Keeps all room commands in memory and applies the same engine decisions as a real room. */
export function createPreviewRoomLink(
  initialState: SecrethitlerState,
  identity: RoomIdentity<'secrethitler'>,
): RoomLink<SecrethitlerState, SecrethitlerCommand> {
  let snapshot: LinkSnapshot<SecrethitlerState> = {
    phase: 'ready',
    epoch: 1,
    identity,
    status: { kind: 'live' },
    room: createRoomSnapshot(initialState, 1),
    lastCommand: null,
    pendingDurableCount: 0,
  };
  let counter = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect: async () => undefined,
    retryNow: () => undefined,
    close: () => undefined,
    dispatch: async (command, options) => {
      if (snapshot.phase !== 'ready') throw new Error('预览房间未就绪');
      const commandId = `preview-${++counter}`;
      const decision = secrethitlerEngine.decide(snapshot.room.state, command, {
        actor: { kind: 'user', userId: identity.userId },
        controlledSeat: options.controlledSeat,
        nowMs: Date.now(),
        commandId,
        randomSeed: commandId,
      });
      if (decision.kind === 'reject')
        return { kind: 'rejected', commandId, reason: decision.reason };
      const state = decision.events.reduce(secrethitlerEngine.evolve, snapshot.room.state);
      const room = createRoomSnapshot(state, snapshot.room.revision + 1);
      snapshot = {
        ...snapshot,
        room,
        lastCommand: { revision: room.revision, type: command.type },
      };
      for (const listener of listeners) listener();
      return { kind: 'committed', commandId, snapshot: room, outcome: decision.outcome };
    },
  };
}

/** Preview audio never plays media or contacts an external service. */
export const previewAudio: SecrethitlerAudioRuntime = {
  playEffect: async () => undefined,
  preload: () => undefined,
  stopNarration: () => undefined,
  stopBgm: () => undefined,
  startBgm: () => undefined,
  isBgmPlaying: () => false,
  subscribeBgm: () => () => undefined,
  setBgmVolume: () => undefined,
  setGameAudioVolume: () => undefined,
};
