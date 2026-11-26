/**
 * Toolbox guidance matrix: every (phase × viewer) cell is held true against
 * createToolboxRoomShellModel for the viewer's projected view.
 */
import {
  DEFAULT_TOOLBOX_CONFIG,
  type ToolboxView,
} from '@game-judge/game-engine/games/toolbox/public';

import type { RoomViewerAudience } from '@/features/room/model/RoomViewer';

import { TOOLBOX_GUIDANCE_MATRIX } from '../toolboxGuidanceMatrix';
import { createToolboxCapabilities, createToolboxRoomShellModel } from '../toolboxRoomAdapter';

function viewFor(phase: ToolboxView['phase']['kind'], audience: RoomViewerAudience): ToolboxView {
  const viewerUserId = audience === 'host' ? 'host' : 'guest';
  const isParticipant = audience !== 'spectator';
  const base = {
    gameType: 'toolbox' as const,
    roomCode: '1234',
    hostUserId: 'host',
    viewerUserId,
    isViewerMember: true,
    memberCount: 3,
    config: DEFAULT_TOOLBOX_CONFIG,
    configVersion: 1,
  };
  if (phase === 'preparing') {
    return {
      ...base,
      phase: { kind: 'preparing', seatedCount: 2, isViewerSeated: isParticipant },
    };
  }
  return {
    ...base,
    phase: {
      kind: 'active',
      sessionId: 'session',
      participantCount: 2,
      identity: null,
      participation: isParticipant
        ? { kind: 'participant', dice: null, hand: null }
        : { kind: 'spectator' },
    },
  };
}

function bottomMessage(view: ToolboxView): string | null {
  const capabilities = createToolboxCapabilities({
    view,
    configureGame: vi.fn(),
    canViewProfiles: { isAllowed: true, execute: vi.fn() },
    shareRoom: vi.fn(),
  });
  const model = createToolboxRoomShellModel({
    roomCode: '1234',
    isSubmitting: false,
    pendingActionKey: null,
    capabilities,
    onBack: vi.fn(),
    onTitlePress: vi.fn(),
    onTitleLongPress: vi.fn(),
    user: { id: view.viewerUserId, avatarUrl: null },
    gachaStatus: null,
    onUserActionPress: vi.fn(),
    connection: { status: { kind: 'live' }, pendingDurableCount: 0, onRetryNow: vi.fn() },
    share: {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.test/1234',
      open: vi.fn(),
      close: vi.fn(),
      copyLink: vi.fn(async () => undefined),
      shareImage: vi.fn(async () => undefined),
    },
    view,
    playerActions: [],
    profileSelection: null,
    onProfileClose: vi.fn(),
    buildHostManagement: () => ({ task: null, actions: [] }),
  });
  return model.playerActions.message;
}

describe('TOOLBOX_GUIDANCE_MATRIX', () => {
  const cells = Object.entries(TOOLBOX_GUIDANCE_MATRIX).flatMap(([phase, row]) =>
    Object.entries(row).map(([audience, cell]) => ({ phase, audience, cell })),
  );

  it.each(cells)('$phase × $audience matches the bottom panel', ({ phase, audience, cell }) => {
    if (phase !== 'preparing' && phase !== 'active') throw new Error(`unknown phase ${phase}`);
    if (audience !== 'host' && audience !== 'seated' && audience !== 'spectator') {
      throw new Error(`unknown audience ${audience}`);
    }
    const message = bottomMessage(viewFor(phase, audience));
    if (cell.kind === 'message') expect(message).not.toBeNull();
    else expect(message).toBeNull();
  });
});
