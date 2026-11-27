// Imports a TSX write site names (ui-lint eslint tests): only the registry decides whether a
// member or call of one passes (plan v3.12 D15 ②); what the module holds is never read there.
export const goodCard = { borderRadius: 'var(--radius-card)', padding: 0 };
export const tokens = { space: { md: 'var(--space-md)' } };
export const runtimeStyle = (value: number): string => String(value);
