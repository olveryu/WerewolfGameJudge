/**
 * The UI gate's scope: the bundle graph of the web client (UI drift lock plan v3, §3).
 *
 * The entries are every page under the Vite root plus the entries a build plugin adds. From
 * them the graph follows every runtime import (`import`, `export … from`, literal `import()`,
 * `import.meta.glob`, `new URL('./x', import.meta.url)`, CSS `@import` and relative `url()`; a worker takes only the
 * latter). Each specifier must land on something the gate checks or a registered kind of leaf:
 * a repository `.ts`/`.tsx` or `.css` file (checked), an asset with a registered extension, a
 * virtual icon module, or the resolved script entry of a package registered in `PACKAGES`
 * (which must match the web manifest). Anything else is a problem, so nothing reaches the page past the gate, and what is
 * bundled is checked whatever its path or name says (no test-file exception).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'parse5';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import ts from 'typescript';

import {
  adapterOf,
  ASSET_EXTENSIONS,
  ASSET_QUERIES,
  BUILD_ENTRIES,
  DECLARATION_FILE,
  GLOB_BRACE,
  GLOB_NAME,
  GLOB_OPTIONS,
  GLOB_PATH,
  PACKAGES,
  PAGE_ATTRIBUTES,
  PAGE_ELEMENTS,
  PAGE_HTTP_EQUIV,
  PAGE_META_NAMES,
  PAGE_META_PROPERTIES,
  PALETTE,
  PAGE_LINK_RELS,
  SCRIPT_FILE,
  ICON_COLLECTION_PACKAGE,
  VIRTUAL_MODULE_FAMILY,
  VIRTUAL_MODULES,
  WORKER_CONSTRUCTORS,
  WEB_ROOT,
} from './registry.mjs';

export const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

/** A path relative to the root the graph is read from (a base worktree reports its own paths). */
function relativeTo(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
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

/**
 * The packages the bundle may import: registered in `PACKAGES` and declared in that field of
 * the web manifest. Every manifest dependency must be registered, so adding one is a registry
 * change a reviewer sees.
 */
function webPackages(root, packages, problems) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, WEB_ROOT, 'package.json'), 'utf8'));
  const allowed = new Set();
  // A manifest may omit the `dependencies` field; every registered package is checked below.
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (packages[name]?.field !== 'dependencies')
      problems.push(`${WEB_ROOT}/package.json: dependency \`${name}\` is not registered`);
  }
  for (const [name, { field }] of Object.entries(packages)) {
    if (manifest[field]?.[name] === undefined)
      problems.push(`registry: package \`${name}\` is not in the web ${field}`);
    else allowed.add(name);
  }
  // Icon collections inline their SVG through a virtual module: each is registered.
  const collections = new Set(Object.values(VIRTUAL_MODULES).map((module) => module.package));
  for (const field of ['dependencies', 'devDependencies'])
    for (const name of Object.keys(manifest[field] ?? {}))
      if (ICON_COLLECTION_PACKAGE.test(name) && !collections.has(name))
        problems.push(`${WEB_ROOT}/package.json: icon collection \`${name}\` is not registered`);
  for (const [prefix, module] of Object.entries(VIRTUAL_MODULES))
    if (manifest[module.field]?.[module.package] === undefined)
      problems.push(
        `registry: \`${module.package}\` (serving \`${prefix}\`) is not in the web ${module.field}`,
      );
  return allowed;
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
function scriptReferences(root, file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const references = [];
  const problems = [];
  const at = (node) =>
    `${relativeTo(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
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
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      // `new Foo` without parentheses has no argument list.
      const [first, second] = node.arguments ?? [];
      const name = node.expression.text;
      const isModuleUrl = (expression) =>
        expression !== undefined &&
        ts.isPropertyAccessExpression(expression) &&
        expression.name.text === 'url' &&
        ts.isMetaProperty(expression.expression);
      if (name === 'URL' && isModuleUrl(second)) {
        // Vite bundles `new URL('./x', import.meta.url)` as an asset or module of this graph.
        const specifier = literal(first);
        if (specifier === undefined || !specifier.startsWith('.'))
          problems.push(
            `${at(node)}: \`new URL(…, import.meta.url)\` takes a literal relative path`,
          );
        else references.push({ specifier, url: true, at: at(node) });
      } else if (WORKER_CONSTRUCTORS.has(name)) {
        const ok =
          first !== undefined &&
          ts.isNewExpression(first) &&
          ts.isIdentifier(first.expression) &&
          first.expression.text === 'URL' &&
          isModuleUrl(first.arguments?.[1]);
        if (!ok) problems.push(`${at(node)}: a worker takes \`new URL('./x', import.meta.url)\``);
      }
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
        const [patterns, options, ...rest] = node.arguments;
        const list =
          patterns && ts.isArrayLiteralExpression(patterns) ? patterns.elements : [patterns];
        const { query, problem } = globOptions(options, literal);
        if (rest.length > 0 || problem !== undefined) {
          problems.push(
            `${at(node)}: \`import.meta.glob\` ${problem ?? 'takes a pattern and options'}`,
          );
        } else
          for (const element of list) {
            const pattern = literal(element);
            if (pattern === undefined)
              problems.push(`${at(node)}: \`import.meta.glob\` takes literal patterns`);
            // `?` is a glob wildcard here, not a query (queries go in the `query` option).
            else if (pattern.includes('?'))
              problems.push(
                `${at(node)}: \`import.meta.glob('${pattern}')\`: only \`*\` and \`{a,b}\` lists are expanded`,
              );
            else references.push({ specifier: pattern + query, glob: true, at: at(node) });
          }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { references, problems };
}

/**
 * The options of an `import.meta.glob` call: only `GLOB_OPTIONS` keys, as literals, are read
 * (`base` or any option that changes which files match is a problem, P1 QA8 FIX-FIRST-1).
 */
function globOptions(options, literal) {
  if (options === undefined) return { query: '' };
  if (!ts.isObjectLiteralExpression(options)) return { problem: 'takes literal options' };
  let query = '';
  for (const property of options.properties) {
    const name =
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        ? property.name.text
        : undefined;
    if (name === undefined || !GLOB_OPTIONS.has(name))
      return { problem: `option \`${property.name?.getText() ?? '…'}\` is not registered` };
    const value = property.initializer;
    if (name === 'eager') {
      if (value.kind !== ts.SyntaxKind.TrueKeyword && value.kind !== ts.SyntaxKind.FalseKeyword)
        return { problem: 'option `eager` takes a boolean literal' };
    } else if (literal(value) === undefined)
      return { problem: `option \`${name}\` takes a string literal` };
    if (name === 'query') query = literal(value);
  }
  return { query };
}

/**
 * The files one `import.meta.glob` pattern matches, or a problem. The pattern is resolved the way
 * Vite resolves it, relative (`./x/*.ts`), from the project root (`/src/x/*.ts`) or through an
 * alias (`@/x/*.ts`), and braces (`*.{ts,tsx}`) expand to their alternatives. A shape the gate
 * cannot expand exactly (`**`, a wildcard directory, a negation) or a directory that does not
 * exist is a problem: a pattern the gate reads as empty would put its modules in the page
 * unchecked (P1 QA7 F3).
 */
function expandGlob(pattern, from, root, options) {
  if (pattern.startsWith('!')) return { problem: 'negated patterns are not expanded' };
  const braces = pattern.match(/\{([^{}]*)\}/);
  if (braces) {
    if (!GLOB_BRACE.test(braces[1])) return { problem: `\`${braces[0]}\` is not a list of names` };
    const results = braces[1]
      .split(',')
      .map((choice) => expandGlob(pattern.replace(braces[0], choice), from, root, options));
    const failed = results.find((result) => result.problem !== undefined);
    return failed ?? { matches: [...new Set(results.flatMap((result) => result.matches))] };
  }
  // Only `*` is a wildcard the gate expands; any other glob syntax Vite (picomatch) reads (`?`,
  // `[…]`, `@(…)`, ranges) would match files the gate does not see (P1 QA8 FIX-FIRST-1).
  if (!GLOB_PATH.test(path.posix.dirname(pattern)) || !GLOB_NAME.test(path.posix.basename(pattern)))
    return { problem: 'only `*` and `{a,b}` lists are expanded' };
  const absolute = pattern.startsWith('.')
    ? path.resolve(path.dirname(from), pattern)
    : pattern.startsWith('/')
      ? path.join(root, WEB_ROOT, pattern)
      : aliasedPath(pattern, from, options);
  if (absolute === undefined) return { problem: 'the pattern is not relative, rooted or aliased' };
  const directory = path.dirname(absolute);
  if (absolute.includes('**') || /[*?[\]]/.test(directory))
    return { problem: 'the pattern must match files of one directory' };
  if (!fs.existsSync(directory))
    return { problem: `${relativeTo(root, directory)} does not exist` };
  const name = new RegExp(
    `^${path
      .basename(absolute)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')}$`,
  );
  return {
    matches: fs
      .readdirSync(directory)
      .filter((entry) => name.test(entry))
      .map((entry) => path.join(directory, entry)),
  };
}

/**
 * The value of `colors.<key>` in the palette module, read from its source: a string literal of
 * the exported `colors` object (`as const` included). Anything else is a broken registration and throws.
 */
function paletteColor(root, key) {
  const file = path.join(root, PALETTE);
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText() !== 'colors') continue;
      // `{ … } as const`: the object is the asserted expression.
      const written = declaration.initializer;
      const object = written && ts.isAsExpression(written) ? written.expression : written;
      const entry =
        object && ts.isObjectLiteralExpression(object)
          ? object.properties.find(
              (property) => ts.isPropertyAssignment(property) && property.name.getText() === key,
            )
          : undefined;
      if (entry && ts.isStringLiteral(entry.initializer)) return entry.initializer.text;
    }
  }
  throw new Error(`UI gate: ${PALETTE} has no string literal colors.${key} (PAGE_META_NAMES)`);
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
        problems.push(`${relativeTo(root, file)}: unexpected ${node.nodeName}`);
    } else {
      // parse5: only element nodes carry `attrs`/`childNodes`; text and comments have neither.
      const attributes = new Map((node.attrs ?? []).map((attr) => [attr.name, attr.value]));
      if (!PAGE_ELEMENTS.has(node.nodeName))
        problems.push(
          `${relativeTo(root, file)}: <${node.nodeName}> is not a registered page element`,
        );
      for (const name of attributes.keys()) {
        if (!PAGE_ATTRIBUTES.has(name))
          problems.push(
            `${relativeTo(root, file)}: attribute \`${name}\` is not registered for pages`,
          );
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
          !SCRIPT_FILE.test(src)
        ) {
          problems.push(
            `${relativeTo(root, file)}: a page script is a module entry with a local .ts/.tsx src`,
          );
        } else entries.push(resolve(src));
        if ((node.childNodes ?? []).length > 0)
          problems.push(`${relativeTo(root, file)}: inline script`);
      }
      if (node.nodeName === 'link') {
        const linkRel = (attributes.get('rel') ?? '').toLowerCase();
        const href = attributes.get('href') ?? '';
        if (!PAGE_LINK_RELS.has(linkRel))
          problems.push(`${relativeTo(root, file)}: <link rel="${linkRel}"> is not registered`);
        else if (linkRel === 'stylesheet') {
          if (/^[a-z]+:/i.test(href) || !href.endsWith('.css'))
            problems.push(`${relativeTo(root, file)}: stylesheet link must be a local .css file`);
          else entries.push(resolve(href));
        }
      }
      if (node.nodeName === 'meta' && attributes.has('http-equiv')) {
        if (!PAGE_HTTP_EQUIV.has(attributes.get('http-equiv').toLowerCase()))
          problems.push(`${relativeTo(root, file)}: <meta http-equiv> not registered`);
      }
      if (node.nodeName === 'meta' && attributes.has('property')) {
        if (!PAGE_META_PROPERTIES.has(attributes.get('property')))
          problems.push(`${relativeTo(root, file)}: <meta property> not registered`);
      }
      if (node.nodeName === 'meta' && attributes.has('name')) {
        const name = attributes.get('name');
        if (!Object.hasOwn(PAGE_META_NAMES, name))
          problems.push(`${relativeTo(root, file)}: <meta name="${name}"> not registered`);
        else if (PAGE_META_NAMES[name] !== null) {
          const color = paletteColor(root, PAGE_META_NAMES[name]);
          if (attributes.get('content') !== color)
            problems.push(
              `${relativeTo(root, file)}: <meta name="${name}"> is \`${attributes.get('content')}\`; it must be colors.${PAGE_META_NAMES[name]} (${color}) in ${PALETTE}`,
            );
        }
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
export function bundleGraph(root = REPO_ROOT, { packages = PACKAGES } = {}) {
  const options = compilerOptions(root);
  const problems = [];
  const dependencies = webPackages(root, packages, problems);
  const relative = (file) => relativeTo(root, file);

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
  // `specifier\0module` for each registered importer seen importing its entry.
  const importing = new Set();

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
    if ((extension === 'ts' || extension === 'tsx') && query === '' && !DECLARATION_FILE.test(file))
      return queue.push(file);
    if (ASSET_EXTENSIONS.has(extension) && ASSET_QUERIES.has(query)) return undefined;
    return problems.push(`${at}: \`${specifier}\` is not a checked module or a registered asset`);
  };

  const followScript = (file) => {
    const { references, problems: own } = scriptReferences(
      root,
      file,
      fs.readFileSync(file, 'utf8'),
    );
    problems.push(...own);
    for (const { specifier, glob, url, at } of references) {
      if (specifier === undefined) {
        problems.push(`${at}: non-literal module specifier`);
        continue;
      }
      if (url) {
        leaf(path.resolve(path.dirname(file), specifier), specifier, at);
        continue;
      }
      if (glob) {
        const [pattern, query = ''] = specifier.split(/(?=\?)/);
        const { matches, problem } = expandGlob(pattern, file, root, options);
        if (problem !== undefined)
          problems.push(`${at}: \`import.meta.glob('${pattern}')\`: ${problem}`);
        else for (const match of matches) leaf(match + query, specifier, at);
        continue;
      }
      if (specifier.startsWith(VIRTUAL_MODULE_FAMILY)) {
        if (!Object.keys(VIRTUAL_MODULES).some((prefix) => specifier.startsWith(prefix)))
          problems.push(`${at}: \`${specifier}\` is not a registered virtual module`);
        continue;
      }
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
          problems.push(`${at}: \`${specifier}\` is not a registered package of the web client`);
        else if (packages[packageName(specifier)].entries?.includes(specifier) === false)
          problems.push(`${at}: \`${specifier}\` is not a registered entry of its package`);
        else if (/\.css(\?|$)/.test(specifier))
          problems.push(`${at}: package stylesheets bypass the gate`);
        else if (!resolved) problems.push(`${at}: \`${specifier}\` does not resolve`);
        else if (!resolved.isExternalLibraryImport) leaf(resolved.resolvedFileName, specifier, at);
        // Who may import an entry is `ui/package-adapter`'s; the graph records the adapters it
        // sees importing theirs, so a registration is never stale.
        else if (adapterOf(specifier, packages)?.adapter === relative(file))
          importing.add(`${specifier}\u0000${relative(file)}`);
        continue;
      }
      if (!resolved) problems.push(`${at}: \`${specifier}\` does not resolve`);
      else leaf(resolved.resolvedFileName, specifier, at);
    }
  };

  const followStyle = (file) => {
    let sheet;
    try {
      sheet = postcss.parse(fs.readFileSync(file, 'utf8'), { from: file });
    } catch (error) {
      if (error?.name !== 'CssSyntaxError') throw error;
      // Stylelint reports the same error as a gate problem; the graph only stops following.
      return;
    }
    sheet.walkAtRules('import', (rule) => {
      const at = `${relative(file)}:${rule.source.start.line}`;
      const match = rule.params.match(/^(['"])(\.{1,2}\/[^'"]+\.css)\1$/);
      if (!match) problems.push(`${at}: \`@import\` takes a quoted relative path to a .css file`);
      else leaf(path.resolve(path.dirname(file), match[2]), match[2], at);
    });
    // A relative `url()` is an edge to the asset Vite bundles (P1 QA17 F5); the value check
    // reports every other `url()` (`data:`, remote, absolute), so only these are followed here.
    sheet.walkDecls((decl) => {
      valueParser(decl.value).walk((node) => {
        if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return;
        const argument = node.nodes.find((child) => child.type !== 'space');
        const target = argument?.value ?? '';
        if (/^\.{1,2}\//.test(target))
          leaf(
            path.resolve(path.dirname(file), target),
            target,
            `${relative(file)}:${decl.source.start.line}`,
          );
      });
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
  // An adapter is exact: a registered module that does not import its entry is stale, and a
  // package with adapters registers one (or null) for each of its entries.
  for (const [name, { entries = [], adapters }] of Object.entries(packages)) {
    if (adapters === undefined) continue;
    const listed = Object.keys(adapters).sort();
    if (JSON.stringify(listed) !== JSON.stringify([...entries].sort()))
      problems.push(
        `registry: ${name} registers adapters for ${listed.join(', ')}, not its entries`,
      );
    for (const [specifier, module] of Object.entries(adapters))
      if (module !== null && !importing.has(`${specifier}\u0000${module}`))
        problems.push(
          `registry: \`${module}\` is the adapter of \`${specifier}\` (${name}) but does not import it`,
        );
  }
  return {
    scripts: [...scripts].sort(),
    styles: [...styles].sort(),
    problems: [...new Set(problems)].sort(),
  };
}
