// Style objects another file passes to `style` (ui-lint eslint tests, QA6 L4 cross-file cases).
const gap = 12;
const tokenGap = 'var(--space-2)';
export const goodCard = { borderRadius: 'var(--radius-card)', padding: 0 };
export const badCard = { borderRadius: 7 };
export const shorthandCard = { gap };
export const tokenShorthandCard = { gap: tokenGap };
export const notAStyle = { width: 44, label: 'x' };
