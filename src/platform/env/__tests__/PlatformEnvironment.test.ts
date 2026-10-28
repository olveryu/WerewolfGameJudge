import {
  createPlatformEnvironment,
  type EnvironmentSource,
} from '@/platform/env/PlatformEnvironment';

interface FakeSource extends EnvironmentSource {
  visible: boolean;
  online: boolean;
  listenerCount: number;
  emit(): void;
}

function createFakeSource(): FakeSource {
  let onChange: (() => void) | null = null;
  const source: FakeSource = {
    visible: true,
    online: true,
    listenerCount: 0,
    readVisible: () => source.visible,
    readOnline: () => source.online,
    listen: (handler) => {
      source.listenerCount += 1;
      onChange = handler;
      return () => {
        source.listenerCount -= 1;
        onChange = null;
      };
    },
    emit: () => {
      if (onChange === null) throw new Error('No platform listener registered');
      onChange();
    },
  };
  return source;
}

describe('createPlatformEnvironment', () => {
  it('attaches platform listeners only while subscribers exist', () => {
    const source = createFakeSource();
    const environment = createPlatformEnvironment({ source, now: () => 0 });
    expect(source.listenerCount).toBe(0);

    const unsubscribeA = environment.subscribe(() => undefined);
    const unsubscribeB = environment.subscribe(() => undefined);
    expect(source.listenerCount).toBe(1);

    unsubscribeA();
    expect(source.listenerCount).toBe(1);
    unsubscribeB();
    expect(source.listenerCount).toBe(0);
  });

  it('publishes an immutable snapshot only when a field changes', () => {
    let nowMs = 1_000;
    const source = createFakeSource();
    const environment = createPlatformEnvironment({ source, now: () => nowMs });
    const listener = jest.fn();
    environment.subscribe(listener);
    const initial = environment.getSnapshot();
    expect(initial).toEqual({
      visible: true,
      online: true,
      visibleSinceMs: 1_000,
      onlineSinceMs: 1_000,
    });

    nowMs = 2_000;
    source.emit();
    expect(listener).not.toHaveBeenCalled();
    expect(environment.getSnapshot()).toBe(initial);

    source.visible = false;
    nowMs = 3_000;
    source.emit();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(environment.getSnapshot()).toEqual({
      visible: false,
      online: true,
      visibleSinceMs: 3_000,
      onlineSinceMs: 1_000,
    });
    expect(Object.isFrozen(environment.getSnapshot())).toBe(true);
  });

  it('re-reads the platform when no subscriber is attached', () => {
    const source = createFakeSource();
    const environment = createPlatformEnvironment({ source, now: () => 0 });
    expect(environment.getSnapshot().online).toBe(true);
    source.online = false;
    expect(environment.getSnapshot().online).toBe(false);
  });
});
