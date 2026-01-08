/**
 * Jest global setup file
 * Mocks external dependencies that are not available in test environment
 */

// Mock Supabase client
jest.mock('./src/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue({ status: 'ok' }),
    }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));
