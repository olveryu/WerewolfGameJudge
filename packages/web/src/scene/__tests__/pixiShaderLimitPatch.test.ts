import { checkMaxIfStatementsInShader } from 'pixi.js';

/**
 * Pins `patches/pixi.js@8.23.0.patch`. Upstream PixiJS 8.23's `checkMaxIfStatementsInShader` halves
 * its `if` count after every failed compile with no exit at 0 and no check for a lost context. A lost
 * context returns null from `getParameter` and `getShaderParameter`, so the limits check that
 * `GlLimitsSystem` runs at `init` and on every restore spun forever on the main thread. Without the
 * patch these tests fail (the fake stops the loop instead of letting it hang the run).
 */

/** More compiles than any bounded search needs (log2 of a realistic texture unit count). */
const COMPILE_CALL_LIMIT = 1000;

interface FakeGlOptions {
  /** Whether the context is lost, from the start or from the given compile on. */
  readonly lostFromCompile?: number;
  /** The largest `if` count that compiles; `null` for none. */
  readonly maxCompilingIfs: number | null;
}

/**
 * The slice of WebGL the function calls. Like a browser, a lost context still returns a shader
 * object (Chromium, and WebKit's `WebGLShader::createLost`) and null from every query.
 */
function fakeGl(options: FakeGlOptions) {
  let source = '';
  const state = { compiles: 0, deleted: 0 };
  const isContextLost = () =>
    options.lostFromCompile !== undefined && state.compiles >= options.lostFromCompile;
  const gl = {
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    isContextLost,
    createShader: () => ({}),
    shaderSource: (_shader: object, next: string) => {
      source = next;
    },
    compileShader: () => {
      state.compiles += 1;
      if (state.compiles > COMPILE_CALL_LIMIT) throw new Error('unbounded compile loop');
    },
    getShaderParameter: (): boolean | null => {
      if (isContextLost()) return null;
      // The source for `maxIfs` holds `maxIfs - 1` ifs.
      const ifs = (source.match(/if\(/g) ?? []).length;
      const max = options.maxCompilingIfs;
      return max !== null && ifs + 1 <= max;
    },
    deleteShader: () => {
      state.deleted += 1;
    },
  };
  return { gl, state };
}

function check(maxIfs: number | null, { gl }: ReturnType<typeof fakeGl>): number {
  // A test double for the slice of WebGL the function calls; `maxIfs` is what a lost context's
  // `getParameter(MAX_TEXTURE_IMAGE_UNITS)` returns, null included.
  return checkMaxIfStatementsInShader(
    maxIfs as unknown as number,
    gl as unknown as Parameters<typeof checkMaxIfStatementsInShader>[1],
  );
}

describe('patched PixiJS checkMaxIfStatementsInShader', () => {
  it('returns the largest power-of-two step that compiles', () => {
    const gl = fakeGl({ maxCompilingIfs: 8 });

    expect(check(16, gl)).toBe(8);
    expect(gl.state.compiles).toBe(2);
    expect(gl.state.deleted).toBe(1);
  });

  it('throws on the null limit a context lost before the check reports', () => {
    const gl = fakeGl({ lostFromCompile: 0, maxCompilingIfs: 16 });

    expect(() => check(null, gl)).toThrow(/Invalid value of `null`/);
    expect(gl.state.compiles).toBe(0);
  });

  it('throws when the context is lost during the search', () => {
    const gl = fakeGl({ lostFromCompile: 1, maxCompilingIfs: 16 });

    expect(() => check(16, gl)).toThrow(/WebGL context lost/);
    expect(gl.state.compiles).toBe(1);
    expect(gl.state.deleted).toBe(1);
  });

  it('throws when no shader compiles on a live context', () => {
    const gl = fakeGl({ maxCompilingIfs: null });

    expect(() => check(16, gl)).toThrow(/no fragment shader that compiles/);
    // 16, 8, 4, 2, 1: the empty source for 1 is the last one tried.
    expect(gl.state.compiles).toBe(5);
    expect(gl.state.deleted).toBe(1);
  });
});
