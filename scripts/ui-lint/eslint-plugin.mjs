/**
 * Local ESLint rules of the UI gate (UI drift lock plan v3, §2). All three are allow lists over
 * `registry.mjs`, judged by the type checker rather than by spelling:
 *
 * - `ui/dom-allowlist` (E5): the managed DOM surface is every member the default TypeScript
 *   library declares on the document-tree, attribute and style interfaces (computed from the
 *   checker: everything `Node`, `Element`, `Document`, `ShadowRoot` and the HTML/SVG/MathML element
 *   types inherit, plus the style and parsing interfaces in `STYLE_INTERFACES`), and the static
 *   members of their constructors. On that surface, every reference to a method and every write to
 *   a property is in `DOM_ALLOW`, in the file's `DOM_WRITERS` entry, or is an element factory whose
 *   product is in `SAFE_PRODUCTS`. A computed member that cannot be read statically on a managed
 *   object is rejected, and so is reflection (`Object.assign`, `Reflect.set`, …) with a managed
 *   argument. A DOM API that does not exist yet is unregistered, so it is rejected by default.
 * - `ui/element-allowlist` (E11): native JSX elements (and React `createElement` string tags) are
 *   registered elements; a tag held in a variable is judged by its type.
 * - `ui/inline-style-keys` (E4, keys): a value reaching a native `style` or typed `CSSProperties`
 *   has enumerable keys: no index signature other than `` `--${string}` ``, no computed key that
 *   is not a string-literal union.
 */
import path from 'node:path';

import ts from 'typescript';

import { DOM_ALLOW, DOM_WRITERS, ELEMENTS, SAFE_PRODUCTS } from './registry.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

/** Interfaces outside the node hierarchy whose members also write markup, styles or nodes. */
const STYLE_INTERFACES = [
  'CSSStyleDeclaration',
  'CSSStyleProperties',
  'CSSRule',
  'CSSRuleList',
  'CSSStyleSheet',
  'StyleSheet',
  'StyleSheetList',
  'MediaList',
  'StylePropertyMap',
  'StylePropertyMapReadOnly',
  'DOMTokenList',
  'DOMStringMap',
  'NamedNodeMap',
  'Range',
  'AbstractRange',
  'Selection',
  'DOMParser',
  'XMLSerializer',
  'FontFaceSet',
  'CustomElementRegistry',
  'ElementInternals',
  'Animation',
  'KeyframeEffect',
  'AnimationEffect',
  'CSS',
];
const ROOT_INTERFACES = [
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'MathMLElement',
  'Document',
  'DocumentFragment',
  'ShadowRoot',
  'Text',
  'Comment',
  'Attr',
  'CharacterData',
];
const TAG_MAPS = ['HTMLElementTagNameMap', 'SVGElementTagNameMap', 'MathMLElementTagNameMap'];
/** Event dispatch is shared with non-DOM objects and writes nothing. */
const UNMANAGED = new Set(['EventTarget']);
const FACTORIES = new Set(['createElement', 'createElementNS']);
const NAMED_WRITERS = new Set([
  'setAttribute',
  'removeAttribute',
  'toggleAttribute',
  'setAttributeNS',
  'setProperty',
  'removeProperty',
]);
const REFLECTION = {
  ObjectConstructor: new Set(['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf']),
  Reflect: new Set(['set', 'defineProperty', 'apply', 'construct', 'setPrototypeOf']),
};

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
  const resolve = (name) => checker.resolveName(name, lib, ts.SymbolFlags.Type, false);
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
  for (const name of [...ROOT_INTERFACES, ...STYLE_INTERFACES]) {
    managed.add(name);
    const symbol = resolve(name);
    if (symbol) contributors(checker.getDeclaredTypeOfSymbol(symbol));
  }
  for (const map of TAG_MAPS) {
    const symbol = resolve(map);
    if (!symbol) continue;
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
      const names = nameArgument && possibleStrings(nameArgument, services);
      if (names === null || names === undefined) {
        if (!own.has(`${member}:*`)) context.report({ node, messageId: 'name', data: { member } });
        return;
      }
      for (const name of names) {
        if (!own.has(`${member}:${name}`) && !own.has(`${member}:*`)) {
          context.report({ node, messageId: 'member', data: { member: `${member}:${name}` } });
        }
      }
    };

    /** A reference to a library member `symbol` at `node` (member expression or pattern key). */
    const checkMember = (node, symbol, isCall) => {
      const info = describe(symbol?.declarations?.[0], program);
      if (!info || !managed.has(info.owner)) return;
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
        if (symbol && describe(symbol.declarations?.[0], program))
          return checkMember(node, symbol, isCall);
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
          if (property) checkMember(node, property, isCall);
        }
      },
      // const { insertAdjacentHTML } = el
      'ObjectPattern > Property'(node) {
        if (node.computed) return;
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        const nameNode = tsNode.propertyName ?? tsNode.name;
        if (!nameNode || !ts.isIdentifier(nameNode)) return;
        const source = checker.getApparentType(checker.getTypeAtLocation(tsNode.parent));
        const symbol = checker.getPropertyOfType(source, nameNode.text);
        if (symbol) checkMember(node, symbol, false);
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
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        const declaration = checker.getResolvedSignature(tsNode)?.getDeclaration();
        const info = describe(declaration, program);
        const name =
          declaration?.name && ts.isIdentifier(declaration.name)
            ? declaration.name.text
            : undefined;
        if (!info || !REFLECTION[info.owner]?.has(name)) return;
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

const elementAllowlist = {
  meta: {
    type: 'problem',
    docs: { description: 'Allow only registered native elements (UI gate E11).' },
    schema: [],
    messages: {
      element:
        '`<{{tag}}>` is not a registered native element (UI gate E11, scripts/ui-lint/registry.mjs).',
      dynamic: 'This element tag cannot be enumerated (UI gate E11).',
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
    return {
      JSXOpeningElement(node) {
        const { name } = node;
        // A lower-case JSX name is an intrinsic element by JSX semantics; others are judged by type.
        if (name.type === 'JSXIdentifier' && /^[a-z]/.test(name.name))
          return check(node, [name.name]);
        if (name.type === 'JSXNamespacedName')
          return check(node, [`${name.namespace.name}:${name.name.name}`]);
        return check(node, tagNames(name, services));
      },
      CallExpression(node) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        const declaration = checker.getResolvedSignature(tsNode)?.getDeclaration();
        const file = declaration?.getSourceFile().fileName ?? '';
        const name =
          declaration?.name && ts.isIdentifier(declaration.name)
            ? declaration.name.text
            : undefined;
        if (
          !/[\\/]@types[\\/]react[\\/]/.test(file) ||
          (name !== 'createElement' && name !== 'cloneElement')
        )
          return;
        const [tag] = node.arguments;
        if (tag && name === 'createElement') check(node, tagNames(tag, services));
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

function isCustomPropertyKey(keyType) {
  return (
    Boolean(keyType.flags & ts.TypeFlags.TemplateLiteral) &&
    keyType.texts.length === 2 &&
    keyType.texts[0] === '--' &&
    keyType.texts[1] === '' &&
    Boolean(keyType.types[0].flags & ts.TypeFlags.String)
  );
}

function hasIndexSignature(type, checker) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  return parts.some(
    (part) =>
      part.flags & ts.TypeFlags.Object &&
      checker.getIndexInfosOfType(part).some((info) => !isCustomPropertyKey(info.keyType)),
  );
}

const inlineStyleKeys = {
  meta: {
    type: 'problem',
    docs: { description: 'Require enumerable keys in inline style objects (UI gate E4).' },
    schema: [],
    messages: {
      computed: 'This style key hides which property is written (UI gate E4).',
      indexed:
        'This style value has an index signature, so the properties it writes are not enumerable (UI gate E4).',
    },
  },
  create(context) {
    const { services, checker } = typedServices(context);
    const checked = new Set();
    const checkObject = (object) => {
      if (checked.has(object)) return;
      checked.add(object);
      for (const property of object.properties) {
        if (property.type === 'SpreadElement') checkValue(property.argument);
        else if (property.computed && possibleStrings(property.key, services) === null) {
          context.report({ node: property.key, messageId: 'computed' });
        }
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
        default:
          if (hasIndexSignature(services.getTypeAtLocation(node), checker))
            context.report({ node, messageId: 'indexed' });
      }
    };
    return {
      ObjectExpression(node) {
        const contextual = checker.getContextualType(services.esTreeNodeToTSNodeMap.get(node));
        if (contextual !== undefined && isCssProperties(contextual)) checkObject(node);
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'style') return;
        if (!(node.parent.name.type === 'JSXIdentifier' && /^[a-z]/.test(node.parent.name.name)))
          return;
        if (
          node.value?.type !== 'JSXExpressionContainer' ||
          node.value.expression.type === 'JSXEmptyExpression'
        )
          return;
        checkValue(node.value.expression);
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
