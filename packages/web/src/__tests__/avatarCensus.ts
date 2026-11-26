/**
 * Avatar site census for the avatar shape contract: where every avatar lands in the page, read
 * from the TSX source with the TypeScript parser.
 *
 * A carrier is a component that renders an avatar (`Avatar`, `ResidentAvatarTile`, and every
 * component found returning one). It is tracked by its declaration, so an aliased, namespaced or
 * re-exported import reaches it under any local name. Each site of a carrier is traced out
 * through the elements around it to the box drawn around it, and recorded as
 * `<Carrier> in <link> < <link> …`. The census fails closed: what it cannot follow is recorded as
 * `?` (and the contract fails on it), never skipped:
 *
 * - a class it cannot read (a call, a parameter, a `let`, a name declared twice in the file, a
 *   spread of props, which may carry one);
 * - a carrier used other than as a JSX tag, or a helper other than called (`createElement`, a
 *   local alias, a component passed as a prop): recorded as `<Name> referenced in ?`;
 * - a site in a position it does not model, or returned by an anonymous function.
 *
 * Links: an element reads as its classes, or `<Tag>` when it has none; the carrier's own classes,
 * if any, come first as `own …`. A component (`<Tag>`, or `<Tag prop>` when the site is passed as
 * one of its props, `children` when nested) ends the chain at the call; when the component is
 * declared under `src`, each read of that prop in its first parameter (destructured, or
 * `props.<prop>`) is followed on from there as `via <Tag>.<prop>`. A prop the component hands on
 * under another name, or a component from a package, is not followed: its name in the census is
 * the cue to read it. Fragments, inline JSX callbacks (`.map`, render props) and
 * IIFEs are transparent. A site a function returns ends in `returned by <Fn>`, and the function
 * becomes a carrier (a lowercase helper: its calls become sites). A site stored in a `const` is
 * followed to every read of that name (`via <name>`); one stored in an object property is followed
 * to every read of that property name in the same file (`via .<prop>`), not to reads in other
 * files.
 */
import { join, relative } from 'node:path';

import ts from 'typescript';

/** A declaration: the file that declares it and its name there. */
export interface DeclarationRef {
  readonly file: string;
  readonly name: string;
}

export interface CensusInput {
  /** Absolute path of the `src` root that `@/` resolves to; census keys are relative to it. */
  readonly srcDir: string;
  /** The files to take the census of (absolute paths). */
  readonly files: readonly string[];
  /** Reads a source file; undefined when it does not exist. */
  readonly read: (path: string) => string | undefined;
  /** The carriers to start from. */
  readonly carriers: readonly DeclarationRef[];
  /** Do these classes name the box drawn around an avatar (where a chain ends)? */
  readonly endsChain: (names: readonly string[]) => boolean;
}

interface Binding {
  /** `local`: declared at module level here; `import`: imported (`*` for a namespace). */
  readonly kind: 'local' | 'import';
  readonly module?: string;
  readonly name: string;
  readonly initializer?: ts.Expression;
  /** A local declared once in the file, as a `const`, function or class: its value is known. */
  readonly fixed: boolean;
}

interface ExportEntry {
  readonly local?: string;
  readonly module?: string;
  readonly name?: string;
}

interface Module {
  readonly path: string;
  readonly source: ts.SourceFile;
  /** How many times each name is declared anywhere in the file. */
  readonly declarations: Map<string, number>;
  readonly bindings: Map<string, Binding>;
  readonly exports: Map<string, ExportEntry>;
  readonly starExports: string[];
}

/** What the census records for a class or link it cannot read. */
const UNREAD = '?';

const keyOf = (declaration: DeclarationRef) => `${declaration.file}#${declaration.name}`;
const words = (text: string) => text.split(/\s+/).filter((word) => word !== '');
const LOGICAL = [
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
];

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function isTagName(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    (ts.isJsxOpeningElement(parent) ||
      ts.isJsxSelfClosingElement(parent) ||
      ts.isJsxClosingElement(parent)) &&
    parent.tagName === node
  );
}

/** Is this identifier the name a declaration, property or attribute introduces? */
function isDeclarationName(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent)) return parent.name === node;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent)) {
    return true;
  }
  return (
    (ts.isVariableDeclaration(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isBindingElement(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isJsxAttribute(parent)) &&
    parent.name === node
  );
}

/** Is this function transparent to a site in it: an inline JSX callback, or an IIFE? */
function isTransparentFunction(fn: ts.Node): boolean {
  if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return false;
  let node: ts.Node = fn;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  if (ts.isCallExpression(node.parent) && node.parent.expression === node) return true;
  let up: ts.Node = node.parent;
  while (
    ts.isCallExpression(up) ||
    ts.isParenthesizedExpression(up) ||
    ts.isPropertyAccessExpression(up)
  ) {
    up = up.parent;
  }
  return ts.isJsxExpression(up) || ts.isJsxAttribute(up);
}

/** A function's name, through `memo(…)` / `forwardRef(…)` wrappers; undefined if anonymous. */
function nameOf(fn: ts.Node): string | undefined {
  if ((ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn)) && fn.name) {
    return fn.name.text;
  }
  let node: ts.Node = fn;
  while (ts.isParenthesizedExpression(node.parent) || ts.isCallExpression(node.parent)) {
    node = node.parent;
  }
  const parent = node.parent;
  return ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)
    ? parent.name.text
    : undefined;
}

/** Every avatar site per file (relative to `srcDir`), as described above. */
export function avatarCensus(input: CensusInput): Record<string, string[]> {
  const modules = new Map<string, Module | null>();

  const resolveModule = (from: string, specifier: string): string | undefined => {
    let base: string;
    if (specifier.startsWith('@/')) base = join(input.srcDir, specifier.slice(2));
    else if (specifier.startsWith('.')) base = join(from, '..', specifier);
    else return undefined;
    return ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
      .map((extension) => base + extension)
      .find((path) => /\.tsx?$/.test(path) && input.read(path) !== undefined);
  };

  const moduleOf = (path: string): Module | undefined => {
    const cached = modules.get(path);
    if (cached !== undefined) return cached ?? undefined;
    const text = input.read(path);
    if (text === undefined) {
      modules.set(path, null);
      return undefined;
    }
    const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
    const module: Module = {
      path,
      source,
      declarations: new Map(),
      bindings: new Map(),
      exports: new Map(),
      starExports: [],
    };
    modules.set(path, module);
    const declare = (name: string) =>
      module.declarations.set(name, (module.declarations.get(name) ?? 0) + 1);
    const visit = (node: ts.Node) => {
      if (
        (ts.isVariableDeclaration(node) ||
          ts.isParameter(node) ||
          ts.isBindingElement(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isClassDeclaration(node)) &&
        node.name !== undefined &&
        ts.isIdentifier(node.name)
      ) {
        declare(node.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const target = resolveModule(path, statement.moduleSpecifier.text);
        const clause = statement.importClause;
        if (target === undefined || clause === undefined) continue;
        const bind = (local: string, name: string) =>
          module.bindings.set(local, { kind: 'import', module: target, name, fixed: true });
        if (clause.name) bind(clause.name.text, 'default');
        const named = clause.namedBindings;
        if (named && ts.isNamespaceImport(named)) bind(named.name.text, '*');
        else if (named) {
          for (const element of named.elements) {
            bind(element.name.text, (element.propertyName ?? element.name).text);
          }
        }
      } else if (ts.isExportDeclaration(statement)) {
        const target =
          statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
            ? resolveModule(path, statement.moduleSpecifier.text)
            : undefined;
        const clause = statement.exportClause;
        if (clause === undefined) {
          if (target !== undefined) module.starExports.push(target);
        } else if (ts.isNamedExports(clause)) {
          for (const element of clause.elements) {
            const name = (element.propertyName ?? element.name).text;
            module.exports.set(
              element.name.text,
              target === undefined ? { local: name } : { module: target, name },
            );
          }
        }
      } else if (ts.isVariableStatement(statement)) {
        const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) continue;
          const name = declaration.name.text;
          module.bindings.set(name, {
            kind: 'local',
            name,
            initializer: declaration.initializer,
            fixed: isConst && module.declarations.get(name) === 1,
          });
          if (hasExportModifier(statement)) module.exports.set(name, { local: name });
        }
      } else if (
        (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
        statement.name
      ) {
        const name = statement.name.text;
        const fixed = module.declarations.get(name) === 1;
        module.bindings.set(name, { kind: 'local', name, fixed });
        if (hasExportModifier(statement)) module.exports.set(name, { local: name });
      }
    }
    return module;
  };

  /** The declaration an export stands for, through re-exports. */
  const resolveExport = (
    path: string,
    name: string,
    seen: Set<string> = new Set(),
  ): DeclarationRef | undefined => {
    const key = `${path}#${name}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    const module = moduleOf(path);
    if (module === undefined) return undefined;
    const entry = module.exports.get(name);
    if (entry?.local !== undefined) return resolveName(module, entry.local, seen);
    if (entry?.module !== undefined && entry.name !== undefined) {
      return resolveExport(entry.module, entry.name, seen);
    }
    for (const star of module.starExports) {
      const found = resolveExport(star, name, seen);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  /** The declaration a module-level name stands for. */
  const resolveName = (
    module: Module,
    name: string,
    seen: Set<string> = new Set(),
  ): DeclarationRef | undefined => {
    const binding = module.bindings.get(name);
    if (binding === undefined) return undefined;
    if (binding.kind === 'import' && binding.module !== undefined) {
      return binding.name === '*' ? undefined : resolveExport(binding.module, binding.name, seen);
    }
    return { file: module.path, name };
  };

  /** The declaration an identifier or `namespace.member` stands for, if any. */
  const resolveReference = (module: Module, node: ts.Node): DeclarationRef | undefined => {
    if (ts.isIdentifier(node)) {
      const binding = module.bindings.get(node.text);
      if (binding?.kind !== 'import' && (module.declarations.get(node.text) ?? 0) > 1) {
        return undefined;
      }
      return (
        resolveName(module, node.text) ??
        (module.declarations.get(node.text) === 1
          ? { file: module.path, name: node.text }
          : undefined)
      );
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const binding = module.bindings.get(node.expression.text);
      if (binding?.kind === 'import' && binding.name === '*' && binding.module !== undefined) {
        return resolveExport(binding.module, node.name.text);
      }
    }
    return undefined;
  };

  const classNamesOf = (
    module: Module,
    expression: ts.Node | undefined,
    seen: Set<string> = new Set(),
  ): string[] => {
    if (expression === undefined) return [];
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return words(expression.text);
    }
    if (ts.isTemplateExpression(expression)) {
      return [
        ...words(expression.head.text),
        ...expression.templateSpans.flatMap((span) => [
          ...classNamesOf(module, span.expression, seen),
          ...words(span.literal.text),
        ]),
      ];
    }
    if (
      expression.kind === ts.SyntaxKind.NullKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      expression.kind === ts.SyntaxKind.TrueKeyword
    ) {
      return [];
    }
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isJsxExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    ) {
      return classNamesOf(module, expression.expression, seen);
    }
    if (ts.isConditionalExpression(expression)) {
      return [
        ...classNamesOf(module, expression.whenTrue, seen),
        ...classNamesOf(module, expression.whenFalse, seen),
      ];
    }
    if (ts.isBinaryExpression(expression) && LOGICAL.includes(expression.operatorToken.kind)) {
      const right = classNamesOf(module, expression.right, seen);
      if (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return right;
      return [...classNamesOf(module, expression.left, seen), ...right];
    }
    if (ts.isIdentifier(expression)) {
      if (expression.text === 'undefined') return [];
      const declaration = resolveReference(module, expression);
      if (declaration === undefined) return [UNREAD];
      const key = keyOf(declaration);
      if (seen.has(key)) return [UNREAD];
      seen.add(key);
      const owner = moduleOf(declaration.file);
      const binding = owner?.bindings.get(declaration.name);
      if (owner === undefined || binding?.kind !== 'local' || !binding.fixed) return [UNREAD];
      return binding.initializer === undefined
        ? [UNREAD]
        : classNamesOf(owner, binding.initializer, seen);
    }
    return [UNREAD];
  };

  const openingOf = (element: ts.JsxElement | ts.JsxSelfClosingElement) =>
    ts.isJsxElement(element) ? element.openingElement : element;

  /**
   * An element's classes, with `?` for a spread of props that a later `className` does not
   * override (the last attribute wins).
   */
  const classesOf = (
    module: Module,
    element: ts.JsxElement | ts.JsxSelfClosingElement,
    spreadMayCarryClass = true,
  ) => {
    const names: string[] = [];
    let spread = false;
    for (const attribute of openingOf(element).attributes.properties) {
      if (ts.isJsxSpreadAttribute(attribute)) {
        spread = spreadMayCarryClass;
      } else if (attribute.name.getText() === 'className') {
        names.length = 0;
        names.push(...classNamesOf(module, attribute.initializer));
        spread = false;
      }
    }
    return [...new Set(spread ? [...names, UNREAD] : names)];
  };

  const isFragment = (module: Module, element: ts.JsxElement) => {
    const tag = element.openingElement.tagName;
    const text = tag.getText();
    return (
      text === 'Fragment' ||
      text === 'React.Fragment' ||
      resolveReference(module, tag)?.name === 'Fragment'
    );
  };

  const carriers = new Map(input.carriers.map((carrier) => [keyOf(carrier), carrier]));
  const helpers = new Map<string, DeclarationRef>();
  const holders = new Set<string>();
  const heldProperties = new Map<string, Set<string>>();
  /** Props of components in `src` a site is passed in (`children` for nested JSX). */
  const slots = new Map<string, Set<string>>();
  const slotFiles = new Set<string>();
  const sizeOf = (sets: Map<string, Set<string>>) =>
    [...sets.values()].reduce((sum, names) => sum + names.size, 0);
  const found = () =>
    carriers.size + helpers.size + holders.size + sizeOf(heldProperties) + sizeOf(slots);

  /** A component element's prop holds a site: trace its reads in the component's source. */
  const slot = (module: Module, tag: ts.JsxTagNameExpression, prop: string) => {
    const declaration = resolveReference(module, tag);
    if (declaration === undefined || moduleOf(declaration.file) === undefined) return;
    const key = keyOf(declaration);
    slotFiles.add(declaration.file);
    const props = slots.get(key) ?? new Set<string>();
    props.add(prop);
    slots.set(key, props);
  };

  const release = (module: Module, fn: ts.Node): string => {
    const name = nameOf(fn);
    if (name === undefined || (module.declarations.get(name) ?? 0) > 1) {
      return `returned by ${UNREAD}`;
    }
    const declaration: DeclarationRef = { file: module.path, name };
    if (/^[A-Z]/.test(name)) carriers.set(keyOf(declaration), declaration);
    else helpers.set(keyOf(declaration), declaration);
    return `returned by ${name}`;
  };

  /** Traces a site (an element, a helper call, a read of a holder) out to its box. */
  const trace = (module: Module, site: ts.Node): string[] => {
    const links: string[] = [];
    let node: ts.Node = site;
    for (;;) {
      const parent: ts.Node | undefined = node.parent;
      if (parent === undefined) return [...links, UNREAD];
      const passesThrough =
        ts.isParenthesizedExpression(parent) ||
        ts.isJsxExpression(parent) ||
        ts.isArrayLiteralExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isSatisfiesExpression(parent) ||
        ts.isNonNullExpression(parent) ||
        ts.isJsxFragment(parent) ||
        (ts.isConditionalExpression(parent) && parent.condition !== node) ||
        (ts.isBinaryExpression(parent) &&
          LOGICAL.includes(parent.operatorToken.kind) &&
          (parent.right === node ||
            parent.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken));
      if (passesThrough) {
        node = parent;
        continue;
      }
      if (ts.isJsxElement(parent)) {
        if (parent.openingElement === node || parent.closingElement === node) {
          return [...links, UNREAD];
        }
        if (isFragment(module, parent)) {
          node = parent;
          continue;
        }
        const tag = parent.openingElement.tagName.getText();
        const names = classesOf(module, parent);
        if (/^[A-Z]/.test(tag) || tag.includes('.')) {
          slot(module, parent.openingElement.tagName, 'children');
          return [...links, [`<${tag}>`, ...names].join(' ')];
        }
        links.push(names.length === 0 ? `<${tag}>` : names.join(' '));
        if (input.endsChain(names)) return links;
        node = parent;
        continue;
      }
      if (ts.isJsxAttribute(parent)) {
        const owner = parent.parent.parent;
        slot(module, owner.tagName, parent.name.getText());
        return [...links, `<${owner.tagName.getText()} ${parent.name.getText()}>`];
      }
      if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
        if (isTransparentFunction(parent)) {
          node = parent;
          continue;
        }
        return [...links, release(module, parent)];
      }
      if (ts.isCallExpression(parent)) {
        if (parent.expression === node || isTransparentFunction(node)) {
          node = parent;
          continue;
        }
        return [...links, UNREAD];
      }
      if (ts.isReturnStatement(parent)) {
        let fn: ts.Node = parent;
        while (!ts.isFunctionLike(fn)) fn = fn.parent;
        if (isTransparentFunction(fn)) {
          node = fn;
          continue;
        }
        return [...links, release(module, fn)];
      }
      if (
        ts.isVariableDeclaration(parent) &&
        parent.initializer === node &&
        ts.isIdentifier(parent.name)
      ) {
        const name = parent.name.text;
        const isConst = (parent.parent.flags & ts.NodeFlags.Const) !== 0;
        if (!isConst || (module.declarations.get(name) ?? 0) > 1) return [...links, UNREAD];
        holders.add(keyOf({ file: module.path, name }));
        return [...links, `held by ${name}`];
      }
      if (
        (ts.isPropertyAssignment(parent) && parent.initializer === node) ||
        ts.isShorthandPropertyAssignment(parent)
      ) {
        const name = parent.name.getText();
        const names = heldProperties.get(module.path) ?? new Set<string>();
        names.add(name);
        heldProperties.set(module.path, names);
        return [...links, `held by .${name}`];
      }
      return [...links, UNREAD];
    }
  };

  /** Is this reference inside the body of the declaration it names (recursion)? */
  const isInOwnBody = (module: Module, node: ts.Node, declaration: DeclarationRef) => {
    if (declaration.file !== module.path) return false;
    for (let up: ts.Node | undefined = node.parent; up !== undefined; up = up.parent) {
      if (ts.isFunctionLike(up) && nameOf(up) === declaration.name) return true;
    }
    return false;
  };

  // Only files that can reach a carrier are parsed: those declaring one, and those importing a
  // module that declares or re-exports one (read from their import lines, before parsing).
  const specifiers = new Map(
    input.files.map((path) => {
      const text = input.read(path) ?? '';
      const targets = [...text.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)]
        .map(([, specifier]) => resolveModule(path, specifier ?? ''))
        .filter((target) => target !== undefined);
      const reExports = [...text.matchAll(/\bexport\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)]
        .map(([, specifier]) => resolveModule(path, specifier ?? ''))
        .filter((target) => target !== undefined);
      return [path, { targets, reExports }] as const;
    }),
  );
  const candidates = () => {
    const reaching = new Set([...carriers.values(), ...helpers.values()].map(({ file }) => file));
    for (let grew = true; grew;) {
      grew = false;
      for (const [path, { reExports }] of specifiers) {
        if (!reaching.has(path) && reExports.some((target) => reaching.has(target))) {
          reaching.add(path);
          grew = true;
        }
      }
    }
    return input.files.filter(
      (path) =>
        reaching.has(path) ||
        slotFiles.has(path) ||
        (specifiers.get(path)?.targets ?? []).some((target) => reaching.has(target)),
    );
  };

  for (;;) {
    const before = found();
    const census: Record<string, string[]> = {};
    for (const path of candidates()) {
      const module = moduleOf(path);
      if (module === undefined) continue;
      const file = relative(input.srcDir, path);
      const record = (label: string, links: readonly string[]) =>
        (census[file] ??= []).push(`${label} in ${links.join(' < ')}`);
      const properties = heldProperties.get(path);
      const onReference = (reference: ts.Identifier | ts.PropertyAccessExpression) => {
        const declaration = resolveReference(module, reference);
        if (declaration === undefined || isInOwnBody(module, reference, declaration)) return;
        const key = keyOf(declaration);
        const parent = reference.parent;
        if (carriers.has(key)) {
          if (ts.isJsxClosingElement(parent)) return;
          if (ts.isJsxOpeningElement(parent) || ts.isJsxSelfClosingElement(parent)) {
            if (parent.tagName !== reference) return;
            const element = ts.isJsxOpeningElement(parent) ? parent.parent : parent;
            const own = classesOf(module, element, false);
            const links = trace(module, element);
            record(declaration.name, own.length === 0 ? links : [`own ${own.join(' ')}`, ...links]);
          } else {
            record(`${declaration.name} referenced`, [UNREAD]);
          }
        } else if (helpers.has(key)) {
          if (ts.isCallExpression(parent) && parent.expression === reference) {
            record(`${declaration.name}()`, trace(module, parent));
          } else {
            record(`${declaration.name} referenced`, [UNREAD]);
          }
        } else if (holders.has(key) && !isTagName(reference)) {
          record(`via ${declaration.name}`, trace(module, reference));
        }
      };
      /** In a component with slots, every read of a slot prop is a site. */
      const visitSlots = (fn: ts.FunctionLikeDeclaration) => {
        const name = nameOf(fn);
        const props = name === undefined ? undefined : slots.get(keyOf({ file: path, name }));
        const first = fn.parameters[0];
        if (name === undefined || props === undefined || first === undefined) return;
        const locals = new Map<string, string>();
        let propsName: string | undefined;
        if (ts.isIdentifier(first.name)) propsName = first.name.text;
        else if (ts.isObjectBindingPattern(first.name)) {
          for (const element of first.name.elements) {
            const prop = (element.propertyName ?? element.name).getText();
            if (props.has(prop) && ts.isIdentifier(element.name))
              locals.set(element.name.text, prop);
          }
        }
        const walk = (node: ts.Node) => {
          if (ts.isIdentifier(node) && !isDeclarationName(node) && locals.has(node.text)) {
            record(`via ${name}.${locals.get(node.text) ?? ''}`, trace(module, node));
          } else if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === propsName &&
            props.has(node.name.text)
          ) {
            record(`via ${name}.${node.name.text}`, trace(module, node));
          }
          ts.forEachChild(node, walk);
        };
        if (fn.body !== undefined) walk(fn.body);
      };
      const visit = (node: ts.Node) => {
        if (ts.isTypeNode(node) || ts.isImportDeclaration(node)) return;
        if (
          ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node)
        )
          visitSlots(node);
        if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
        if (ts.isPropertyAccessExpression(node)) {
          if (properties?.has(node.name.text))
            record(`via .${node.name.text}`, trace(module, node));
          if (ts.isIdentifier(node.expression) && resolveReference(module, node) !== undefined) {
            onReference(node);
            return;
          }
        } else if (ts.isIdentifier(node) && !isDeclarationName(node)) {
          onReference(node);
        }
        ts.forEachChild(node, visit);
      };
      visit(module.source);
    }
    if (found() === before) return census;
  }
}
