/** Where a violation sits is part of its fingerprint (P1 QA11 F4). */
import { describe, expect, it } from 'vitest';

import { scriptContext, styleContext } from './context.mjs';

describe('violation context', () => {
  it('names the enclosing rules and at-rules of a stylesheet', () => {
    const at = styleContext(
      '.a {\n  z-index: 1;\n}\n@media (width > 1px) {\n  .b,\n  .c { z-index: 1; }\n}\n@keyframes k {\n  50% { opacity: 1; }\n}\n',
      'x.css',
    );
    expect(at(2, 3)).toBe('.a');
    expect(at(6, 8)).toBe('@media (width > 1px) > .b, .c');
    expect(at(9, 9)).toBe('@keyframes k > 50%');
  });

  it('names the enclosing elements, functions, declarations and keys of a script', () => {
    const at = scriptContext(
      [
        'export function Card() {',
        '  return <div className="card"><span style={{ padding: 13 }} /></div>;',
        '}',
        "const TABLE = { good: { color: '#f00' } };",
      ].join('\n'),
      'x.tsx',
    );
    expect(at(2, 56)).toBe('Card > <div.card> > <span> > padding');
    expect(at(4, 32)).toBe('TABLE > good > color');
  });
});
