import { debugLogStore } from '@/utils/debugLogStore';
import { apiLog } from '@/utils/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  debugLogStore.clear();
  debugLogStore.setVisible(false);
});

describe('debugLogStore', () => {
  it('publishes log and visibility changes through one external store', () => {
    const listener = vi.fn();
    const unsubscribe = debugLogStore.subscribe(listener);

    debugLogStore.addLog('ready', 'log');
    debugLogStore.toggleVisibility();

    expect(debugLogStore.getSnapshot()).toMatchObject({
      visible: true,
      logs: [{ message: 'ready', level: 'log' }],
    });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});

describe('logger to debug panel', () => {
  it.each([
    ['debug', 'debug'],
    ['info', 'log'],
    ['warn', 'warn'],
    ['error', 'error'],
  ] as const)('maps %s to %s', (loggerLevel, storeLevel) => {
    vi.spyOn(console, loggerLevel).mockImplementation(() => undefined);

    apiLog[loggerLevel]('message', { status: 500 });

    expect(debugLogStore.getSnapshot().logs.at(-1)).toMatchObject({
      message: '[Api] message {"status":500}',
      level: storeLevel,
    });
  });
});
