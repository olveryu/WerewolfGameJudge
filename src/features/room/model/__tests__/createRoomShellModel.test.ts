/**
 * Ownership contract of the shell factory: host management exists only
 * for the host, and every bottom button's declared audience is checked
 * against the viewer (docs/room-shell-contract.md "Action Ownership").
 */
import { viewerFor } from '@/test-utils/roomViewer';

import { createRoomShellModel, type RoomShellModelInput } from '../createRoomShellModel';
import type {
  RoomBottomActionModel,
  RoomBottomButton,
  RoomBottomStackModel,
} from '../RoomBottomActions';
import type { RoomCapabilities } from '../RoomCapabilities';
import type { RoomHostManagementModel } from '../RoomHostManagement';
import type { RoomViewer } from '../RoomViewer';

const deniedCapabilities: RoomCapabilities = {
  canTakeSeat: { isAllowed: false, reason: null },
  canMoveSeat: { isAllowed: false, reason: null },
  canLeaveSeat: { isAllowed: false, reason: null },
  canKickSeat: { isAllowed: false, reason: null },
  canClearSeats: { isAllowed: false, reason: null },
  canFillBots: { isAllowed: false, reason: null },
  canConfigureGame: { isAllowed: false, reason: null },
  canViewProfiles: { isAllowed: false, reason: null },
  canTakeOverBots: { isAllowed: false, reason: null },
  canShareRoom: { isAllowed: false, reason: null },
  shouldConfirmExit: false,
};

const EMPTY_STACK: RoomBottomStackModel = {
  kind: 'stacked',
  message: null,
  progress: null,
  layout: { primary: [], secondary: [], ghost: [] },
};

function button(key: string, audience: RoomBottomButton['audience']): RoomBottomButton {
  return {
    key,
    label: key,
    audience,
    variant: 'secondary',
    size: 'md',
    isEnabled: true,
    onPress: jest.fn(),
  };
}

function stacked(...buttons: RoomBottomButton[]): RoomBottomActionModel {
  return { ...EMPTY_STACK, layout: { primary: buttons, secondary: [], ghost: [] } };
}

function input(
  viewer: RoomViewer,
  overrides: Partial<RoomShellModelInput> = {},
): RoomShellModelInput {
  return {
    roomCode: '1234',
    viewer,
    phase: 'lobby',
    step: null,
    isAudioPlaying: false,
    capabilities: deniedCapabilities,
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    user: { id: viewer.userId, avatarUrl: null },
    gachaStatus: null,
    onUserActionPress: jest.fn(),
    connection: {
      status: { kind: 'live' },
      pendingDurableCount: 0,
      presence: new Set<string>(),
      onRetryNow: jest.fn(),
    },
    seatSource: {
      count: 0,
      revision: 0,
      getSeat: () => {
        throw new Error('no seats in the ownership stub');
      },
    },
    seatsVisuallyDisabled: false,
    onSeatPress: jest.fn(),
    onBotSeatLongPress: null,
    seatConfirmation: null,
    profile: null,
    share: {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.test/1234',
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    },
    bottomActions: EMPTY_STACK,
    buildHostManagement: () => ({ task: null, sections: [] }),
    controlledSeat: null,
    ...overrides,
  };
}

describe('createRoomShellModel ownership', () => {
  describe('host management', () => {
    it('builds the host surface only for the host and never calls the builder otherwise', () => {
      const hostModel: RoomHostManagementModel = { task: null, sections: [] };
      const buildHostManagement = jest.fn(() => hostModel);

      const host = createRoomShellModel(input(viewerFor('host'), { buildHostManagement }));
      expect(host.hostManagement).toBe(hostModel);
      expect(buildHostManagement).toHaveBeenCalledTimes(1);

      const seated = createRoomShellModel(input(viewerFor('seated'), { buildHostManagement }));
      const spectator = createRoomShellModel(
        input(viewerFor('spectator'), { buildHostManagement }),
      );
      expect(seated.hostManagement).toBeNull();
      expect(spectator.hostManagement).toBeNull();
      expect(buildHostManagement).toHaveBeenCalledTimes(1);
    });

    it('lets a host phase with nothing to manage return null', () => {
      const model = createRoomShellModel(
        input(viewerFor('host'), { buildHostManagement: () => null }),
      );
      expect(model.hostManagement).toBeNull();
    });

    it('exposes the viewer on the model', () => {
      const viewer = viewerFor('seated');
      expect(createRoomShellModel(input(viewer)).viewer).toBe(viewer);
    });
  });

  describe('bottom action audiences', () => {
    it('accepts participant buttons for a seated viewer and anyone buttons for everyone', () => {
      for (const viewer of [viewerFor('host'), viewerFor('seated')]) {
        expect(() =>
          createRoomShellModel(
            input(viewer, { bottomActions: stacked(button('view', 'participant')) }),
          ),
        ).not.toThrow();
      }
      for (const viewer of [viewerFor('host'), viewerFor('seated'), viewerFor('spectator')]) {
        expect(() =>
          createRoomShellModel(
            input(viewer, { bottomActions: stacked(button('review', 'anyone')) }),
          ),
        ).not.toThrow();
      }
    });

    it('rejects a participant button for a spectator without an effective seat', () => {
      expect(() =>
        createRoomShellModel(
          input(viewerFor('spectator'), { bottomActions: stacked(button('view', 'participant')) }),
        ),
      ).toThrow('Bottom action "view" is a participant action but the viewer holds no seat');
    });

    it('accepts a participant button for an unseated host acting as a taken-over bot seat', () => {
      const unseatedHost: RoomViewer = { userId: 'host', isHost: true, seat: null };
      expect(() =>
        createRoomShellModel(
          input(unseatedHost, {
            bottomActions: stacked(button('view', 'participant')),
            controlledSeat: { seat: 3, displayName: 'Bot 4', onRelease: jest.fn() },
          }),
        ),
      ).not.toThrow();
      expect(() =>
        createRoomShellModel(
          input(unseatedHost, { bottomActions: stacked(button('view', 'participant')) }),
        ),
      ).toThrow('Bottom action "view" is a participant action but the viewer holds no seat');
    });

    it('validates the host task references at assembly for the host', () => {
      const model: RoomHostManagementModel = {
        task: { kind: 'action', actionKey: 'missing' },
        sections: [],
      };
      expect(() =>
        createRoomShellModel(input(viewerFor('host'), { buildHostManagement: () => model })),
      ).toThrow('Host task action references action "missing" missing from the sheet');
      expect(() =>
        createRoomShellModel(input(viewerFor('seated'), { buildHostManagement: () => model })),
      ).not.toThrow();
    });
  });
});
