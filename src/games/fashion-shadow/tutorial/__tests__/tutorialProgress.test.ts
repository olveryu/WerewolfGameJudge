import { hasCompletedFashionTutorial, markFashionTutorialCompleted } from '../tutorialProgress';

const mockStoredValues = new Map<string, string>();
jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStoredValues.get(key)),
    set: jest.fn((key: string, value: string) => mockStoredValues.set(key, value)),
  },
}));

describe('Fashion Shadow tutorial progress', () => {
  beforeEach(() => {
    mockStoredValues.clear();
  });

  it('persists completion per user', () => {
    expect(hasCompletedFashionTutorial('user-1')).toBe(false);
    expect(hasCompletedFashionTutorial('user-2')).toBe(false);

    markFashionTutorialCompleted('user-1');

    expect(hasCompletedFashionTutorial('user-1')).toBe(true);
    expect(hasCompletedFashionTutorial('user-2')).toBe(false);
  });

  it('fails fast for an empty user ID', () => {
    expect(() => hasCompletedFashionTutorial('')).toThrow('user ID must not be empty');
    expect(() => markFashionTutorialCompleted('')).toThrow('user ID must not be empty');
  });
});
