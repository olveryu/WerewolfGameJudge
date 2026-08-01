import { debugLogStore } from '@/utils/debugLogStore';
import { debugLogTransport } from '@/utils/debugLogTransport';

beforeEach(() => {
  debugLogStore.clear();
  debugLogStore.setVisible(false);
});

describe('debugLogStore', () => {
  it('publishes log and visibility changes through one external store', () => {
    const listener = jest.fn();
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

describe('debugLogTransport', () => {
  it.each([
    ['debug', 'debug'],
    ['info', 'log'],
    ['warn', 'warn'],
    ['error', 'error'],
  ] as const)('maps %s to %s', (loggerLevel, storeLevel) => {
    debugLogTransport({
      msg: 'message',
      rawMsg: ['message'],
      level: { severity: 1, text: loggerLevel },
      extension: 'Test',
    });

    expect(debugLogStore.getSnapshot().logs.at(-1)).toMatchObject({
      message: '[Test] message',
      level: storeLevel,
    });
  });

  it('fails fast for a logger level outside the configured level set', () => {
    expect(() =>
      debugLogTransport({
        msg: 'message',
        rawMsg: ['message'],
        level: { severity: 4, text: 'fatal' },
        extension: null,
      }),
    ).toThrow('[FAIL-FAST] Unsupported logger level: fatal');
  });
});
