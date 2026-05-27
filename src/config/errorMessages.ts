/**
 * errorMessages — unified error/status message constants
 *
 * Centralizes all user-visible error messages, network errors, and loading state text
 * to keep wording consistent across the app for the same error types.
 * No business logic / side effects / runtime dependencies.
 */

// ── Network & server errors ──────────────────────────────────────
/** User-facing message for network unreachable / fetch errors. */
export const NETWORK_ERROR = '网络异常，请检查网络后重试';
/** User-facing message for server 5xx or unavailable errors. */
export const SERVER_ERROR = '服务暂时不可用，请稍后重试';
