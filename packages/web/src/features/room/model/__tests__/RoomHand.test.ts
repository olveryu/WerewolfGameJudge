import { TESTIDS } from '@/testids';

import {
  COMMAND_IN_FLIGHT_REASON,
  type RoomHostAction,
  type RoomPlayerAction,
} from '../RoomAction';
import { buildRoomHand, type RoomHandInput } from '../RoomHand';

const press = vi.fn();

function player(key: string, state: RoomPlayerAction['state']): RoomPlayerAction {
  return { key, label: key, category: 'player', audience: 'participant', state };
}

function host(key: string, state: RoomHostAction['state']): RoomHostAction {
  return { key, label: key, category: 'host', icon: 'options-outline', state };
}

function input(): RoomHandInput {
  return {
    phase: 'playing',
    isSubmitting: false,
    pendingActionKey: null,
    face: { kind: 'main' },
    playerActions: { message: null, progress: null, actions: [], group: null },
    hostManagement: null,
    directory: { main: [], manual: [], openConfiguration: null },
    share: { isAllowed: false, reason: null },
    selectionMode: undefined,
    navigation: {
      openManual: press,
      openHost: press,
      openGroup: press,
      back: press,
      returnToMain: press,
      launchFrom: vi.fn(),
    },
  };
}

describe('buildRoomHand', () => {
  it('orders actions by category and availability while preserving ties', () => {
    const base = input();
    const hand = buildRoomHand({
      ...base,
      playerActions: {
        ...base.playerActions,
        actions: [
          player('blocked', { kind: 'blocked', reason: '等待' }),
          player('first', { kind: 'ready', onPress: press }),
          player('second', { kind: 'ready', onPress: press }),
          player('busy', { kind: 'busy' }),
        ],
      },
      directory: {
        ...base.directory,
        manual: [
          {
            key: 'guide',
            label: '玩法',
            category: 'resource',
            state: { kind: 'ready', onPress: press },
          },
        ],
      },
      hostManagement: {
        task: null,
        pendingActionKeys: ['task'],
        actions: [host('task', { kind: 'ready', onPress: press })],
      },
    });
    expect(hand.cards.map((card) => card.id)).toEqual([
      'action:first',
      'action:second',
      'action:blocked',
      'action:busy',
      'room-entry:manual',
      'room-entry:host',
    ]);
    expect(hand.cards.at(-1)).toMatchObject({
      accessibleLabel: '主持管理，有待处理操作',
      isPending: true,
    });
  });

  it('orders host tasks and preserves pending and task test identifiers', () => {
    const base = input();
    const hand = buildRoomHand({
      ...base,
      face: { kind: 'host' },
      hostManagement: {
        task: { kind: 'choice', actionKeys: ['a', 'b'] },
        pendingActionKeys: ['b'],
        actions: ['other', 'a', 'b'].map((key) => host(key, { kind: 'ready', onPress: press })),
      },
    });
    expect(hand.cards.map((card) => card.id)).toEqual([
      'host-management:back',
      'host-management:b',
      'host-management:a',
      'host-management:other',
    ]);
    expect(hand.cards[1]).toMatchObject({
      isPending: true,
      testID: `${TESTIDS.roomHostTaskCard}-b`,
    });
  });

  it('shows selection actions without changing the remembered face', () => {
    const base = input();
    const hand = buildRoomHand({
      ...base,
      face: { kind: 'host' },
      selectionMode: { kind: 'host-task' },
      hostManagement: {
        task: { kind: 'message', text: '选择座位', escapeActionKey: 'cancel' },
        actions: [host('cancel', { kind: 'ready', onPress: press })],
      },
      directory: { ...base.directory, openConfiguration: press },
    });
    expect(hand.face).toEqual({ kind: 'main' });
    expect(hand.cards.map((card) => card.id)).toEqual(['selection:cancel']);
  });

  it('rejects player seat selection whose escape card is missing', () => {
    const base = input();
    expect(() =>
      buildRoomHand({
        ...base,
        selectionMode: { kind: 'player', escapeActionKey: 'cancelSeatSelection' },
        playerActions: {
          ...base.playerActions,
          actions: [player('confirm', { kind: 'ready', onPress: press })],
        },
      }),
    ).toThrow(
      'Room phase "playing" selects seats without its escape card "action:cancelSeatSelection"',
    );
  });

  it('projects a player group as one entry and exposes its actions only on that group face', () => {
    const base = input();
    const openGroup = vi.fn();
    const group = {
      key: 'night-step',
      label: '预言家行动',
      icon: 'sparkles-outline' as const,
      audience: 'participant' as const,
      isPending: true,
      testID: 'open-group',
      backTestID: 'close-group',
      actions: [
        {
          ...player('inspect', { kind: 'ready', onPress: press }),
          testID: 'inspect-action',
        },
        player('skip', { kind: 'ready', onPress: press }),
      ],
    };
    const playerActions = { ...base.playerActions, group };
    const main = buildRoomHand({
      ...base,
      playerActions,
      navigation: { ...base.navigation, openGroup },
    });
    expect(main.cards.find((card) => card.id === 'group:night-step')).toMatchObject({
      label: '预言家行动',
      isPending: true,
      testID: 'open-group',
      containedActionTestIDs: ['inspect-action'],
    });
    expect(main.cards.some((card) => card.id === 'action:inspect')).toBe(false);
    const groupEntry = main.cards.find((card) => card.id === 'group:night-step');
    if (groupEntry === undefined || groupEntry.state.kind !== 'ready') {
      throw new Error('Expected the group entry to be ready');
    }
    groupEntry.state.onPress();
    expect(openGroup).toHaveBeenCalledWith('night-step');

    const child = buildRoomHand({
      ...base,
      face: { kind: 'group', key: group.key },
      playerActions,
    });
    expect(child.cards.map((card) => card.id)).toEqual([
      'group:night-step:back',
      'action:inspect',
      'action:skip',
    ]);
    expect(child.cards[0]).toMatchObject({
      category: 'back',
      testID: 'close-group',
    });
  });

  it('rejects groups that cannot form a sub-hand or reuse a player action key', () => {
    const base = input();
    const singleAction = player('inspect-one', { kind: 'busy' });
    const group = {
      key: 'inspect',
      label: '行动',
      audience: 'participant' as const,
      isPending: false,
      actions: [singleAction, player('inspect-two', { kind: 'busy' })],
    };
    expect(() =>
      buildRoomHand({
        ...base,
        playerActions: { ...base.playerActions, group: { ...group, actions: [singleAction] } },
      }),
    ).toThrow('with fewer than two actions');
    expect(() =>
      buildRoomHand({
        ...base,
        playerActions: {
          ...base.playerActions,
          actions: [player('inspect', { kind: 'busy' })],
          group,
        },
      }),
    ).toThrow('uses player action key "inspect" for its group');
  });

  it('uses the same configuration entry in the main hand and stage menu', () => {
    const base = input();
    const directory = { ...base.directory, openConfiguration: press };
    const main = buildRoomHand({ ...base, directory });
    const menu = buildRoomHand({ ...base, face: { kind: 'menu' }, directory });
    for (const hand of [main, menu]) {
      expect(hand.cards.find((card) => card.id === 'room-entry:configuration')).toMatchObject({
        icon: 'options-outline',
        testID: TESTIDS.roomConfigurationButton,
        opensDialog: true,
      });
    }
  });

  it('marks the pending command busy and other command cards blocked without blocking dialogs', () => {
    const base = input();
    const hand = buildRoomHand({
      ...base,
      isSubmitting: true,
      pendingActionKey: 'first',
      playerActions: {
        ...base.playerActions,
        actions: [
          player('first', { kind: 'ready', onPress: press }),
          player('second', { kind: 'ready', onPress: press }),
        ],
      },
      directory: {
        ...base.directory,
        main: [
          {
            key: 'settings',
            label: '设置',
            category: 'resource',
            opensDialog: true,
            state: { kind: 'ready', onPress: press },
          },
        ],
      },
    });

    expect(hand.cards.find((card) => card.id === 'action:first')?.state).toEqual({
      kind: 'busy',
    });
    expect(hand.cards.find((card) => card.id === 'action:second')?.state).toEqual({
      kind: 'blocked',
      reason: COMMAND_IN_FLIGHT_REASON,
    });
    expect(hand.cards.find((card) => card.id === 'main-entry:settings')?.state.kind).toBe('ready');
  });

  it('spins the entry whose sub-hand owns the submission and keeps other entries navigable', () => {
    const base = input();
    const submitting = (pendingActionKey: string) =>
      buildRoomHand({
        ...base,
        isSubmitting: true,
        pendingActionKey,
        playerActions: {
          ...base.playerActions,
          actions: [player('direct', { kind: 'ready', onPress: press })],
          group: {
            key: 'night-step',
            label: '女巫行动',
            audience: 'participant',
            isPending: false,
            actions: [
              player('save', { kind: 'ready', onPress: press }),
              player('poison', { kind: 'ready', onPress: press }),
            ],
          },
        },
        hostManagement: {
          task: null,
          actions: [host('fill-bots', { kind: 'ready', onPress: press })],
        },
      });
    const entryStates = (pendingActionKey: string) => {
      const cards = submitting(pendingActionKey).cards;
      return {
        group: cards.find((card) => card.id === 'group:night-step')?.state.kind,
        host: cards.find((card) => card.id === 'room-entry:host')?.state.kind,
      };
    };

    expect(entryStates('fill-bots')).toEqual({ group: 'ready', host: 'busy' });
    expect(entryStates('poison')).toEqual({ group: 'busy', host: 'ready' });
    expect(entryStates('direct')).toEqual({ group: 'ready', host: 'ready' });
  });

  it('rejects duplicate card identifiers and empty blocked reasons', () => {
    const base = input();
    expect(() =>
      buildRoomHand({
        ...base,
        playerActions: {
          ...base.playerActions,
          actions: [player('a', { kind: 'busy' }), player('a', { kind: 'busy' })],
        },
      }),
    ).toThrow('phase "playing" declares card "action:a" twice');
    expect(() =>
      buildRoomHand({
        ...base,
        playerActions: {
          ...base.playerActions,
          actions: [player('a', { kind: 'blocked', reason: ' ' })],
        },
      }),
    ).toThrow('empty blocked reason for card "action:a"');
  });
});
