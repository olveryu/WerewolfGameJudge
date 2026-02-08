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
 *
 * ✅ 允许：从 AuthContext 读取状态、re-export 类型
 * ❌ 禁止：直接调用 Supabase / AuthService、业务逻辑
 */

// Re-export User type for backward compatibility
export type { User } from '@/contexts/AuthContext';

// Re-export the hook with the same name for backward compatibility
export { useAuthContext as useAuth } from '@/contexts/AuthContext';
