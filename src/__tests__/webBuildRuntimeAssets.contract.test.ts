/** Locks every Web build to a same-origin CanvasKit runtime dependency. */

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

  it('keeps CanvasKit same-origin instead of rewriting it to the asset CDN', () => {
    const workflowSource = fs.readFileSync(
      path.join(process.cwd(), '.github', 'workflows', 'ci.yml'),
      'utf-8',
    );
    const entrySource = fs.readFileSync(path.join(process.cwd(), 'index.ts'), 'utf-8');

    expect(workflowSource).not.toContain('__CANVASKIT_WASM_GZ_URL__');
    expect(workflowSource).not.toContain('wasm/canvaskit.wasm.gz');
    expect(workflowSource).not.toContain('rm -f dist/canvaskit.wasm');
    expect(entrySource).toContain('locateFile: (file: string) => `/${file}`');
    expect(entrySource).not.toContain('__CANVASKIT_WASM_GZ_URL__');
    expect(entrySource).toContain('启动资源加载失败，请检查网络后刷新');
  });
});
