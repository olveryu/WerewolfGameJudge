/**
 * The UI gate's scope: the bundle graph of the web client (UI drift lock plan v3, §3).
 *
 * The entries are every page under the Vite root plus the entries a build plugin adds. From
 * them the graph follows every runtime import (`import`, `export … from`, literal `import()`,
 * `import.meta.glob`, CSS `@import`). Each specifier must land on something the gate checks or
 * a registered kind of leaf: a repository `.ts`/`.tsx` or `.css` file (checked), an asset with a
 * registered extension, a virtual icon module, or the script entry of a package the web client
 * declares. Anything else is a problem, so nothing reaches the page past the gate, and what is
 * bundled is checked whatever its path or name says (no test-file exception).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'parse5';
import postcss from 'postcss';
import ts from 'typescript';

import {
  ASSET_EXTENSIONS,
  ASSET_QUERIES,
  BUILD_ENTRIES,
  PAGE_ATTRIBUTES,
  PAGE_ELEMENTS,
  PAGE_HTTP_EQUIV,
  PAGE_LINK_RELS,
  VIRTUAL_MODULE_PREFIXES,
  WEB_ROOT,
} from './registry.mjs';

export const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

const SCRIPT = /\.(?:ts|tsx)$/;
const DECLARATION = /\.d\.ts$/;

function rel(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/');
}

function trackedFiles(root, pattern) {
  return execFileSync('git', ['ls-files', '-z', '--', pattern], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function compilerOptions(root) {
  const config = path.join(root, WEB_ROOT, 'tsconfig.json');
  const parsed = ts.getParsedCommandLineOfConfigFile(
    config,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic(diagnostic) {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  return parsed.options;
}

function webDependencies(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, WEB_ROOT, 'package.json'), 'utf8'));
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
}

function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Alias-aware path of a non-script specifier (`@/x.css`, `./a.png`), or undefined. */
function aliasedPath(specifier, from, options) {
  if (specifier.startsWith('.')) return path.resolve(path.dirname(from), specifier);
  for (const [pattern, [target]] of Object.entries(options.paths ?? {})) {
    const prefix = pattern.replace(/\*$/, '');
    if (pattern.endsWith('*') && specifier.startsWith(prefix)) {
      return path.resolve(
        options.pathsBasePath,
        target.replace(/\*$/, '') + specifier.slice(prefix.length),
      );
    }
  }
  return undefined;
}

/** Runtime module references of one script: `{ specifier, glob?, node }`, plus problems. */
function scriptReferences(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const references = [];
  const problems = [];
  const at = (node) =>
    `${rel(file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  const literal = (node) =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      ? node.text
      : undefined;
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      if (!node.importClause?.isTypeOnly)
        references.push({ specifier: literal(node.moduleSpecifier), at: at(node) });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (!node.isTypeOnly)
        references.push({ specifier: literal(node.moduleSpecifier), at: at(node) });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      problems.push(`${at(node)}: \`import … = require()\` is not a bundled import`);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = literal(node.arguments[0]);
        if (specifier === undefined)
          problems.push(`${at(node)}: \`import()\` takes a literal specifier`);
        else references.push({ specifier, at: at(node) });
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        problems.push(`${at(node)}: \`require()\` is not a bundled import`);
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'glob' &&
        ts.isMetaProperty(node.expression.expression)
      ) {
        const [patterns, options] = node.arguments;
        const list =
          patterns && ts.isArrayLiteralExpression(patterns) ? patterns.elements : [patterns];
        const query =
          options && ts.isObjectLiteralExpression(options)
            ? options.properties.find((p) => p.name?.getText() === 'query')
            : undefined;
        const queryText =
          query === undefined
            ? ''
            : ts.isPropertyAssignment(query)
              ? literal(query.initializer)
              : undefined;
        for (const element of list) {
          const pattern = literal(element);
          if (pattern === undefined || queryText === undefined) {
            problems.push(`${at(node)}: \`import.meta.glob\` takes literal patterns and query`);
          } else references.push({ specifier: pattern + queryText, glob: true, at: at(node) });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { references, problems };
}

function expandGlob(pattern, from) {
  const absolute = path.resolve(path.dirname(from), pattern);
  const directory = path.dirname(absolute);
  const name = new RegExp(
    `^${path
      .basename(absolute)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')}$`,
  );
  if (absolute.includes('**') || directory.includes('*')) return null;
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((entry) => name.test(entry))
    .map((entry) => path.join(directory, entry));
}

function pageEntries(root, file, problems) {
  const entries = [];
  const visit = (node) => {
    if (node.nodeName.startsWith('#')) {
      if (
        node.nodeName === '#text' ||
        node.nodeName === '#comment' ||
        node.nodeName === '#document'
      ) {
        // text and comments render nothing executable
      } else if (node.nodeName !== '#documentType')
        problems.push(`${rel(file)}: unexpected ${node.nodeName}`);
    } else {
      const attributes = new Map((node.attrs ?? []).map((attr) => [attr.name, attr.value]));
      if (!PAGE_ELEMENTS.has(node.nodeName))
        problems.push(`${rel(file)}: <${node.nodeName}> is not a registered page element`);
      for (const name of attributes.keys()) {
        if (!PAGE_ATTRIBUTES.has(name))
          problems.push(`${rel(file)}: attribute \`${name}\` is not registered for pages`);
      }
      const resolve = (href) =>
        path.resolve(
          href.startsWith('/') ? path.join(root, WEB_ROOT) : path.dirname(file),
          href.replace(/^\//, ''),
        );
      if (node.nodeName === 'script') {
        const src = attributes.get('src');
        if (
          attributes.get('type') !== 'module' ||
          !src ||
          /^[a-z]+:/i.test(src) ||
          !SCRIPT.test(src)
        ) {
          problems.push(`${rel(file)}: a page script is a module entry with a local .ts/.tsx src`);
        } else entries.push(resolve(src));
        if ((node.childNodes ?? []).length > 0) problems.push(`${rel(file)}: inline script`);
      }
      if (node.nodeName === 'link') {
        const linkRel = (attributes.get('rel') ?? '').toLowerCase();
        const href = attributes.get('href') ?? '';
        if (!PAGE_LINK_RELS.has(linkRel))
          problems.push(`${rel(file)}: <link rel="${linkRel}"> is not registered`);
        else if (linkRel === 'stylesheet') {
          if (/^[a-z]+:/i.test(href) || !href.endsWith('.css'))
            problems.push(`${rel(file)}: stylesheet link must be a local .css file`);
          else entries.push(resolve(href));
        }
      }
      if (node.nodeName === 'meta' && attributes.has('http-equiv')) {
        if (!PAGE_HTTP_EQUIV.has(attributes.get('http-equiv').toLowerCase()))
          problems.push(`${rel(file)}: <meta http-equiv> not registered`);
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(parse(fs.readFileSync(file, 'utf8')));
  return entries;
}

/**
 * The bundle graph: `{ scripts, styles, problems }` with repository-relative paths.
 * `root` defaults to the repository (tests pass a fixture root with the same layout).
 */
export function bundleGraph(root = REPO_ROOT) {
  const options = compilerOptions(root);
  const dependencies = webDependencies(root);
  const problems = [];
  const relative = (file) => path.relative(root, file).split(path.sep).join('/');

  const pages = trackedFiles(path.join(root, WEB_ROOT), '*.html').map((page) =>
    path.join(root, WEB_ROOT, page),
  );
  for (const page of pages) {
    if (relative(page).startsWith(`${WEB_ROOT}/public/`))
      problems.push(`${relative(page)}: pages under public/ bypass the build`);
  }
  const queue = [
    ...pages.flatMap((page) => pageEntries(root, page, problems)),
    ...BUILD_ENTRIES.map((entry) => path.join(root, entry)),
  ];
  const scripts = new Set();
  const styles = new Set();

  const leaf = (target, specifier, at) => {
    const [file, query = ''] = target.split(/(?=\?)/);
    const extension = path.extname(file).slice(1).toLowerCase();
    if (!fs.existsSync(file)) return problems.push(`${at}: \`${specifier}\` resolves to no file`);
    if (!relative(file).startsWith('..') && fs.realpathSync(file) !== path.resolve(file)) {
      return problems.push(`${at}: \`${specifier}\` goes through a symbolic link`);
    }
    if (relative(file).startsWith('..'))
      return problems.push(`${at}: \`${specifier}\` leaves the repository`);
    if (file.split(path.sep).includes('node_modules'))
      return problems.push(`${at}: \`${specifier}\` imports a file from a package`);
    if (extension === 'css' && query === '') return queue.push(file);
    if ((extension === 'ts' || extension === 'tsx') && query === '' && !DECLARATION.test(file))
      return queue.push(file);
    if (ASSET_EXTENSIONS.has(extension) && ASSET_QUERIES.has(query)) return undefined;
    return problems.push(`${at}: \`${specifier}\` is not a checked module or a registered asset`);
  };

  const followScript = (file) => {
    const { references, problems: own } = scriptReferences(file, fs.readFileSync(file, 'utf8'));
    problems.push(...own);
    for (const { specifier, glob, at } of references) {
      if (specifier === undefined) {
        problems.push(`${at}: non-literal module specifier`);
        continue;
      }
      if (glob) {
        const [pattern, query = ''] = specifier.split(/(?=\?)/);
        const matches = expandGlob(pattern, file);
        if (matches === null)
          problems.push(`${at}: \`import.meta.glob\` pattern must be one directory`);
        else for (const match of matches) leaf(match + query, specifier, at);
        continue;
      }
      if (VIRTUAL_MODULE_PREFIXES.some((prefix) => specifier.startsWith(prefix))) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(specifier)) {
        problems.push(`${at}: \`${specifier}\` is a URL`);
        continue;
      }
      const bare = !specifier.startsWith('.') && !specifier.startsWith('/');
      const aliased = aliasedPath(specifier.split('?')[0], file, options);
      const [specifierPath, query = ''] = specifier.split(/(?=\?)/);
      const extension = path.extname(specifierPath).slice(1).toLowerCase();
      if (
        (extension === 'css' || ASSET_EXTENSIONS.has(extension) || query !== '') &&
        (aliased || !bare)
      ) {
        leaf((aliased ?? path.resolve(path.dirname(file), specifierPath)) + query, specifier, at);
        continue;
      }
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      if (bare && !aliased) {
        if (!dependencies.has(packageName(specifier)))
          problems.push(`${at}: \`${specifier}\` is not a dependency of the web client`);
        else if (/\.css(\?|$)/.test(specifier))
          problems.push(`${at}: package stylesheets bypass the gate`);
        else if (resolved && !resolved.isExternalLibraryImport)
          leaf(resolved.resolvedFileName, specifier, at);
        continue;
      }
      if (!resolved) problems.push(`${at}: \`${specifier}\` does not resolve`);
      else leaf(resolved.resolvedFileName, specifier, at);
    }
  };

  const followStyle = (file) => {
    postcss.parse(fs.readFileSync(file, 'utf8'), { from: file }).walkAtRules('import', (rule) => {
      const at = `${relative(file)}:${rule.source.start.line}`;
      const match = rule.params.match(/^(['"])(\.{1,2}\/[^'"]+\.css)\1$/);
      if (!match) problems.push(`${at}: \`@import\` takes a quoted relative path to a .css file`);
      else leaf(path.resolve(path.dirname(file), match[2]), match[2], at);
    });
  };

  while (queue.length > 0) {
    const file = path.resolve(queue.pop());
    const key = relative(file);
    if (key.startsWith('..')) {
      problems.push(`${key}: entry leaves the repository`);
      continue;
    }
    if (file.endsWith('.css')) {
      if (styles.has(key)) continue;
      styles.add(key);
      followStyle(file);
    } else {
      if (scripts.has(key)) continue;
      scripts.add(key);
      followScript(file);
    }
  }
  return {
    scripts: [...scripts].sort(),
    styles: [...styles].sort(),
    problems: [...new Set(problems)].sort(),
  };
}
