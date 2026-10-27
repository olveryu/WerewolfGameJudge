/**
 * Host task view contract: the task references sheet actions by key, the
 * view resolves them to the sheet's own handlers and availability, and
 * malformed tasks fail at assembly.
 */
import { resolveHostTaskView } from '../resolveHostTaskView';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
  RoomHostTask,
} from '../RoomHostManagement';

function enabled(key: string, onPress: () => void = jest.fn()): RoomHostManagementAction {
  return { key, label: key, icon: 'play-outline', variant: 'primary', isEnabled: true, onPress };
}

function disabled(key: string, disabledReason: string | null): RoomHostManagementAction {
  return {
    key,
    label: key,
    icon: 'play-outline',
    variant: 'primary',
    isEnabled: false,
    disabledReason,
  };
}

function model(
  task: RoomHostTask | null,
  actions: readonly RoomHostManagementAction[],
): RoomHostManagementModel {
  return { task, sections: [{ key: 'flow', title: '流程', actions }] };
}

describe('resolveHostTaskView', () => {
  it('returns null when nothing awaits the host', () => {
    expect(resolveHostTaskView(model(null, [enabled('start-game')]))).toBeNull();
  });

  it('resolves an action task to the sheet action and its own onPress', () => {
    const onPress = jest.fn();
    const view = resolveHostTaskView(
      model({ kind: 'action', actionKey: 'start-game' }, [enabled('start-game', onPress)]),
    );
    if (view?.body.kind !== 'ready') throw new Error('expected ready');
    expect(view.body.action.onPress).toBe(onPress);
    expect(view.steps).toBeNull();
    expect(view.note).toBeNull();
  });

  it('renders a disabled action as blocked with its reason and an enabled remedy', () => {
    const share = jest.fn();
    const view = resolveHostTaskView(
      model({ kind: 'action', actionKey: 'start-game', remedyActionKey: 'share-room' }, [
        disabled('start-game', '座位尚未坐满（还差 2 人）'),
        enabled('share-room', share),
      ]),
    );
    if (view?.body.kind !== 'blocked') throw new Error('expected blocked');
    expect(view.body.reason).toBe('座位尚未坐满（还差 2 人）');
    expect(view.body.remedy?.onPress).toBe(share);
  });

  it('drops the remedy when the remedy action itself is unavailable', () => {
    const view = resolveHostTaskView(
      model({ kind: 'action', actionKey: 'start-game', remedyActionKey: 'share-room' }, [
        disabled('start-game', '座位尚未坐满'),
        disabled('share-room', '当前阶段不能分享房间'),
      ]),
    );
    if (view?.body.kind !== 'blocked') throw new Error('expected blocked');
    expect(view.body.remedy).toBeNull();
  });

  it('resolves a choice to its actions in order', () => {
    const view = resolveHostTaskView(
      model({ kind: 'choice', actionKeys: ['next-round', 'return-lobby'] }, [
        enabled('return-lobby'),
        enabled('next-round'),
      ]),
    );
    if (view?.body.kind !== 'choice') throw new Error('expected choice');
    expect(view.body.actions.map((action) => action.key)).toEqual(['next-round', 'return-lobby']);
  });

  it('resolves a message with an optional escape action', () => {
    const view = resolveHostTaskView(
      model({ kind: 'message', text: '等待玩家', actionKey: 'mark-bots-viewed' }, [
        enabled('mark-bots-viewed'),
      ]),
    );
    if (view?.body.kind !== 'message') throw new Error('expected message');
    expect(view.body.text).toBe('等待玩家');
    expect(view.body.escape?.key).toBe('mark-bots-viewed');
    const bare = resolveHostTaskView(model({ kind: 'message', text: '等待' }, []));
    if (bare?.body.kind !== 'message') throw new Error('expected message');
    expect(bare.body.escape).toBeNull();
  });

  it('binds completed and current steps to their sheet actions, leaves upcoming inert', () => {
    const info = jest.fn();
    const review = jest.fn();
    const view = resolveHostTaskView(
      model(
        {
          kind: 'action',
          actionKey: 'night-review',
          note: '记得分享',
          steps: [
            { key: 'a', label: '昨夜信息', state: 'complete', actionKey: 'last-night-info' },
            { key: 'b', label: '本局复盘', state: 'current', actionKey: 'night-review' },
            { key: 'c', label: '收尾', state: 'upcoming' },
          ],
        },
        [enabled('last-night-info', info), enabled('night-review', review)],
      ),
    );
    expect(view?.note).toBe('记得分享');
    expect(view?.steps?.map((step) => step.onPress)).toEqual([info, review, undefined]);
  });

  it('fails fast on a dangling reference, a one-option choice, two current steps, duplicate keys', () => {
    expect(() =>
      resolveHostTaskView(model({ kind: 'action', actionKey: 'nope' }, [enabled('start-game')])),
    ).toThrow('Host task action references action "nope" missing from the sheet');
    expect(() =>
      resolveHostTaskView(
        model({ kind: 'choice', actionKeys: ['start-game'] }, [enabled('start-game')]),
      ),
    ).toThrow('Host choice task needs at least two actions');
    expect(() =>
      resolveHostTaskView(
        model(
          {
            kind: 'action',
            actionKey: 'start-game',
            steps: [
              { key: 'a', label: 'a', state: 'current' },
              { key: 'b', label: 'b', state: 'current' },
            ],
          },
          [enabled('start-game')],
        ),
      ),
    ).toThrow('more than one current step');
    expect(() =>
      resolveHostTaskView(model({ kind: 'action', actionKey: 'x' }, [enabled('x'), enabled('x')])),
    ).toThrow('declares action "x" twice');
  });
});
