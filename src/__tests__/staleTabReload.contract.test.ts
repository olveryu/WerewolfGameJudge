/** Locks stale-tab reload ordering so resume listeners cannot race page teardown. */

import fs from 'node:fs';
import path from 'node:path';

const WEB_INDEX_PATH = path.join(process.cwd(), 'web', 'index.html');

describe('stale-tab reload contract', () => {
  it('stops later visibility listeners before reloading the page', () => {
    const webIndexSource = fs.readFileSync(WEB_INDEX_PATH, 'utf-8');

    expect(webIndexSource).toContain(
      "document.addEventListener('visibilitychange', function (visibilityEvent) {",
    );
    expect(webIndexSource).toMatch(
      /visibilityEvent\.stopImmediatePropagation\(\);\s+console\.log\('Stale tab detected, reloading…'\);\s+window\.location\.reload\(\);/,
    );
  });
});
