/**
 * Local ESLint rules of the UI gate (UI drift lock plan v3, §2). All three are allow lists over
 * `registry.mjs`, judged by the type checker rather than by spelling:
 *
 * - `ui/dom-allowlist` (E5): the managed DOM surface is every member the default TypeScript
 *   library declares on the document-tree, attribute, style and font interfaces (computed from
 *   the checker: everything `Node`, `Element`, `Document`, `ShadowRoot` and the HTML/SVG/MathML
 *   element types inherit, plus `STYLE_INTERFACES`), and the static members of their
 *   constructors. A member is judged on its receiver, so a method a managed interface inherits
 *   from the ES library (`FontFaceSet.add` from `Set`) is managed too. On that surface, every
 *   reference to a method and every write to a property is in `DOM_ALLOW`, in the file's
 *   `DOM_WRITERS` entry, or is an element factory whose product is in `SAFE_PRODUCTS`. A computed
 *   member that cannot be read statically on a managed object is rejected, and so is reflection
 *   (`Object.assign`, `Reflect.set`, …) with a managed argument. A DOM API that does not exist
 *   yet is unregistered, so it is rejected by default.
 * - `ui/element-allowlist` (E11): native JSX elements (and React `createElement` string tags) are
 *   registered elements; a tag held in a variable is judged by its type. Props reaching a native
 *   element by spread or `createElement` are not opaque and carry no `style`; React's raw HTML
 *   names (`dangerouslySetInnerHTML`, `__html`) appear nowhere.
 * - `ui/inline-style-keys` (E4): a value reaching a native `style` or typed `CSSProperties` has
 *   enumerable keys, and every literal value (and every SVG presentation attribute) passes the
 *   same value checker as stylesheets (`values.mjs`). Values only known at runtime are left to
 *   the screenshot layer.
 */
import path from 'node:path';

import ts from 'typescript';

import {
  DOM_ALLOW,
  DOM_WRITERS,
  ELEMENTS,
  FACTORIES,
  HTML_KEYS,
  NAMED_WRITERS,
  OPEN_KEY_HEADS,
  REACT_UNITLESS,
  REFLECTION,
  ROOT_INTERFACES,
  SAFE_PRODUCTS,
  SIZED_ELEMENTS,
  STYLE_INTERFACES,
  SVG_ATTRIBUTES,
  TAG_MAPS,
  UNMANAGED,
} from './registry.mjs';
import { domainOf, valueMessages, valueProblems } from './values.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

function typedServices(context) {
  const services = context.sourceCode.parserServices;
  if (services?.program == null) throw new Error(`${context.id} needs type information.`);
  return { services, program: services.program, checker: services.program.getTypeChecker() };
}

const managedCache = new WeakMap();

/** The managed interface names for one program (computed once per program). */
function managedInterfaces(program, checker) {
  let managed = managedCache.get(program);
  if (managed) return managed;
  managed = new Set(STYLE_INTERFACES);
  const lib = program.getSourceFiles().find((file) => /[\\/]lib\.dom\.d\.ts$/.test(file.fileName));
  // A program without the DOM library (the game engine) cannot type a DOM access at all.
  if (lib === undefined) {
    managedCache.set(program, managed);
    return managed;
  }
  const resolve = (name) =>
    checker.resolveName(name, lib, ts.SymbolFlags.Type | ts.SymbolFlags.Namespace, false);
  const contributors = (type) => {
    for (const property of checker.getPropertiesOfType(type)) {
      for (const declaration of property.declarations ?? []) {
        // Only DOM library owners: `FontFaceSet extends Set` must not manage the ES `Set`.
        if (!/[\\/]lib\.dom(\.[a-z]+)?\.d\.ts$/.test(declaration.getSourceFile().fileName))
          continue;
        const owner = declaration.parent?.name?.text;
        if (owner) managed.add(owner);
      }
    }
  };
  // A registered name the DOM library does not declare is a stale registry (a TypeScript lib
  // change), never a name to skip: the managed set would silently shrink.
  const required = (name) => {
    const symbol = resolve(name);
    if (symbol === undefined)
      throw new Error(`UI gate E5: lib.dom.d.ts declares no \`${name}\`; update the registry.`);
    return symbol;
  };
  for (const name of [...ROOT_INTERFACES, ...STYLE_INTERFACES]) {
    managed.add(name);
    const symbol = required(name);
    // A namespace (`CSS`) is no type: its members are judged by their owner's name (`describe`).
    if (symbol.flags & ts.SymbolFlags.Type) contributors(checker.getDeclaredTypeOfSymbol(symbol));
  }
  for (const map of TAG_MAPS) {
    const symbol = required(map);
    for (const property of checker.getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol))) {
      const type = checker.getTypeOfSymbol(property);
      const name = type.getSymbol()?.getName();
      if (name) managed.add(name);
      contributors(type);
    }
  }
  for (const name of UNMANAGED) managed.delete(name);
  managedCache.set(program, managed);
  return managed;
}

/** Where a library declaration lives: `{ owner, isStatic, isMethod }`, or undefined. */
function describe(declaration, program) {
  if (!declaration || !program.isSourceFileDefaultLibrary(declaration.getSourceFile()))
    return undefined;
  const parent = declaration.parent;
  const isMethod =
    ts.isMethodSignature(declaration) ||
    ts.isMethodDeclaration(declaration) ||
    ts.isFunctionDeclaration(declaration);
  if (ts.isInterfaceDeclaration(parent) || ts.isClassDeclaration(parent)) {
    return { owner: parent.name.text, isStatic: false, isMethod };
  }
  if (
    ts.isTypeLiteralNode(parent) &&
    ts.isVariableDeclaration(parent.parent) &&
    ts.isIdentifier(parent.parent.name)
  ) {
    return { owner: parent.parent.name.text, isStatic: true, isMethod };
  }
  if (ts.isModuleBlock(parent) && ts.isModuleDeclaration(parent.parent)) {
    return { owner: parent.parent.name.text, isStatic: true, isMethod };
  }
  return undefined;
}

/** Is a value of this type a managed DOM object? (Any part of a union or intersection.) */
function isManagedType(type, managed, program) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  return parts.some((part) => {
    const symbol = part.getSymbol() ?? part.aliasSymbol;
    const declaration = symbol?.declarations?.[0];
    if (
      declaration &&
      program.isSourceFileDefaultLibrary(declaration.getSourceFile()) &&
      managed.has(symbol.getName())
    ) {
      return true;
    }
    return (part.getBaseTypes?.() ?? []).some((base) => isManagedType(base, managed, program));
  });
}

const isDomLibrary = (file) => /[\\/]lib\.dom(\.[a-z]+)?\.d\.ts$/.test(file.fileName);

/** The name of the managed DOM interface a value of this type is, or undefined. */
function managedNameOf(type, managed, program) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  for (const part of parts) {
    const symbol = part.getSymbol() ?? part.aliasSymbol;
    const declaration = symbol?.declarations?.[0];
    if (
      declaration &&
      program.isSourceFileDefaultLibrary(declaration.getSourceFile()) &&
      managed.has(symbol.getName())
    ) {
      return symbol.getName();
    }
    for (const base of part.getBaseTypes?.() ?? []) {
      const name = managedNameOf(base, managed, program);
      if (name) return name;
    }
  }
  return undefined;
}

/**
 * The declaration a call resolves to. `super()` into a class chain that declares no constructor
 * has none and calls nothing but the implicit constructors of project classes (a library base
 * class always declares one), so it resolves to `null`: nothing to judge. Any other call without
 * a declaration (an `any` callee) is `undefined`, which the rules report as unresolved.
 */
function calleeDeclaration(node, services, checker) {
  const declaration = checker
    .getResolvedSignature(services.esTreeNodeToTSNodeMap.get(node))
    ?.getDeclaration();
  if (declaration !== undefined) return declaration;
  return node.callee.type === 'Super' ? null : undefined;
}

function fileKey(filename) {
  return path.relative(REPO_ROOT, filename).split(path.sep).join('/');
}

/** The string values `node` can take, or null when the checker cannot enumerate them. */
function possibleStrings(node, services) {
  if (node.type === 'Literal') return typeof node.value === 'string' ? [node.value] : null;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    return [node.quasis[0].value.cooked];
  const type = services.getTypeAtLocation(node);
  const parts = type.isUnion() ? type.types : [type];
  if (!parts.every((part) => part.isStringLiteral())) return null;
  return parts.map((part) => part.value);
}

/**
 * The name prefixes a string node's type fixes (`` `--color-${string}` `` gives `--color-`), or
 * null when some part of it is neither a literal nor a template literal type.
 */
function possiblePrefixes(node, services) {
  const type = services.getTypeAtLocation(node);
  const parts = type.isUnion() ? type.types : [type];
  if (!parts.every((part) => part.isStringLiteral() || part.flags & ts.TypeFlags.TemplateLiteral))
    return null;
  return parts.map((part) => (part.isStringLiteral() ? part.value : part.texts[0]));
}

function isWriteTarget(node) {
  const parent = node.parent;
  switch (parent.type) {
    case 'AssignmentExpression':
      return parent.left === node;
    case 'UpdateExpression':
      return true;
    case 'UnaryExpression':
      return parent.operator === 'delete';
    case 'ForInStatement':
    case 'ForOfStatement':
      return parent.left === node;
    case 'ArrayPattern':
    case 'RestElement':
      return true;
    case 'AssignmentPattern':
      return parent.left === node;
    case 'Property':
      return parent.value === node && parent.parent.type === 'ObjectPattern';
    default:
      return false;
  }
}

const domAllowlist = {
  meta: {
    type: 'problem',
    docs: { description: 'Allow only registered DOM write entry points (UI gate E5).' },
    // `writers` replaces DOM_WRITERS in rule tests only; the gate configuration passes nothing.
    schema: [
      { type: 'object', properties: { writers: { type: 'object' } }, additionalProperties: false },
    ],
    messages: {
      member:
        '`{{member}}` is not a registered DOM write entry point for this file (UI gate E5, scripts/ui-lint/registry.mjs).',
      computed: 'A computed member on a DOM object hides which entry point it uses (UI gate E5).',
      reflection: '`{{name}}` with a DOM object writes past the registry (UI gate E5).',
      product:
        '`{{factory}}` creates `{{product}}`, which is not a registered product for this file (UI gate E5).',
      name: '`{{member}}` writes a name the checker cannot enumerate (UI gate E5).',
      unresolved:
        'The checker cannot resolve what this call is, so it may write the DOM (UI gate E5).',
    },
  },
  create(context) {
    const { services, program, checker } = typedServices(context);
    const managed = managedInterfaces(program, checker);
    const writers = context.options[0]?.writers ?? DOM_WRITERS;
    const own = new Set(writers[fileKey(context.filename)] ?? []);
    const allowed = (owner, member) =>
      DOM_ALLOW.has(member) ||
      DOM_ALLOW.has(`${owner}.${member}`) ||
      own.has(member) ||
      own.has(`${owner}.${member}`);

    const productOf = (node) => {
      const type = services.getTypeAtLocation(node);
      return checker.typeToString(type);
    };

    const checkNamedWriter = (node, member) => {
      const call =
        node.parent.type === 'CallExpression' && node.parent.callee === node
          ? node.parent
          : undefined;
      if (!call || call.arguments.length === 0)
        return context.report({ node, messageId: 'member', data: { member } });
      const nameArgument = member === 'setAttributeNS' ? call.arguments[1] : call.arguments[0];
      // An entry `member:name` registers one name, `member:prefix*` every name with the prefix.
      const families = [...own]
        .filter((entry) => entry.startsWith(`${member}:`) && entry.endsWith('*'))
        .map((entry) => entry.slice(member.length + 1, -1));
      const names = nameArgument && possibleStrings(nameArgument, services);
      if (names) {
        for (const name of names) {
          if (!own.has(`${member}:${name}`) && !families.some((family) => name.startsWith(family)))
            context.report({ node, messageId: 'member', data: { member: `${member}:${name}` } });
        }
        return;
      }
      const prefixes = nameArgument && possiblePrefixes(nameArgument, services);
      if (
        !prefixes ||
        !prefixes.every((head) => families.some((family) => head.startsWith(family)))
      )
        context.report({ node, messageId: 'name', data: { member } });
    };

    /** A reference to a library member `symbol` at `node` (member expression or pattern key). */
    const checkMember = (node, symbol, isCall, receiver) => {
      const declared = describe(symbol?.declarations?.[0], program);
      if (!declared) return;
      // A member a managed interface inherits from the ES library is judged on its receiver:
      // `FontFaceSet.add` is managed though `Set` declares it. DOM-declared owners stay as they
      // are (`Window.setTimeout` is not a document-tree write).
      const fromEs = !isDomLibrary(symbol.declarations[0].getSourceFile());
      const owner = managed.has(declared.owner)
        ? declared.owner
        : fromEs && receiver && managedNameOf(receiver, managed, program);
      if (!owner) return;
      const info = { ...declared, owner };
      const member = symbol.getName();
      const write = node.type === 'MemberExpression' && isWriteTarget(node);
      if (!info.isMethod && !info.isStatic && !write) return;
      if (
        info.isMethod &&
        !info.isStatic &&
        NAMED_WRITERS.has(member) &&
        !allowed(info.owner, member)
      ) {
        return checkNamedWriter(node, member);
      }
      if (info.isMethod && FACTORIES.has(member) && isCall && !allowed(info.owner, member)) {
        const product = productOf(node.parent);
        if (SAFE_PRODUCTS.has(product)) return;
        const tag = node.parent.arguments[member === 'createElementNS' ? 1 : 0];
        const tags = tag && possibleStrings(tag, services);
        if (tags && tags.every((name) => own.has(`${member}:${name}`))) return;
        return context.report({ node, messageId: 'product', data: { factory: member, product } });
      }
      if (!allowed(info.owner, member))
        context.report({ node, messageId: 'member', data: { member: `${info.owner}.${member}` } });
    };

    return {
      MemberExpression(node) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        const isCall = node.parent.type === 'CallExpression' && node.parent.callee === node;
        const nameNode = ts.isPropertyAccessExpression(tsNode)
          ? tsNode.name
          : tsNode.argumentExpression;
        const symbol = checker.getSymbolAtLocation(nameNode);
        const receiver = services.getTypeAtLocation(node.object);
        if (symbol && describe(symbol.declarations?.[0], program))
          return checkMember(node, symbol, isCall, receiver);
        if (!node.computed) return;
        if (!isManagedType(services.getTypeAtLocation(node.object), managed, program)) return;
        const names = possibleStrings(node.property, services);
        if (names === null) {
          if (isCall || isWriteTarget(node)) context.report({ node, messageId: 'computed' });
          return;
        }
        const objectType = services.getTypeAtLocation(node.object);
        for (const name of names) {
          const property = checker.getPropertyOfType(checker.getApparentType(objectType), name);
          if (property) checkMember(node, property, isCall, objectType);
        }
      },
      // const { insertAdjacentHTML } = el
      'ObjectPattern > Property'(node) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        const sourceType = checker.getTypeAtLocation(tsNode.parent);
        const source = checker.getApparentType(sourceType);
        let names;
        if (node.computed) {
          // const { [key]: f } = el — judged like a computed member access.
          names = possibleStrings(node.key, services);
          if (names === null) {
            if (isManagedType(sourceType, managed, program))
              context.report({ node, messageId: 'computed' });
            return;
          }
        } else {
          // `propertyName` is set when renamed (`{ a: b }`, `{ 'a': b }`), else the binding name.
          const nameNode = tsNode.propertyName ?? tsNode.name;
          if (!(
            ts.isIdentifier(nameNode) ||
            ts.isStringLiteral(nameNode) ||
            ts.isNumericLiteral(nameNode)
          ))
            throw new Error(
              `UI gate E5: unexpected destructuring key kind ${ts.SyntaxKind[nameNode.kind]}`,
            );
          names = [nameNode.text];
        }
        for (const name of names) {
          // A name the type lacks does not type-check; only declared members can be reached.
          const symbol = checker.getPropertyOfType(source, name);
          if (symbol) checkMember(node, symbol, false, sourceType);
        }
      },
      NewExpression(node) {
        const symbol = checker.getSymbolAtLocation(services.esTreeNodeToTSNodeMap.get(node.callee));
        const declaration = symbol?.declarations?.[0];
        if (!declaration || !program.isSourceFileDefaultLibrary(declaration.getSourceFile()))
          return;
        const product = productOf(node);
        const type = services.getTypeAtLocation(node);
        if (!isManagedType(type, managed, program) || SAFE_PRODUCTS.has(product)) return;
        if (own.has(`new ${symbol.getName()}`)) return;
        context.report({
          node,
          messageId: 'product',
          data: { factory: `new ${symbol.getName()}`, product },
        });
      },
      CallExpression(node) {
        const declaration = calleeDeclaration(node, services, checker);
        if (declaration === null) return;
        if (declaration === undefined) return context.report({ node, messageId: 'unresolved' });
        const info = describe(declaration, program);
        // Not a library member (the project's own function): not a DOM write entry point.
        if (info === undefined) return;
        const name =
          declaration.name && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
        if (!REFLECTION[info.owner]?.has(name)) return;
        if (
          node.arguments.some((argument) =>
            isManagedType(services.getTypeAtLocation(argument), managed, program),
          )
        ) {
          context.report({
            node,
            messageId: 'reflection',
            data: { name: `${info.owner === 'Reflect' ? 'Reflect' : 'Object'}.${name}` },
          });
        }
      },
    };
  },
};

/**
 * The string tags a value denotes: undefined for a component (no string part), null when a
 * string part cannot be enumerated.
 */
function tagNames(node, services) {
  if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
  const type = services.getTypeAtLocation(node);
  const parts = type.isUnion() ? type.types : [type];
  const strings = parts.filter(
    (part) => part.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.Any | ts.TypeFlags.Unknown),
  );
  if (strings.length === 0) return undefined;
  if (!strings.every((part) => part.isStringLiteral())) return null;
  return strings.map((part) => part.value);
}

function isOpenKey(keyType) {
  return (
    Boolean(keyType.flags & ts.TypeFlags.TemplateLiteral) &&
    keyType.texts.length === 2 &&
    OPEN_KEY_HEADS.has(keyType.texts[0]) &&
    keyType.texts[1] === '' &&
    Boolean(keyType.types[0].flags & ts.TypeFlags.String)
  );
}

/** Does a value of this type hide which keys it carries (any, unknown, an open index)? */
function isOpaque(type, checker) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  return parts.some(
    (part) =>
      Boolean(part.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) ||
      (Boolean(part.flags & ts.TypeFlags.Object) &&
        checker.getIndexInfosOfType(part).some((info) => !isOpenKey(info.keyType))),
  );
}

/** The key names of an object property, or null when its computed key cannot be enumerated. */
function keyNames(property, services) {
  if (!property.computed) {
    if (property.key.type === 'Identifier') return [property.key.name];
    if (property.key.type === 'Literal') return [String(property.key.value)];
    throw new Error(`UI gate E11: unexpected object key type ${property.key.type}`);
  }
  return possibleStrings(property.key, services);
}

const elementAllowlist = {
  meta: {
    type: 'problem',
    docs: { description: 'Allow only registered native elements and their props (UI gate E11).' },
    schema: [],
    messages: {
      element:
        '`<{{tag}}>` is not a registered native element (UI gate E11, scripts/ui-lint/registry.mjs).',
      dynamic: 'This element tag cannot be enumerated (UI gate E11).',
      html: '`{{name}}` writes raw HTML past the gate (UI gate E11).',
      opaque:
        'These props hide which keys they carry (any, unknown or an index signature) (UI gate E11).',
      style:
        'A `style` in spread or createElement props bypasses the inline style check; pass `style={…}` (UI gate E4).',
      unresolved:
        'The checker cannot resolve what this call is, so it may create an element (UI gate E11).',
    },
  },
  create(context) {
    const { services, checker } = typedServices(context);
    const check = (node, tags) => {
      if (tags === undefined) return;
      if (tags === null) return context.report({ node, messageId: 'dynamic' });
      for (const tag of tags)
        if (!ELEMENTS.has(tag)) context.report({ node, messageId: 'element', data: { tag } });
    };
    /** Props reaching a native element without being written as attributes. */
    const checkProps = (node) => {
      const type = services.getTypeAtLocation(node);
      if (isOpaque(type, checker)) return context.report({ node, messageId: 'opaque' });
      const style = checker.getPropertyOfType(checker.getApparentType(type), 'style');
      if (style && !(style.flags & ts.SymbolFlags.Optional))
        context.report({ node, messageId: 'style' });
    };
    const isNative = (name) => name.type === 'JSXIdentifier' && /^[a-z]/.test(name.name);
    return {
      JSXOpeningElement(node) {
        const { name } = node;
        for (const attribute of node.attributes) {
          if (attribute.type === 'JSXSpreadAttribute') {
            if (isNative(name)) checkProps(attribute.argument);
          } else if (
            attribute.name.type === 'JSXIdentifier' &&
            HTML_KEYS.has(attribute.name.name)
          ) {
            context.report({
              node: attribute,
              messageId: 'html',
              data: { name: attribute.name.name },
            });
          }
        }
        // A lower-case JSX name is an intrinsic element by JSX semantics; others are judged by type.
        if (isNative(name)) return check(node, [name.name]);
        if (name.type === 'JSXNamespacedName')
          return check(node, [`${name.namespace.name}:${name.name.name}`]);
        return check(node, tagNames(name, services));
      },
      // { dangerouslySetInnerHTML: … }, { __html: … }, however the object reaches React.
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') return;
        const names = keyNames(node, services);
        // A key the checker cannot enumerate gives the object an index signature, and props with
        // one are rejected as `opaque` wherever they reach a native element (spread or
        // createElement), so it cannot carry raw HTML past the gate; reporting it here would
        // also flag every ordinary `{ [id]: value }` map (P1 QA7 N1).
        if (names === null) return;
        for (const name of names) {
          if (HTML_KEYS.has(name))
            context.report({ node: node.key, messageId: 'html', data: { name } });
        }
      },
      CallExpression(node) {
        const declaration = calleeDeclaration(node, services, checker);
        if (declaration === null) return;
        if (declaration === undefined) return context.report({ node, messageId: 'unresolved' });
        const file = declaration.getSourceFile().fileName;
        const name =
          declaration.name && ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
        if (
          !/[\\/]@types[\\/]react[\\/]/.test(file) ||
          (name !== 'createElement' && name !== 'cloneElement')
        )
          return;
        const [tag, props] = node.arguments;
        if (name === 'createElement' && tag) {
          const tags = tagNames(tag, services);
          check(node, tags);
          if (tags !== undefined && props) checkProps(props);
        }
        if (name === 'cloneElement' && props) checkProps(props);
      },
    };
  },
};

function isCssProperties(type) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  return parts.some((part) =>
    [part.aliasSymbol?.getName(), part.getSymbol()?.getName()].includes('CSSProperties'),
  );
}

/** `borderRadius` → `border-radius`, `WebkitLineClamp` → `-webkit-line-clamp`, `--x` → `--x`. */
function cssName(key) {
  if (key.startsWith('--')) return key;
  const kebab = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return /^ms-/.test(kebab) ? `-${kebab}` : kebab;
}

const MAX_LITERAL_VALUES = 64;

/** The literal values a type stands for, as CSS text, or null when it is not all literals. */
function typeLiteralValues(type, unit) {
  const parts = type.isUnion() ? type.types : [type];
  if (!parts.every((part) => part.isStringLiteral() || part.isNumberLiteral())) return null;
  return parts.map((part) => (part.isStringLiteral() ? part.value : unit(part.value)));
}

const REACT_STATE_HOOKS = new Set(['useState']);

/**
 * The one reading of the literal values a style expression can take (a TypeScript node, in this
 * file or another), as CSS text (`unit` turns a number into text), or null when they cannot be
 * enumerated: a value computed at runtime, judged by the screenshots.
 *
 * A name is followed to the expression that gives it its value, because TypeScript widens a
 * written literal to `number`/`string` wherever it is not `const` (P1 QA7 F4): a default
 * parameter (`size = 8`), a `let`, an object property without `as const`, a destructuring default
 * and the initial value of `useState(16)` are all read from their initializers.
 */
function literalValues(node, checker, unit, visiting = new Set()) {
  // A name whose initializer refers back to it has no literal reading.
  if (visiting.has(node)) return null;
  visiting.add(node);
  try {
    return readLiteralValues(node, checker, unit, visiting);
  } finally {
    visiting.delete(node);
  }
}

function readLiteralValues(node, checker, unit, visiting) {
  const recurse = (next, nextUnit = unit) => literalValues(next, checker, nextUnit, visiting);
  const either = (a, b) => (a && b ? [...a, ...b] : (a ?? b));
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isNumericLiteral(node)) return [unit(Number(node.text))];
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return [unit(-Number(node.operand.text))];
  if (ts.isTemplateExpression(node)) {
    // Every substitution with literal values: the template is the product of its parts.
    let texts = [node.head.text];
    for (const span of node.templateSpans) {
      const parts = recurse(span.expression, String);
      if (parts === null) return null;
      texts = texts.flatMap((head) => parts.map((part) => `${head}${part}${span.literal.text}`));
      if (texts.length > MAX_LITERAL_VALUES) return null;
    }
    return texts;
  }
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  )
    return recurse(node.expression);
  if (ts.isConditionalExpression(node))
    return either(recurse(node.whenTrue), recurse(node.whenFalse));
  if (
    ts.isBinaryExpression(node) &&
    [
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.AmpersandAmpersandToken,
    ].includes(node.operatorToken.kind)
  )
    return either(recurse(node.left), recurse(node.right));
  const typed = typeLiteralValues(checker.getTypeAtLocation(node), unit);
  if (typed !== null) return typed;
  if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return null;
  const named = checker.getSymbolAtLocation(ts.isIdentifier(node) ? node : node.name);
  // An imported name is followed to the declaration it imports.
  const symbol =
    named !== undefined && named.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(named)
      : named;
  const declaration = symbol?.valueDeclaration;
  if (declaration === undefined) return null;
  if (ts.isShorthandPropertyAssignment(declaration)) {
    const target = checker.getShorthandAssignmentValueSymbol(declaration)?.valueDeclaration;
    return target && ts.isVariableDeclaration(target) && target.initializer
      ? recurse(target.initializer)
      : null;
  }
  if (
    (ts.isVariableDeclaration(declaration) ||
      ts.isParameter(declaration) ||
      ts.isPropertyAssignment(declaration) ||
      ts.isBindingElement(declaration)) &&
    declaration.initializer
  )
    return recurse(declaration.initializer);
  // `const [size] = useState(16)`: the first element of a state hook is its initial value.
  if (
    ts.isBindingElement(declaration) &&
    ts.isArrayBindingPattern(declaration.parent) &&
    declaration.parent.elements.indexOf(declaration) === 0 &&
    ts.isVariableDeclaration(declaration.parent.parent) &&
    declaration.parent.parent.initializer &&
    ts.isCallExpression(declaration.parent.parent.initializer)
  ) {
    const call = declaration.parent.parent.initializer;
    const callee = ts.isPropertyAccessExpression(call.expression)
      ? call.expression.name
      : call.expression;
    if (ts.isIdentifier(callee) && REACT_STATE_HOOKS.has(callee.text) && call.arguments[0])
      return recurse(call.arguments[0]);
  }
  return null;
}

const inlineStyleKeys = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Inline styles and SVG presentation attributes: enumerable keys, values in the token domains (UI gate E4).',
    },
    schema: [],
    messages: {
      computed: 'This style key hides which property is written (UI gate E4).',
      indexed:
        'This style value has an index signature, so the properties it writes are not enumerable (UI gate E4).',
      value: '{{message}}',
    },
  },
  create(context) {
    const { services, checker } = typedServices(context);
    const checked = new Set();
    // `values` null: a runtime value, left to the screenshot layer. `where` names the declaration
    // when the value is written in another file, so the report leads to it (P1 QA7 S1).
    const judge = (node, prop, values, where) => {
      const at = (message) => (where === undefined ? message : `${message} Declared at ${where}.`);
      const domain = domainOf(prop);
      if (domain === undefined)
        return context.report({
          node,
          messageId: 'value',
          data: { message: at(valueMessages.property(prop)) },
        });
      if (values === null) return;
      for (const value of values)
        for (const { message } of valueProblems(value, prop, domain))
          context.report({ node, messageId: 'value', data: { message: at(message) } });
    };
    const unitFor = (key) => (number) =>
      number === 0 || key.startsWith('--') || REACT_UNITLESS.has(key)
        ? String(number)
        : `${number}px`;
    const isCssPropertiesLiteral = (tsObject) => {
      const contextual = checker.getContextualType(tsObject);
      return contextual !== undefined && isCssProperties(contextual);
    };
    const file = services.program.getSourceFile(context.filename);
    const seen = new Set();
    // A style value that is not an object literal here (a variable, a member, a memo, a branch)
    // is judged through its type: each property declared by an object literal is checked where
    // it is written, in this file through `checkObject`, in another file at this use.
    const checkDeclarations = (use, type) => {
      const tsUse = services.esTreeNodeToTSNodeMap.get(use);
      for (const part of type.isUnion() ? type.types : [type]) {
        for (const symbol of checker.getPropertiesOfType(part)) {
          const key = symbol.getName();
          const declarations = symbol.declarations ?? [];
          // A property declared by a library type (React's `CSSProperties`) says which properties
          // may be written, not which are: the object literal is checked where it is written (the
          // contextual `CSSProperties` visitor), any other source is a runtime value.
          if (
            declarations.length > 0 &&
            declarations.every((d) => d.getSourceFile().isDeclarationFile)
          )
            continue;
          const literals = declarations.filter(
            (d) => ts.isPropertyAssignment(d) || ts.isShorthandPropertyAssignment(d),
          );
          if (literals.length === 0) {
            // A mapped or declared property (`Record<'padding', number>`, an interface member, an
            // accessor): its name is judged, its values are those its type fixes.
            judge(
              use,
              cssName(key),
              typeLiteralValues(checker.getTypeOfSymbolAtLocation(symbol, tsUse), unitFor(key)),
            );
            continue;
          }
          for (const declaration of literals) {
            if (seen.has(declaration)) continue;
            seen.add(declaration);
            if (declaration.getSourceFile() === file) {
              const object = services.tsNodeToESTreeNodeMap.get(declaration.parent);
              if (object?.type !== 'ObjectExpression')
                throw new Error(
                  `UI gate E4: no ESTree object literal for the style property \`${key}\` in ${context.filename}`,
                );
              checkObject(object);
              continue;
            }
            // A typed style literal (`satisfies CSSProperties`) is checked in its own file by the
            // contextual visitor; judging it again here would record the same debt twice.
            if (isCssPropertiesLiteral(declaration.parent)) continue;
            // Another file: `{ padding: 12 }` and `{ padding }` (const padding = 12) alike.
            const values = ts.isPropertyAssignment(declaration)
              ? literalValues(declaration.initializer, checker, unitFor(key))
              : literalValues(declaration.name, checker, unitFor(key));
            const { line } = declaration
              .getSourceFile()
              .getLineAndCharacterOfPosition(declaration.getStart());
            judge(
              use,
              cssName(key),
              values,
              `${fileKey(declaration.getSourceFile().fileName)}:${line + 1}`,
            );
          }
        }
      }
    };
    const checkObject = (object) => {
      if (checked.has(object)) return;
      checked.add(object);
      for (const property of object.properties) {
        if (property.type === 'SpreadElement') {
          checkValue(property.argument);
          continue;
        }
        const names = keyNames(property, services);
        if (names === null) {
          context.report({ node: property.key, messageId: 'computed' });
          continue;
        }
        for (const key of names)
          judge(
            property.value,
            cssName(key),
            literalValues(
              services.esTreeNodeToTSNodeMap.get(property.value),
              checker,
              unitFor(key),
            ),
          );
      }
    };
    const checkValue = (node) => {
      switch (node.type) {
        case 'ObjectExpression':
          return checkObject(node);
        case 'ConditionalExpression':
          checkValue(node.consequent);
          return checkValue(node.alternate);
        case 'LogicalExpression':
          checkValue(node.left);
          return checkValue(node.right);
        case 'TSSatisfiesExpression':
        case 'TSAsExpression':
        case 'TSNonNullExpression':
          return checkValue(node.expression);
        default: {
          const type = services.getTypeAtLocation(node);
          if (isOpaque(type, checker)) return context.report({ node, messageId: 'indexed' });
          checkDeclarations(node, type);
        }
      }
    };
    return {
      ObjectExpression(node) {
        if (isCssPropertiesLiteral(services.esTreeNodeToTSNodeMap.get(node))) checkObject(node);
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        if (!(node.parent.name.type === 'JSXIdentifier' && /^[a-z]/.test(node.parent.name.name)))
          return;
        const value = node.value;
        if (node.name.name === 'style') {
          if (
            value?.type !== 'JSXExpressionContainer' ||
            value.expression.type === 'JSXEmptyExpression'
          )
            return;
          return checkValue(value.expression);
        }
        // SVG presentation attributes (a number is in user units, so it stays a bare number), and
        // the width and height of the elements whose box they size.
        const prop =
          SVG_ATTRIBUTES.get(node.name.name) ??
          (SIZED_ELEMENTS.has(node.parent.name.name) && /^(?:width|height)$/.test(node.name.name)
            ? node.name.name
            : undefined);
        if (prop === undefined || value === null) return;
        if (value.type === 'Literal') return judge(value, prop, [String(value.value)]);
        if (
          value.type === 'JSXExpressionContainer' &&
          value.expression.type !== 'JSXEmptyExpression'
        )
          judge(
            value,
            prop,
            literalValues(services.esTreeNodeToTSNodeMap.get(value.expression), checker, String),
          );
      },
    };
  },
};

export default {
  meta: { name: 'ui-gate' },
  rules: {
    'dom-allowlist': domAllowlist,
    'element-allowlist': elementAllowlist,
    'inline-style-keys': inlineStyleKeys,
  },
};
