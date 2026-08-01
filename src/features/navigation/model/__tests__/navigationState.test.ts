import { hasPreviousRouteInCurrentNavigator } from '../navigationState';

describe('hasPreviousRouteInCurrentNavigator', () => {
  it.each([
    { index: 0, expected: false },
    { index: 1, expected: true },
    { index: 3, expected: true },
  ])('returns $expected for local stack index $index', ({ index, expected }) => {
    expect(hasPreviousRouteInCurrentNavigator({ getState: () => ({ index }) })).toBe(expected);
  });
});
