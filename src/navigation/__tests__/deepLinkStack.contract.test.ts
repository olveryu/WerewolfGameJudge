/**
 * deepLinkStack.contract — Deep-link stack contract test
 *
 * Ensures every screen accessed directly via URL has Home at the bottom of the navigation stack,
 * so goBack() / cancel returns correctly. When adding a new screen, if getStateFromPath is not covered,
 * this test fails automatically.
 */

jest.unmock('@react-navigation/native');

import { linking } from '../AppNavigator';

const screens = linking.config!.screens as Record<string, string | { path: string }>;

/** Build a representative URL path for each screen. */
function buildPath(screenConfig: string | { path: string }): string {
  const raw = typeof screenConfig === 'string' ? screenConfig : screenConfig.path;
  return (
    '/' +
    raw
      .replace(/:gameType\??/g, 'werewolf')
      .replace(/:mode\??/g, 'edit')
      .replace(/:roomCode\??/g, '1234')
      .replace(/:(\w+)\??/g, 'DUMMY')
  );
}

describe('deep-link stack: Home is always at the bottom', () => {
  const entries = Object.entries(screens).filter(([name]) => name !== 'Home');

  it.each(entries)('%s — stack[0] is Home', (name, config) => {
    const path = buildPath(config);
    const state = linking.getStateFromPath!(path, linking.config);

    expect(state).toBeDefined();
    expect(state!.routes.length).toBeGreaterThanOrEqual(2);
    expect(state!.routes[0]!.name).toBe('Home');
  });

  it.each(entries)('%s — top route matches screen name', (name, config) => {
    const path = buildPath(config);
    const state = linking.getStateFromPath!(path, linking.config);

    expect(state).toBeDefined();
    const topRoute = state!.routes[state!.routes.length - 1]!;
    expect(topRoute.name).toBe(name);
  });

  it('rejects unknown game types instead of falling back to Werewolf', () => {
    expect(() => linking.getStateFromPath!('/game/unknown/config/create', linking.config)).toThrow(
      'Unknown game type',
    );
  });

  it.each(['/config', '/board-picker', '/encyclopedia', '/notepad/1234'])(
    'does not retain the removed compatibility path %s',
    (path) => {
      expect(linking.getStateFromPath!(path, linking.config)).toBeUndefined();
    },
  );
});

describe('deep-link stack: game config route matrix', () => {
  it.each([
    {
      path: '/game/werewolf/config/create',
      expectedRoutes: ['Home', 'GameConfig'],
    },
    {
      path: '/game/werewolf/config/edit/1234',
      expectedRoutes: ['Home', 'Room', 'GameConfig'],
    },
    {
      path: '/game/werewolf/config/nominate/5678',
      expectedRoutes: ['Home', 'Room', 'GameConfig'],
    },
  ])('builds the canonical parent stack for $path', ({ path, expectedRoutes }) => {
    const state = linking.getStateFromPath!(path, linking.config);

    expect(state?.routes.map((route) => route.name)).toEqual(expectedRoutes);
  });

  it.each([
    '/game/werewolf/config/create/1234',
    '/game/werewolf/config/edit',
    '/game/werewolf/config/nominate',
    '/game/werewolf/config/unknown/1234',
  ])('rejects the invalid config route %s', (path) => {
    expect(() => linking.getStateFromPath!(path, linking.config)).toThrow();
  });

  it.each([
    {
      path: '/game/fibking/config/create',
      expectedRoutes: ['Home', 'GameConfig'],
    },
    {
      path: '/game/fibking/config/edit/2468',
      expectedRoutes: ['Home', 'Room', 'GameConfig'],
    },
  ])('builds the FibKing parent stack for $path', ({ path, expectedRoutes }) => {
    const state = linking.getStateFromPath!(path, linking.config);

    expect(state?.routes.map((route) => route.name)).toEqual(expectedRoutes);
  });

  it.each([
    '/game/fibking/config/nominate/2468',
    '/game/fibking/config/create/2468',
    '/game/fibking/config/edit',
  ])('rejects the invalid FibKing config route %s', (path) => {
    expect(() => linking.getStateFromPath!(path, linking.config)).toThrow();
  });
});

describe('deep-link stack: optional game navigation capabilities', () => {
  it('accepts registered guide and notepad routes', () => {
    expect(
      linking.getStateFromPath!('/game/fibking/guide/2468', linking.config)?.routes.map(
        (route) => route.name,
      ),
    ).toEqual(['Home', 'Room', 'GameGuide']);
    expect(
      linking.getStateFromPath!('/game/werewolf/notepad/1357', linking.config)?.routes.map(
        (route) => route.name,
      ),
    ).toEqual(['Home', 'Room', 'GameNotepad']);
  });

  it('rejects a route whose game capability is unsupported', () => {
    expect(() => linking.getStateFromPath!('/game/fibking/notepad/2468', linking.config)).toThrow(
      '[FAIL-FAST] fibking does not support notepad navigation',
    );
  });

  it.each([
    '/game/fibking/guide/2468?roleId=seer',
    '/game/werewolf/guide/2468?initialTab=unknown',
    '/game/werewolf/guide/2468?roleId=unknown',
  ])('rejects malformed game guide params from %s', (path) => {
    expect(() => linking.getStateFromPath!(path, linking.config)).toThrow();
  });
});
