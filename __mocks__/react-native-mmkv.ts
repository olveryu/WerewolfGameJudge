/**
 * Mock for react-native-mmkv — in-memory Record<string, string|boolean|number> store.
 * Used by Jest via moduleNameMapper.
 */

const store: Record<string, string | boolean | number> = {};

function createMMKV() {
  return {
    getString: jest.fn((key: string) => store[key] as string | undefined),
    getBoolean: jest.fn((key: string) => store[key] as boolean | undefined),
    getNumber: jest.fn((key: string) => store[key] as number | undefined),
    set: jest.fn((key: string, value: string | boolean | number) => {
      store[key] = value;
    }),
    remove: jest.fn((key: string) => {
      delete store[key];
      return true;
    }),
    contains: jest.fn((key: string) => key in store),
    getAllKeys: jest.fn(() => Object.keys(store)),
    clearAll: jest.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
  };
}

module.exports = {
  createMMKV,
};
