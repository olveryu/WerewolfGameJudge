/**
 * deepLinkStack.contract — Deep-link stack contract test
 *
 * Ensures every screen accessed directly via URL has Home at the bottom of the navigation stack,
 * so goBack() / cancel returns correctly. When adding a new screen, if getStateFromPath is not covered,
 * this test fails automatically.
 */

import { linking } from '../AppNavigator';

const screens = linking.config!.screens as Record<string, string | { path: string }>;

/** Build a representative URL path for each screen. */
function buildPath(screenConfig: string | { path: string }): string {
  const raw = typeof screenConfig === 'string' ? screenConfig : screenConfig.path;
  // Replace :param placeholders with dummy values
  return '/' + raw.replace(/:(\w+)/g, 'DUMMY');
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
});
