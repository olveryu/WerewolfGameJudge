/**
 * useAuth - Auth hook that reads from global AuthContext
 *
 * This is a thin wrapper that maintains backward compatibility.
 * The actual auth state lives in AuthProvider (src/contexts/AuthContext.tsx).
 *
 * Benefits of this architecture:
 * - Single auth state shared across all screens
 * - Single onAuthStateChange subscription
 * - No "login flicker" when navigating between screens
 */

// Re-export User type for backward compatibility
export type { User } from '../contexts/AuthContext';

// Re-export the hook with the same name for backward compatibility
export { useAuthContext as useAuth } from '../contexts/AuthContext';
