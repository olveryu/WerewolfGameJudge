/** Locks standalone Web builds to a runnable CanvasKit fallback while CI uses the CDN copy. */

import fs from 'node:fs';
import path from 'node:path';

describe('Web build runtime assets', () => {
  it('copies CanvasKit WASM into standalone dist output', () => {
    const buildSource = fs.readFileSync(path.join(process.cwd(), 'scripts', 'build.sh'), 'utf-8');

    expect(buildSource).toContain(
      'CANVASKIT_WASM_SOURCE="node_modules/canvaskit-wasm/bin/full/canvaskit.wasm"',
    );
    expect(buildSource).toContain('cp "$CANVASKIT_WASM_SOURCE" dist/canvaskit.wasm');
  });

  it('removes the raw fallback only after CI rewrites CanvasKit to the compressed CDN asset', () => {
    const workflowSource = fs.readFileSync(
      path.join(process.cwd(), '.github', 'workflows', 'ci.yml'),
      'utf-8',
    );
    const rewriteIndex = workflowSource.indexOf(
      's|__CANVASKIT_WASM_GZ_URL__|${CDN_BASE}/wasm/canvaskit.wasm.gz|g',
    );
    const removeFallbackIndex = workflowSource.indexOf('rm -f dist/canvaskit.wasm');

    expect(rewriteIndex).toBeGreaterThanOrEqual(0);
    expect(removeFallbackIndex).toBeGreaterThan(rewriteIndex);
  });
});
