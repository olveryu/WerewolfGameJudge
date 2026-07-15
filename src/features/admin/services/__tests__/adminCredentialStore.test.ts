import { ADMIN_PASSWORD_KEY } from '@/config/storageKeys';
import {
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from '@/features/admin/services/adminCredentialStore';

const mockStoredValues = new Map<string, string>();
jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStoredValues.get(key)),
    set: jest.fn((key: string, value: string) => mockStoredValues.set(key, value)),
    remove: jest.fn((key: string) => mockStoredValues.delete(key)),
  },
}));

describe('adminCredentialStore', () => {
  beforeEach(() => {
    mockStoredValues.clear();
  });

  it('persists and clears one canonical credential', () => {
    expect(readAdminCredential()).toBeNull();
    writeAdminCredential('admin-secret');
    expect(readAdminCredential()).toBe('admin-secret');
    clearAdminCredential();
    expect(readAdminCredential()).toBeNull();
  });

  it.each(['', ' padded '])('fails fast for malformed stored credential %p', (credential) => {
    mockStoredValues.set(ADMIN_PASSWORD_KEY, credential);
    expect(() => readAdminCredential()).toThrow('trimmed non-empty string');
  });
});
