/**
 * The bundle graph's allow list (plan v3 §3), on fixture repositories: each kind of reference the
 * graph accepts is green, and every way past it is a problem (P1 QA5 K7, K8).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { bundleGraph } from './bundle.mjs';

const roots = [];
afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

const PAGE =
  '<!doctype html><html><head><link rel="stylesheet" href="/src/a.css"></head>' +
  '<body><script type="module" src="/src/main.ts"></script></body></html>';

const pkg = (name) => ({
  [`packages/web/node_modules/${name}/package.json`]: JSON.stringify({
    name,
    main: 'index.js',
    types: 'index.d.ts',
  }),
  [`packages/web/node_modules/${name}/index.js`]: 'export {};',
  [`packages/web/node_modules/${name}/index.d.ts`]: 'export {};',
  [`packages/web/node_modules/${name}/x.css`]: '',
});

/** A fixture repository with the web layout; `files` overrides or adds files. */
function fixture(files = {}) {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'ui-gate-bundle-'));
  roots.push(root);
  const all = {
    'packages/web/package.json': JSON.stringify({
      dependencies: { dep: '1.0.0' },
      devDependencies: { devdep: '1.0.0' },
    }),
    'packages/web/tsconfig.json': JSON.stringify({
      compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'bundler',
        noEmit: true,
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src'],
    }),
    'packages/web/index.html': PAGE,
    'packages/web/src/main.ts': '',
    'packages/web/src/b.ts': 'export {};',
    'packages/web/src/c.css': '',
    'packages/web/src/a.css': '',
    'packages/web/src/img.png': '',
    'packages/web/src/data.bin': '',
    'packages/web/src/boot/bootSplash.ts': '',
    ...pkg('dep'),
    ...pkg('devdep'),
    ...files,
  };
  for (const [file, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'pipe' });
  return root;
}

const PACKAGES = { dep: { field: 'dependencies', why: 'fixture' } };
const graph = (files, packages = PACKAGES) => bundleGraph(fixture(files), { packages });
const main = (text) => ({ 'packages/web/src/main.ts': text });

describe('bundle graph allow list', () => {
  it('follows every accepted kind of reference', () => {
    const result = graph(
      main(
        [
          "import './b';",
          "import '@/c.css';",
          "import image from './img.png?url';",
          "import 'dep';",
          'void image;',
          "void new URL('./img.png', import.meta.url);",
        ].join('\n'),
      ),
    );
    expect(result.problems).toEqual([]);
    expect(result.scripts).toEqual([
      'packages/web/src/b.ts',
      'packages/web/src/boot/bootSplash.ts',
      'packages/web/src/main.ts',
    ]);
    expect(result.styles).toEqual(['packages/web/src/a.css', 'packages/web/src/c.css']);
  });

  it.each([
    ["import 'devdep';", 'is not a registered package'],
    ["import 'nope';", 'is not a registered package'],
    ["import 'dep/missing';", 'does not resolve'],
    ["import 'dep/x.css';", 'package stylesheets bypass the gate'],
    ["import './missing';", 'does not resolve'],
    ["import './data.bin?url';", 'is not a checked module or a registered asset'],
    ["import './b.ts?raw';", 'is not a checked module or a registered asset'],
    ["const m = require('./b'); void m;", 'is not a bundled import'],
    ['declare const s: string; void import(s);', 'takes a literal specifier'],
    ["import 'https://example.com/x.js';", 'is a URL'],
    ["import 'data:text/javascript,export{}';", 'is a URL'],
    ['declare const s: string; void new URL(s, import.meta.url);', 'takes a literal relative path'],
    ["void new URL('./missing.ts', import.meta.url);", 'resolves to no file'],
    ["void new Worker('/w.js');", 'a worker takes'],
    ["void import.meta.glob('./**/*.ts');", 'only `*` and `{a,b}` lists'],
    ["void import.meta.glob('./*/x.ts');", 'only `*` and `{a,b}` lists'],
    // Glob syntax Vite reads that the gate would not expand (QA8 FIX-FIRST-1).
    ["void import.meta.glob('./g/x?.ts');", 'only `*` and `{a,b}` lists'],
    ["void import.meta.glob('./g/[xy]*.ts');", 'only `*` and `{a,b}` lists'],
    ["void import.meta.glob('./g/@(x|y).ts');", 'only `*` and `{a,b}` lists'],
    ["void import.meta.glob('./g/x{1..3}.ts');", 'is not a list of names'],
    ["void import.meta.glob('./*.ts', { base: './g' });", 'option `base` is not registered'],
    ["void import.meta.glob('./*.ts', { eager: 1 });", 'option `eager` takes a boolean literal'],
    [
      "declare const q: string; void import.meta.glob('./*.ts', { query: q });",
      'option `query` takes a string literal',
    ],
    ["declare const o: object; void import.meta.glob('./*.ts', o);", 'takes literal options'],
    ["void import.meta.glob('!./b.ts');", 'negated patterns'],
    ["void import.meta.glob('./nowhere/*.ts');", 'does not exist'],
    ["void import.meta.glob('lib/*.ts');", 'not relative, rooted or aliased'],
  ])('rejects %s', (text, problem) => {
    const { problems } = graph(main(text));
    expect(problems.some((line) => line.includes(problem))).toBe(true);
  });

  // Vite resolves glob patterns from the file, from the project root and through aliases, and
  // expands braces: each form reaches the modules it matches (P1 QA7 F3).
  const X = 'packages/web/src/g/x.ts';
  const Y = 'packages/web/src/g/y.tsx';
  it.each([
    ["void import.meta.glob('./g/*.ts');", [X]],
    ["void import.meta.glob('/src/g/*.ts');", [X]],
    ["void import.meta.glob('@/g/*.ts');", [X]],
    ["void import.meta.glob('./g/*.{ts,tsx}');", [X, Y]],
    ["void import.meta.glob(['./g/x.ts', '@/g/y.tsx']);", [X, Y]],
    ["void import.meta.glob('./g/*.ts', { eager: true, import: 'default', 'query': '' });", [X]],
  ])('follows the matches of %s', (text, matched) => {
    const result = graph({
      ...main(text),
      [X]: 'export {};',
      [Y]: 'export {};',
    });
    expect(result.problems).toEqual([]);
    expect(result.scripts.filter((file) => file.startsWith('packages/web/src/g/'))).toEqual(
      matched,
    );
  });

  it('accepts a package only through its registered entries (QA6 L7)', () => {
    const packages = { dep: { field: 'dependencies', why: 'fixture', entries: ['dep'] } };
    expect(graph(main("import 'dep';"), packages).problems).toEqual([]);
    for (const text of ["import 'dep/index.js';", "void import('dep/index.js');"]) {
      const { problems } = graph(main(text), packages);
      expect(problems.some((line) => line.includes('is not a registered entry'))).toBe(true);
    }
  });

  it('rejects an import through a symbolic link', () => {
    const root = fixture(main("import './link';"));
    fs.symlinkSync(
      path.join(root, 'packages/web/src/b.ts'),
      path.join(root, 'packages/web/src/link.ts'),
    );
    const { problems } = bundleGraph(root, { packages: PACKAGES });
    expect(problems.some((line) => line.includes('symbolic link'))).toBe(true);
  });

  it.each([
    [PAGE.replace('</body>', '<script>alert(1)</script></body>'), 'a page script is'],
    [PAGE.replace('</head>', '<link rel="preload" href="/x.css"></head>'), 'is not registered'],
    [PAGE.replace('</head>', '<style>a{}</style></head>'), 'is not a registered page element'],
    [PAGE.replace('<body>', '<body style="margin:0">'), 'is not registered for pages'],
    [PAGE.replace('/src/a.css', 'https://example.com/a.css'), 'must be a local .css file'],
  ])('rejects the page %s', (page, problem) => {
    const { problems } = graph({ 'packages/web/index.html': page });
    expect(problems.some((line) => line.includes(problem))).toBe(true);
  });

  it('accepts registered meta elements and pins theme-color to the palette (QA12 nit 7)', () => {
    const palette = {
      'packages/web/src/theme/colors.ts': "export const colors = { surface: '#FFFFFF' } as const;",
    };
    const meta = (tags) => ({
      ...palette,
      'packages/web/index.html': PAGE.replace('</head>', `${tags}</head>`),
    });
    expect(
      graph(
        meta(
          '<meta name="theme-color" content="#FFFFFF"><meta name="viewport" content="width=device-width"><meta property="og:title" content="x">',
        ),
      ).problems,
    ).toEqual([]);
    for (const [tags, problem] of [
      [
        '<meta name="theme-color" content="#FAFAFA">',
        '<meta name="theme-color"> is `#FAFAFA`; it must be colors.surface (#FFFFFF)',
      ],
      ['<meta name="color-scheme" content="dark">', '<meta name="color-scheme"> not registered'],
      ['<meta property="twitter:card" content="x">', '<meta property> not registered'],
    ]) {
      const { problems } = graph(meta(tags));
      // Paths are relative to the root the graph is read from (QA12 nit 5).
      expect(problems).toContainEqual(
        expect.stringContaining(`packages/web/index.html: ${problem}`),
      );
    }
    // A palette without the registered entry is a broken registration, not a page problem.
    expect(() =>
      graph({
        'packages/web/src/theme/colors.ts': 'export const colors = {};',
        'packages/web/index.html': PAGE.replace(
          '</head>',
          '<meta name="theme-color" content="#FFFFFF"></head>',
        ),
      }),
    ).toThrow('has no string literal colors.surface');
  });

  it('rejects a page under public/ and stylesheet imports that are not relative paths', () => {
    expect(
      graph({ 'packages/web/public/x.html': PAGE }).problems.some((line) =>
        line.includes('bypass the build'),
      ),
    ).toBe(true);
    expect(
      graph({ 'packages/web/src/a.css': '@import url(./c.css);' }).problems.some((line) =>
        line.includes('`@import` takes'),
      ),
    ).toBe(true);
  });

  it('keeps the registry and the web manifest in step', () => {
    expect(graph({}, {}).problems).toEqual([
      'packages/web/package.json: dependency `dep` is not registered',
    ]);
    expect(
      graph({}, { ...PACKAGES, devdep: { field: 'dependencies', why: 'fixture' } }).problems,
    ).toEqual(['registry: package `devdep` is not in the web dependencies']);
  });
});
