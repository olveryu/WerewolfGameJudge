/**
 * Mock for @react-native-async-storage/async-storage
 * Used by Jest via moduleNameMapper
 */

const storage: Record<string, string> = {};

const AsyncStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(storage[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    storage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete storage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(storage))),
  getMany: jest.fn((keys: string[]) => {
    const result: Record<string, string | null> = {};
    keys.forEach((key) => {
      result[key] = storage[key] ?? null;
    });
    return Promise.resolve(result);
  }),
  setMany: jest.fn((entries: Record<string, string>) => {
    Object.entries(entries).forEach(([key, value]) => {
      storage[key] = value;
    });
    return Promise.resolve();
  }),
  removeMany: jest.fn((keys: string[]) => {
    keys.forEach((key) => delete storage[key]);
    return Promise.resolve();
  }),
};

export default AsyncStorage;
