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
 *   enumerable keys, and every value (and every SVG presentation attribute) passes the same value
 *   checker as stylesheets (`values.mjs`). A value only known at runtime passes only where its
 *   kind fits whatever it holds; otherwise it is reported as `untracked` (plan D15 ②).
 */
import path from 'node:path';

import ts from 'typescript';

import {
  DOM_ALLOW,
  DOM_WRITERS,
  ELEMENTS,
  FACTORIES,
  FILE_ELEMENTS,
  HTML_KEYS,
  NAMED_WRITERS,
  OPEN_KEY_HEADS,
  REACT_UNITLESS,
  REFLECTION,
  ROOT_INTERFACES,
  SAFE_PRODUCTS,
  SIZE_ATTRIBUTES,
  SIZED_ELEMENTS,
  STATE_HOOKS,
  IDENTITY_CALLS,
  ANIMATION_OPTIONS,
  KEYFRAME_META,
  MEMO_HOOKS,
  STYLE_DECLARATIONS,
  TOKEN_PUBLISHER,
  STYLE_INTERFACES,
  SVG_ATTRIBUTES,
  TAG_MAPS,
  UNMANAGED,
} from './registry.mjs';
import { verdict, withOrigins } from './values.mjs';

function typedServices(context) {
  const services = context.sourceCode.parserServices;
  if (services?.program == null) throw new Error(`${context.id} needs type information.`);
  const checker = services.program.getTypeChecker();
  programs.set(checker, services.program);
  return { services, program: services.program, checker };
}

/** The program of each checker, for reads that cover every file (member writes). */
const programs = new WeakMap();

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

/** A path relative to the linted repository (ESLint's `cwd`: the gate runs it at the root). */
function fileKey(context, filename) {
  return path.relative(context.cwd, filename).split(path.sep).join('/');
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
    const own = new Set(writers[fileKey(context, context.filename)] ?? []);
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
    const own = new Set(FILE_ELEMENTS[fileKey(context, context.filename)] ?? []);
    const check = (node, tags) => {
      if (tags === undefined) return;
      if (tags === null) return context.report({ node, messageId: 'dynamic' });
      for (const tag of tags)
        if (!ELEMENTS.has(tag) && !own.has(tag))
          context.report({ node, messageId: 'element', data: { tag } });
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

/**
 * The readings a type stands for, used only where no written expression can be found (a declared
 * type such as `{ borderRadius: 7 }`, a parameter, a library call). Each literal part is a
 * literal reading with `origins`; a part without a literal (`number`, `string`, `any`) is one
 * runtime reading at `at`, the expression that holds it (plan v3.9 D15 ②: a value the gate cannot
 * show to be a token is reported, never left out). `null`, `undefined` and booleans write no
 * declaration (React drops them; the CSSOM clears the property) and stand for nothing.
 */
function typeReadings(type, unit, origins, at) {
  const readings = [];
  let runtime;
  for (const part of type.isUnion() ? type.types : [type]) {
    if (part.flags & (ts.TypeFlags.Nullable | ts.TypeFlags.Void | ts.TypeFlags.BooleanLike)) {
      // Shown to write nothing: `verdict` passes it as such.
      if (!readings.some((reading) => reading.none)) readings.push({ none: true, origins: [] });
      continue;
    }
    if (part.isStringLiteral() || part.isNumberLiteral()) {
      readings.push({
        text: part.isStringLiteral() ? part.value : unit(part.value),
        origins,
        untraced: origins.length === 0,
      });
      continue;
    }
    // A number is unitless or px exactly as a written number would be; anything else is text.
    const kind = part.flags & ts.TypeFlags.NumberLike ? 'number' : 'string';
    runtime = runtime === 'string' ? 'string' : kind;
  }
  if (runtime !== undefined)
    readings.push({
      runtime,
      text: runtime === 'number' ? unit(1) : undefined,
      origins: [at],
    });
  return readings;
}

/** A number of milliseconds as CSS (`animate` timing). */
const ms = (number) => (number === 0 ? '0' : `${number}ms`);

/** The texts of readings that are all literal, else null (a key or name read for lookup). */
const literalTexts = (readings) =>
  readings.every((reading) => reading.runtime === undefined)
    ? readings.filter((reading) => !reading.none).map((reading) => reading.text)
    : null;

/**
 * A value the gate cannot follow to what is written (a parameter's callers, a branch with no
 * literal behind it, a spread or entry it cannot read). It stands beside whatever is read, never
 * in place of it, and is read from the type of the expression that holds it (P1 QA13 F2).
 */
const UNREAD = Symbol('unread');

const readable = (containers) => containers.some((container) => container !== UNREAD);

const strip = (node) =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isTypeAssertionExpression(node)
    ? strip(node.expression)
    : node;

const writesCache = new WeakMap();

/**
 * The writes in one source file, keyed by symbol: `assigned` holds the values of `x = v`,
 * `called` the first argument of each call `f(v)` (read only for a state hook's setter).
 */
function writesIn(sourceFile, checker) {
  let writes = writesCache.get(sourceFile);
  if (writes !== undefined) return writes;
  writes = { assigned: new Map(), called: new Map() };
  const push = (map, target, value) => {
    const symbol = checker.getSymbolAtLocation(target);
    if (symbol !== undefined) map.set(symbol, [...(map.get(symbol) ?? []), value]);
  };
  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    )
      push(writes.assigned, node.left, node.right);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments[0])
      push(writes.called, node.expression, node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  writesCache.set(sourceFile, writes);
  return writes;
}

const memberWritesCache = new WeakMap();

/**
 * Every `obj.key = value` and `obj['key'] = value` in the program, by the member's declaration
 * (an access resolves to a widened copy of the declared symbol, so symbols do not match): a
 * table entry written after its literal (`S.box.padding = 23`, P1 QA10 S1), in any file.
 */
function memberWrites(checker) {
  const program = programs.get(checker);
  let writes = memberWritesCache.get(program);
  if (writes !== undefined) return writes;
  writes = new Map();
  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
    ) {
      const symbol = checker.getSymbolAtLocation(
        ts.isPropertyAccessExpression(node.left) ? node.left.name : node.left.argumentExpression,
      );
      for (const declaration of symbol?.declarations ?? [])
        writes.set(declaration, [...(writes.get(declaration) ?? []), node.right]);
    }
    ts.forEachChild(node, visit);
  };
  for (const sourceFile of program.getSourceFiles())
    if (!sourceFile.isDeclarationFile && !sourceFile.fileName.includes('/node_modules/'))
      visit(sourceFile);
  memberWritesCache.set(program, writes);
  return writes;
}

/**
 * The functions a call runs whose return value is the call's value: an immediately invoked
 * function, a memo hook's factory (`useMemo(() => 19, [])`), or the declaration the callee names
 * (`pad()`, P1 QA10 S1). Empty when the callee is not a function written in the program.
 */
function calledFunctions(call, checker) {
  const callee = strip(call.expression);
  if (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) return [callee];
  const name = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
  if (ts.isIdentifier(name) && MEMO_HOOKS.has(name.text) && call.arguments[0])
    return [strip(call.arguments[0])];
  const functions = [];
  for (const declaration of targetSymbol(name, checker)?.declarations ?? []) {
    if (declaration.getSourceFile().isDeclarationFile) continue;
    if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration))
      functions.push(declaration);
    else if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      const initializer = strip(declaration.initializer);
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        functions.push(initializer);
    }
  }
  return functions;
}

/** The expressions a function returns (`() => 16`, `() => { return 16; }`), or null. */
function returnedExpressions(fn) {
  if (
    !ts.isArrowFunction(fn) &&
    !ts.isFunctionExpression(fn) &&
    !ts.isFunctionDeclaration(fn) &&
    !ts.isMethodDeclaration(fn)
  )
    return null;
  if (fn.body === undefined) return null;
  if (!ts.isBlock(fn.body)) return [fn.body];
  const found = [];
  const visit = (node) => {
    if (ts.isReturnStatement(node) && node.expression) found.push(node.expression);
    else if (!ts.isFunctionLike(node)) ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return found;
}

/**
 * The one reading of written style values (UI gate E4; plan v3 §2 E4, D15 ②): every value a
 * style expression can take, in this file or another, as `{ text, origins }` (`text` is CSS,
 * `unit` turns a number into it; `origins` are the nodes it was written in). Never empty for an
 * expression that writes a declaration: what cannot be read as a literal is a runtime reading
 * `{ runtime: 'number' | 'string', origins: [expression] }`, which the rule reports unless the
 * verdict shows it fits, so no value is left out.
 *
 * A name is followed to everything that gives it a value, because TypeScript widens a written
 * literal to `number`/`string` wherever it is not `const` (P1 QA7 F4): initializers (a `const`,
 * a `let`, a default parameter or destructuring default, an object property), later assignments,
 * a state hook's initial value and setter calls (QA8 should-fix 3). A parameter also takes what
 * its callers pass, so its type is read beside its default. A member or element access is read
 * from the object or array literal behind its receiver, annotated (`Record<…>`) or not; an
 * element key that is not literal reads every entry (QA8 FIX-FIRST-3). Where nothing written is
 * found, the type is read (`typeReadings`).
 */
function literalValues(node, checker, unit, visiting = new Set()) {
  // An expression whose value refers back to itself is computed: its type is what it holds.
  if (visiting.has(node))
    return typeReadings(checker.getTypeAtLocation(node), unit, [], strip(node));
  visiting.add(node);
  try {
    return readLiteralValues(node, checker, unit, visiting);
  } finally {
    visiting.delete(node);
  }
}

function readLiteralValues(node, checker, unit, visiting) {
  const recurse = (next, nextUnit = unit) => literalValues(next, checker, nextUnit, visiting);
  node = strip(node);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return [{ text: node.text, origins: [node] }];
  if (ts.isNumericLiteral(node)) return [{ text: unit(Number(node.text)), origins: [node] }];
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return [{ text: unit(-Number(node.operand.text)), origins: [node] }];
  if (ts.isTemplateExpression(node)) {
    // The template is the product of its parts: each combination of literal parts is a literal
    // text; a combination with a runtime part is runtime text, written at the template (one
    // reading however many combinations), so a literal branch beside a runtime one is still read.
    let values = [{ text: node.head.text, origins: [] }];
    let runtime = false;
    for (const span of node.templateSpans) {
      const parts = recurse(span.expression, String);
      // A part that writes nothing is interpolated as text (`undefined`, `false`): not a token.
      const literal = parts.filter((part) => part.runtime === undefined && !part.none);
      if (literal.length < parts.length) runtime = true;
      values = values.flatMap((head) =>
        literal.map((part) => ({
          text: `${head.text}${part.text}${span.literal.text}`,
          origins: [...head.origins, ...part.origins],
          untraced: Boolean(head.untraced || part.untraced),
        })),
      );
    }
    return runtime ? [...values, { runtime: 'string', origins: [node] }] : values;
  }
  if (ts.isConditionalExpression(node))
    return [...recurse(node.whenTrue), ...recurse(node.whenFalse)];
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    // `a && b` is `b` whenever it is a style value: a falsy `a` writes no declaration.
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) return recurse(node.right);
    if (operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.QuestionQuestionToken)
      return [...recurse(node.left), ...recurse(node.right)];
  }
  if (ts.isCallExpression(node)) {
    const returned = calledFunctions(node, checker).flatMap((fn) => returnedExpressions(fn) ?? []);
    if (returned.length > 0) return returned.flatMap((expression) => recurse(expression));
  }
  if (
    ts.isIdentifier(node) ||
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    const sources = valueSources(node, checker, visiting);
    if (sources !== null) {
      // One type reading however many sources are unread: they all hold what the type allows.
      const written = sources.filter((source) => source !== UNREAD).flatMap((s) => recurse(s));
      return sources.includes(UNREAD) ? [...written, ...readType(node)] : written;
    }
  }
  return readType(node);

  function readType(at) {
    return typeReadings(checker.getTypeAtLocation(at), unit, typeOrigins(at, checker), at);
  }
}

/** Array methods whose callback's first parameter is each element of the receiver. */
const ELEMENT_CALLBACKS = new Set([
  'every',
  'filter',
  'find',
  'findLast',
  'flatMap',
  'forEach',
  'map',
  'some',
]);

/**
 * The receiver whose elements a parameter takes: the array of `X.map((element) => …)` when the
 * parameter is the callback's first one, else undefined (its callers write it).
 */
function elementsReceiver(parameter) {
  const fn = parameter.parent;
  if (fn.parameters?.[0] !== parameter) return undefined;
  if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return undefined;
  let call = fn.parent;
  while (ts.isParenthesizedExpression(call)) call = call.parent;
  if (!ts.isCallExpression(call) || strip(call.arguments[0] ?? call) !== fn) return undefined;
  const callee = call.expression;
  return ts.isPropertyAccessExpression(callee) && ELEMENT_CALLBACKS.has(callee.name.text)
    ? callee.expression
    : undefined;
}

/**
 * Where a literal type read from a name is written: the type annotation of each declaration of
 * the symbol it refers to (`p: 4 | 8`, a destructured prop's member in its props type), else
 * the declaration itself (an enum member, a `const` whose initializer is a call). Empty when the
 * name has no declaration in the program; the rule then reports `untraced` (P1 QA9 FIX-FIRST-2).
 */
function typeOrigins(node, checker) {
  const name = ts.isPropertyAccessExpression(node)
    ? node.name
    : ts.isIdentifier(node)
      ? node
      : ts.isElementAccessExpression(node)
        ? node.expression
        : undefined;
  if (name === undefined) return [];
  const origins = [];
  for (const declaration of targetSymbol(name, checker)?.declarations ?? []) {
    if (declaration.getSourceFile().isDeclarationFile) continue;
    if (ts.isBindingElement(declaration) && ts.isObjectBindingPattern(declaration.parent)) {
      const key = (declaration.propertyName ?? declaration.name).getText();
      const member = checker.getTypeAtLocation(declaration.parent).getProperty(key);
      const typed = (member?.declarations ?? []).filter(
        (d) => !d.getSourceFile().isDeclarationFile,
      );
      if (typed.length > 0) {
        origins.push(...typed.map((d) => d.type ?? d));
        continue;
      }
    }
    origins.push(declaration.type ?? declaration);
  }
  return origins;
}

/** The symbol a name refers to, through imports. */
function targetSymbol(name, checker) {
  const symbol = checker.getSymbolAtLocation(name);
  return symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

/**
 * The expressions that give a name, member or element its value, or null when none is written.
 * `UNREAD` among them stands for values written where the gate cannot follow.
 */
function valueSources(node, checker, visiting) {
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const keys = ts.isPropertyAccessExpression(node)
      ? [node.name.text]
      : literalTexts(literalValues(node.argumentExpression, checker, String, visiting));
    const containers = containersOf(node.expression, checker, visiting);
    if (readable(containers)) return entriesOf(containers, keys, checker, visiting);
    if (ts.isPropertyAccessExpression(node)) {
      // No literal behind the receiver: a member that is one symbol (an export read through a
      // namespace import, a class field) is read from its declaration. A member of an object
      // literal is not: any object of the same shape has it, so its literal is only one of the
      // values the access holds, and the type is read (P1 QA13 F2).
      const declarations = (targetSymbol(node.name, checker)?.declarations ?? []).filter(
        (declaration) =>
          !ts.isPropertyAssignment(declaration) && !ts.isShorthandPropertyAssignment(declaration),
      );
      const sources = declarations.flatMap(
        (declaration) => sourcesOfDeclaration(declaration, checker, visiting) ?? [],
      );
      return sources.length === 0 ? null : sources;
    }
    return null;
  }
  const symbol = targetSymbol(node, checker);
  const declaration = symbol?.valueDeclaration;
  if (declaration === undefined) return null;
  if (ts.isShorthandPropertyAssignment(declaration)) {
    const target = checker.getShorthandAssignmentValueSymbol(declaration)?.valueDeclaration;
    return target ? sourcesOfDeclaration(target, checker, visiting) : null;
  }
  return sourcesOfDeclaration(declaration, checker, visiting);
}

function sourcesOfDeclaration(declaration, checker, visiting) {
  const sources = [];
  const writes = writesIn(declaration.getSourceFile(), checker);
  const symbol = declaration.name ? checker.getSymbolAtLocation(declaration.name) : undefined;
  if (
    (ts.isVariableDeclaration(declaration) ||
      ts.isParameter(declaration) ||
      ts.isPropertyAssignment(declaration) ||
      ts.isPropertyDeclaration(declaration) ||
      ts.isBindingElement(declaration) ||
      ts.isEnumMember(declaration)) &&
    declaration.initializer
  )
    sources.push(declaration.initializer);
  // A member written after its declaration, in any file (`S.box.padding = 23`).
  if (ts.isPropertyAssignment(declaration) || ts.isPropertyDeclaration(declaration))
    sources.push(...(memberWrites(checker).get(declaration) ?? []));
  if (symbol !== undefined && !ts.isPropertyAssignment(declaration))
    sources.push(...(writes.assigned.get(symbol) ?? []));
  if (ts.isParameter(declaration)) sources.push(...argumentsOf(declaration, checker, visiting));
  if (ts.isBindingElement(declaration)) {
    const pattern = declaration.parent;
    const holder = pattern.parent;
    const key = ts.isObjectBindingPattern(pattern)
      ? (declaration.propertyName ?? declaration.name).getText()
      : declaration.dotDotDotToken
        ? null
        : String(pattern.elements.indexOf(declaration));
    const init = ts.isVariableDeclaration(holder) ? holder.initializer : undefined;
    const callee =
      init && ts.isCallExpression(init)
        ? ts.isPropertyAccessExpression(init.expression)
          ? init.expression.name
          : init.expression
        : undefined;
    if (
      ts.isArrayBindingPattern(pattern) &&
      callee &&
      ts.isIdentifier(callee) &&
      STATE_HOOKS.has(callee.text)
    ) {
      // `const [size, setSize] = useState(16)`: the initial value (or what a lazy initializer
      // returns) and every value passed to the setter.
      if (key === '0') {
        const [initial] = init.arguments;
        if (initial) sources.push(...(returnedExpressions(strip(initial)) ?? [initial]));
        const setter = pattern.elements[1];
        if (setter && ts.isBindingElement(setter)) {
          for (const value of writes.called.get(checker.getSymbolAtLocation(setter.name)) ?? [])
            sources.push(...(returnedExpressions(strip(value)) ?? [value]));
        }
      }
    } else {
      // `const { gap } = sizes`, `const [w, h] = [320, 240]`, `({ size }) => …`: the entry of
      // the object or array behind the pattern (a parameter's is what its callers pass).
      const whole = ts.isParameter(holder)
        ? argumentsOf(holder, checker, visiting)
        : init
          ? [init]
          : [UNREAD];
      const containers = whole.flatMap((value) =>
        value === UNREAD ? [UNREAD] : containersOf(value, checker, visiting),
      );
      sources.push(...entriesOf(containers, key === null ? null : [key], checker, visiting));
    }
  }
  return sources.length === 0 ? null : sources;
}

/**
 * What a parameter takes besides its default: each element of the receiver for an array
 * method's element callback (`CHIPS.map((chip) => …)`), else what its callers pass, which the
 * gate does not follow (`UNREAD`).
 */
function argumentsOf(parameter, checker, visiting) {
  const receiver = elementsReceiver(parameter);
  if (receiver === undefined) return [UNREAD];
  return entriesOf(containersOf(receiver, checker, visiting), null, checker, visiting);
}

/**
 * The object and array literals an expression can evaluate to; `UNREAD` stands for each branch
 * or source that is not one (P1 QA13 F2: an unread branch is never dropped).
 */
function containersOf(expression, checker, visiting) {
  if (expression === UNREAD) return [UNREAD];
  const node = strip(expression);
  if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) return [node];
  if (visiting.has(node)) return [UNREAD];
  visiting.add(node);
  try {
    if (ts.isConditionalExpression(node))
      return [
        ...containersOf(node.whenTrue, checker, visiting),
        ...containersOf(node.whenFalse, checker, visiting),
      ];
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken)
        return containersOf(node.right, checker, visiting);
      if (
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      )
        return [
          ...containersOf(node.left, checker, visiting),
          ...containersOf(node.right, checker, visiting),
        ];
    }
    if (ts.isCallExpression(node)) {
      // `Object.freeze({ … })` returns its argument; a function written in the program returns
      // what it returns.
      if (IDENTITY_CALLS.has(node.expression.getText()) && node.arguments.length === 1)
        return containersOf(node.arguments[0], checker, visiting);
      const returned = calledFunctions(node, checker).map((fn) => returnedExpressions(fn));
      if (returned.length === 0 || returned.some((list) => list === null || list.length === 0))
        return [UNREAD];
      return returned.flat().flatMap((value) => containersOf(value, checker, visiting));
    }
    if (
      !ts.isIdentifier(node) &&
      !ts.isPropertyAccessExpression(node) &&
      !ts.isElementAccessExpression(node)
    )
      return [UNREAD];
    const sources = valueSources(node, checker, visiting);
    return sources === null
      ? [UNREAD]
      : sources.flatMap((source) => containersOf(source, checker, visiting));
  } finally {
    visiting.delete(node);
  }
}

/**
 * The value expressions of `keys` (every entry when null) in object or array literals. An
 * unread container, and an entry the gate cannot read (a getter, a method, a computed key, a
 * spread it cannot follow), give `UNREAD` beside what is read.
 */
function entriesOf(containers, keys, checker, visiting) {
  const found = [];
  const unread = () => {
    if (!found.includes(UNREAD)) found.push(UNREAD);
  };
  for (const container of containers) {
    if (container === UNREAD) {
      unread();
      continue;
    }
    if (ts.isArrayLiteralExpression(container)) {
      for (const [index, element] of container.elements.entries()) {
        if (ts.isSpreadElement(element)) {
          const inner = containersOf(element.expression, checker, visiting);
          found.push(...entriesOf(inner, null, checker, visiting));
        } else if (keys === null || keys.includes(String(index))) found.push(element);
      }
      continue;
    }
    for (const property of container.properties) {
      if (ts.isSpreadAssignment(property)) {
        const inner = containersOf(property.expression, checker, visiting);
        found.push(...entriesOf(inner, keys, checker, visiting));
        continue;
      }
      const name =
        property.name &&
        (ts.isIdentifier(property.name) ||
          ts.isStringLiteral(property.name) ||
          ts.isNumericLiteral(property.name))
          ? property.name.text
          : undefined;
      if (name === undefined) {
        unread();
        continue;
      }
      if (keys !== null && !keys.includes(name)) continue;
      if (ts.isPropertyAssignment(property)) {
        found.push(property.initializer);
        // An entry written after the literal (`S.box.padding = 23`, P1 QA10 S1).
        found.push(...(memberWrites(checker).get(property) ?? []));
      } else if (ts.isShorthandPropertyAssignment(property)) found.push(property.name);
      else unread();
    }
  }
  return found;
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
      untraced:
        '{{message}} Its literal type is not traced to a declaration, so changing it elsewhere is not seen (UI gate E4).',
      untracked: '{{message}}',
      keyframes:
        'Keyframes passed to `animate` are checked where they are written: pass an array or object literal (UI gate E4).',
      name: 'This DOM style write names a property the checker cannot enumerate (UI gate E4).',
    },
  },
  create(context) {
    const { services, checker } = typedServices(context);
    const checked = new Set();
    // Every report names where its value (or, for a property name, its key) is written, and the
    // gate puts those source lines in the fingerprint: changing a value written on another line or
    // in another file is new debt, not an equal swap (P1 QA7 S1, QA8 FIX-FIRST-2). A runtime
    // value is written at the expression that computes it.
    const where = (nodes) =>
      nodes.map((origin) => {
        const sourceFile = origin.getSourceFile();
        const start = sourceFile.getLineAndCharacterOfPosition(origin.getStart()).line + 1;
        const end = sourceFile.getLineAndCharacterOfPosition(origin.getEnd()).line + 1;
        return `${fileKey(context, sourceFile.fileName)}:${start}${end === start ? '' : `-${end}`}`;
      });
    // Every value check ends here, and only `verdict` decides that a value passes (P1 QA13):
    // this reports what it rejects, each report naming where its value is written.
    const judge = (node, prop, values, keyOrigin, options) => {
      // The same text from the same lines is one value (a list whose entries share a constant).
      const unique = new Map(
        values.map((value) => [
          `${value.runtime ?? ''}\u0000${value.none ?? ''}\u0000${value.text}\u0000${where(value.origins ?? []).join(',')}`,
          value,
        ]),
      );
      for (const problem of verdict([...unique.values()], prop, options))
        context.report({
          node,
          // A literal type whose declaration cannot be located has no source line for the
          // fingerprint: reported under its own message ID instead of degrading silently.
          messageId: problem.messageId,
          data: {
            message: withOrigins(
              problem.message,
              where(problem.origins.length > 0 ? problem.origins : keyOrigin ? [keyOrigin] : []),
            ),
          },
        });
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
    // A style object that is not an object literal here (a variable, a member, a memo, a call, a
    // branch) is read from the object literals behind it (`containersOf`), the same reading as a
    // value: each literal in this file is checked as written (`checkObject`), one in another
    // file at this use. Where the gate cannot follow (`UNREAD`: a parameter, a library call), the
    // object's type is read: each property it names gives a type reading, except React's
    // `CSSProperties` (which names every property that may be written) and a type with no
    // properties, which give one runtime object reading that `verdict` rejects (P1 QA13: no branch passes a value by not reading it).
    const checkStyleObject = (use, tsNode) => {
      const containers = new Set(containersOf(tsNode, checker, new Set()));
      if (containers.has(UNREAD))
        checkStyleType(use, checker.getTypeAtLocation(tsNode), tsNode, containers);
      for (const container of containers) {
        if (container === UNREAD) continue;
        if (ts.isArrayLiteralExpression(container)) {
          judge(use, null, [{ runtime: 'object', origins: [container] }]);
          continue;
        }
        if (container.getSourceFile() === file) {
          const object = services.tsNodeToESTreeNodeMap.get(container);
          if (object?.type !== 'ObjectExpression')
            throw new Error(
              `UI gate E4: no ESTree object literal for a style object in ${context.filename}`,
            );
          checkObject(object);
          continue;
        }
        // A typed style literal (`satisfies CSSProperties`) is checked in its own file by the
        // contextual visitor; judging it again here would record the same debt twice.
        if (seen.has(container) || isCssPropertiesLiteral(container)) continue;
        seen.add(container);
        checkForeignObject(use, container);
      }
    };
    // An object literal in another file: each entry is judged at this use.
    const checkForeignObject = (use, container) => {
      for (const property of container.properties) {
        if (ts.isSpreadAssignment(property)) {
          checkStyleObject(use, property.expression);
          continue;
        }
        const key =
          property.name &&
          (ts.isIdentifier(property.name) ||
            ts.isStringLiteral(property.name) ||
            ts.isNumericLiteral(property.name))
            ? property.name.text
            : undefined;
        if (
          key === undefined ||
          !(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
        ) {
          context.report({ node: use, messageId: 'computed' });
          continue;
        }
        const value = ts.isPropertyAssignment(property) ? property.initializer : property.name;
        judge(
          use,
          cssName(key),
          [
            ...literalValues(value, checker, unitFor(key)),
            ...(memberWrites(checker).get(property) ?? []).flatMap((write) =>
              literalValues(write, checker, unitFor(key)),
            ),
          ],
          property,
        );
      }
    };
    // `read`: the literals already read beside the unread part; a union member that is one of
    // their types is not read again from its type.
    const checkStyleType = (use, type, at, read) => {
      for (const part of type.isUnion() ? type.types : [type]) {
        if (part.flags & (ts.TypeFlags.Nullable | ts.TypeFlags.Void | ts.TypeFlags.BooleanLike))
          continue;
        const declaration = part.getSymbol()?.valueDeclaration;
        if (declaration !== undefined && read.has(declaration)) continue;
        if (isOpaque(part, checker)) {
          context.report({ node: use, messageId: 'indexed' });
          continue;
        }
        const properties = checker.getPropertiesOfType(part);
        // An open custom property signature (`[key: \`--${string}\`]`): every value it holds is a
        // custom property's.
        const custom = checker.getIndexInfosOfType(part);
        for (const info of custom)
          judge(
            use,
            `${info.keyType.texts[0]}*`,
            typeReadings(info.type, String, [info.declaration ?? at], at),
          );
        if (custom.length > 0 && properties.length === 0) continue;
        // React's `CSSProperties` lists every property that may be written, not which are.
        if (properties.length === 0 || isCssProperties(part)) {
          judge(use, null, [{ runtime: 'object', origins: [at] }]);
          continue;
        }
        for (const symbol of properties) {
          const key = symbol.getName();
          const declarations = symbol.declarations ?? [];
          judge(
            use,
            cssName(key),
            typeReadings(
              checker.getTypeOfSymbolAtLocation(symbol, at),
              unitFor(key),
              declarations.map((d) => d.type ?? d),
              at,
            ),
            declarations[0],
          );
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
      if (node.type === 'ObjectExpression') return checkObject(node);
      const tsNode = services.esTreeNodeToTSNodeMap.get(node);
      if (isOpaque(checker.getTypeAtLocation(tsNode), checker))
        return context.report({ node, messageId: 'indexed' });
      checkStyleObject(node, tsNode);
    };
    // DOM style writes take the same value check as `style` (P1 QA11 F2): which writes a file
    // may make at all is `ui/dom-allowlist`'s; what they write is judged here.
    const isStyleDeclaration = (node) =>
      STYLE_DECLARATIONS.has(checker.typeToString(services.getTypeAtLocation(node)));
    const literal = (node) =>
      literalValues(services.esTreeNodeToTSNodeMap.get(node), checker, String);
    const memberName = (member) =>
      member.computed ? possibleStrings(member.property, services) : [member.property.name];
    const declaringInterface = (callee) => {
      const symbol = checker.getSymbolAtLocation(services.esTreeNodeToTSNodeMap.get(callee).name);
      const parent = symbol?.declarations?.[0]?.parent;
      return parent !== undefined && ts.isInterfaceDeclaration(parent) ? parent.name.text : null;
    };
    const checkKeyframe = (object) => {
      for (const property of object.properties) {
        if (property.type === 'SpreadElement') {
          context.report({ node: property, messageId: 'keyframes' });
          continue;
        }
        const names = keyNames(property, services);
        if (names === null) {
          context.report({ node: property.key, messageId: 'computed' });
          continue;
        }
        for (const key of names) {
          // Property-indexed keyframes give a list of values per property.
          const values =
            property.value.type === 'ArrayExpression'
              ? property.value.elements.flatMap((element) => literal(element))
              : literal(property.value);
          // `offset`, `easing` and `composite` time the keyframe; their values take the domain
          // of the animation property they stand for.
          const meta = KEYFRAME_META.get(key);
          if (meta === undefined) judge(property.value, cssName(key), values);
          else judge(property.value, key, values, undefined, { domain: meta });
        }
      }
    };
    // The timing of `animate` (a duration in ms, or an options object): each value takes the
    // domain of the animation property it stands for; a key not registered is reported.
    const checkTiming = (timing) => {
      if (timing.type !== 'ObjectExpression') {
        const tsNode = services.esTreeNodeToTSNodeMap.get(timing);
        if (checker.getTypeAtLocation(tsNode).flags & ts.TypeFlags.NumberLike)
          return judge(timing, 'animation-duration', literalValues(tsNode, checker, ms));
        return context.report({ node: timing, messageId: 'keyframes' });
      }
      for (const property of timing.properties) {
        const names = property.type === 'SpreadElement' ? null : keyNames(property, services);
        if (names === null) {
          context.report({ node: property, messageId: 'computed' });
          continue;
        }
        for (const key of names) {
          const prop = ANIMATION_OPTIONS.get(key);
          const tsValue = services.esTreeNodeToTSNodeMap.get(property.value);
          if (prop === undefined)
            judge(property.value, key, literalValues(tsValue, checker, String));
          else
            judge(
              property.value,
              prop,
              literalValues(
                tsValue,
                checker,
                prop.endsWith('-duration') || prop.endsWith('-delay') ? ms : String,
              ),
            );
        }
      }
    };
    const isStyleObject = (node) => isCssProperties(services.getTypeAtLocation(node));
    // A value that becomes a `CSSProperties` without being an object literal (`const s:
    // CSSProperties = o`, `return o`, `f(o)`, `<Avatar style={o} />`): its own type is judged,
    // so an object literal written without a contextual type is checked where it flows in.
    const intoStyle = (node) => {
      if (node === null || node === undefined || node.type === 'ObjectExpression') return;
      if (node.type === 'SpreadElement' || node.type === 'JSXEmptyExpression') return;
      const contextual = checker.getContextualType(services.esTreeNodeToTSNodeMap.get(node));
      if (contextual === undefined || !isCssProperties(contextual)) return;
      checkValue(node);
    };
    return {
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression') return intoStyle(node.right);
        if (isStyleDeclaration(node.left.object)) {
          const names = memberName(node.left);
          if (names === null) return context.report({ node: node.left, messageId: 'name' });
          for (const name of names) judge(node.right, cssName(name), literal(node.right));
          return;
        }
        if (isStyleObject(node.left.object)) {
          const names = memberName(node.left);
          if (names === null) return context.report({ node: node.left, messageId: 'computed' });
          for (const name of names)
            judge(
              node.right,
              cssName(name),
              literalValues(services.esTreeNodeToTSNodeMap.get(node.right), checker, unitFor(name)),
            );
          return;
        }
        intoStyle(node.right);
      },
      VariableDeclarator(node) {
        intoStyle(node.init);
      },
      ReturnStatement(node) {
        intoStyle(node.argument);
      },
      ArrowFunctionExpression(node) {
        if (node.body.type !== 'BlockStatement') intoStyle(node.body);
      },
      'CallExpression, NewExpression'(node) {
        const [target, ...rest] = node.arguments;
        // `Object.assign(style, o)` writes `o`'s entries into a `CSSProperties` object.
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Object' &&
          node.callee.property.name === 'assign' &&
          target !== undefined &&
          isStyleObject(target)
        )
          for (const source of rest)
            if (source.type === 'SpreadElement')
              context.report({ node: source, messageId: 'indexed' });
            else checkValue(source);
        for (const argument of node.arguments) intoStyle(argument);
      },
      Property(node) {
        if (node.parent.type === 'ObjectExpression') intoStyle(node.value);
      },
      ArrayExpression(node) {
        for (const element of node.elements) intoStyle(element);
      },
      JSXExpressionContainer(node) {
        const attribute = node.parent;
        // A native element's `style` is judged by `JSXAttribute`.
        if (
          attribute.type === 'JSXAttribute' &&
          attribute.name.name === 'style' &&
          attribute.parent.name.type === 'JSXIdentifier' &&
          /^[a-z]/.test(attribute.parent.name.name)
        )
          return;
        intoStyle(node.expression);
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        const method = callee.property.name;
        if (method === 'setProperty' && isStyleDeclaration(callee.object)) {
          const [name, value] = node.arguments;
          const names = possibleStrings(name, services);
          const prefixes = names ?? possiblePrefixes(name, services);
          if (prefixes === null) return context.report({ node, messageId: 'name' });
          const writer = fileKey(context, context.filename);
          for (const prop of prefixes)
            judge(
              value,
              prop,
              writer === TOKEN_PUBLISHER ? [{ registered: writer, origins: [] }] : literal(value),
            );
          return;
        }
        if (method === 'setAttribute' && declaringInterface(callee) === 'Element') {
          const [name, value] = node.arguments;
          const names = possibleStrings(name, services);
          // An attribute name the gate cannot enumerate could be a presentation attribute.
          if (names === null) return context.report({ node, messageId: 'name' });
          // Presentation attributes take the inline check, as their JSX form does.
          for (const attribute of names) {
            const prop = SVG_ATTRIBUTES.get(
              attribute.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
            );
            if (prop !== undefined) judge(value, prop, literal(value));
          }
          return;
        }
        if (method === 'animate' && declaringInterface(callee) === 'Animatable') {
          const [keyframes, timing] = node.arguments;
          if (timing !== undefined) checkTiming(timing);
          if (keyframes.type === 'ArrayExpression') {
            for (const element of keyframes.elements) {
              if (element?.type === 'ObjectExpression') checkKeyframe(element);
              else context.report({ node: element ?? keyframes, messageId: 'keyframes' });
            }
          } else if (keyframes.type === 'ObjectExpression') checkKeyframe(keyframes);
          else context.report({ node: keyframes, messageId: 'keyframes' });
        }
      },
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
          (SIZED_ELEMENTS.has(node.parent.name.name) && SIZE_ATTRIBUTES.has(node.name.name)
            ? node.name.name
            : undefined);
        if (prop === undefined || value === null) return;
        if (value.type === 'Literal')
          return judge(value, prop, [{ text: String(value.value), origins: [] }]);
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
