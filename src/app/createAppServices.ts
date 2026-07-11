/** Application composition root for infrastructure and the registered Werewolf game module. */

import {
  WEREWOLF_STATE_CODEC,
  type WerewolfPublicCommand,
} from '@werewolf/game-engine/games/werewolf/public';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { newRequestId } from '@werewolf/game-engine/utils/id';

import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { RoomSession } from '@/features/room/session/RoomSession';
import {
  WEREWOLF_USER_EVENT_CODEC,
  type WerewolfUserEvent,
} from '@/games/werewolf/realtime/werewolfUserEventCodec';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { WerewolfGameFacade } from '@/games/werewolf/runtime/WerewolfGameFacade';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFRealtimeService } from '@/services/cloudflare/CFRealtimeService';
import { CFRoomDirectoryService } from '@/services/cloudflare/CFRoomDirectoryService';
import { CFRoomStateService } from '@/services/cloudflare/CFRoomStateService';
import { CFStorageService } from '@/services/cloudflare/CFStorageService';
import { SettingsService } from '@/services/feature/SettingsService';
import { AudioService } from '@/services/infra/AudioService';
import { log } from '@/utils/logger';

export function createAppServices(): {
  readonly services: ServiceContextValue;
  readonly werewolfClient: WerewolfGameClient;
} {
  const authService = new CFAuthService();
  const roomDirectory = new CFRoomDirectoryService();
  const roomStateService = new CFRoomStateService<GameState>(WEREWOLF_STATE_CODEC);
  const settingsService = new SettingsService();
  const audioService = new AudioService();
  const avatarUploadService = new CFStorageService();
  const transport = new CFRealtimeService<GameState, WerewolfUserEvent>(
    WEREWOLF_STATE_CODEC,
    WEREWOLF_USER_EVENT_CODEC,
  );

  const services: ServiceContextValue = {
    authService,
    roomDirectory,
    settingsService,
    audioService,
    avatarUploadService,
  };

  const roomSession = new RoomSession<GameState, WerewolfPublicCommand, WerewolfUserEvent>({
    codec: WEREWOLF_STATE_CODEC,
    stateService: roomStateService,
    transport,
    createCommandId: newRequestId,
  });

  const werewolfClient = new WerewolfGameFacade({ roomSession, audioService });
  log.info('[init] All services created');
  return { services, werewolfClient };
}
