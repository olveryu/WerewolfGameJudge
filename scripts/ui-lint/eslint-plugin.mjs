/**
 * Local ESLint rules of the UI gate (UI drift lock plan v3, §2). All four are allow lists over
 * `registry.mjs`:
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
 *   keys written out, and every value (and every SVG presentation attribute) is read from its
 *   write site's syntax alone (`written.mjs`) and judged by the one value exit (`verdict`,
 *   `values.mjs`): a literal, a registered token constant's member, a registered runtime source's
 *   call into a custom property, or 0. Any other expression is `untracked` (plan D15 ②).
 * - `ui/package-adapter` (E12): a package that writes the page from values we hand it is
 *   imported only by its registered adapter, judged by the import's syntax; no module that
 *   imports it re-exports it, exposes its types or lets its values leave under another type.
 */
import path from 'node:path';

import ts from 'typescript';

import {
  ATTRIBUTES,
  DOM_ALLOW,
  DOM_VALUE_WRITERS,
  DOM_WRITERS,
  ELEMENTS,
  FACTORIES,
  FILE_ELEMENTS,
  HTML_KEYS,
  NAMED_WRITERS,
  OPEN_ATTRIBUTES,
  PACKAGES,
  REACT_UNITLESS,
  REFLECTION,
  ROOT_INTERFACES,
  SAFE_PRODUCTS,
  SIZE_ATTRIBUTES,
  SIZE_HOSTS,
  STYLE_TYPE_WRAPPERS,
  ANIMATION_OPTIONS,
  adapterOf,
  KEYFRAME_META,
  STYLE_DECLARATIONS,
  TOKEN_PUBLISHER,
  STYLE_INTERFACES,
  SVG_ATTRIBUTES,
  TAG_MAPS,
  UNMANAGED,
} from './registry.mjs';
import { verdict } from './values.mjs';
import { strip, writeOf, writtenKey, writtenName, writtenValue } from './written.mjs';

function typedServices(context) {
  const services = context.sourceCode.parserServices;
  if (services?.program == null) throw new Error(`${context.id} needs type information.`);
  const checker = services.program.getTypeChecker();
  return { services, program: services.program, checker };
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
  // SVG's DOM data types (P1 QA17 F2): an SVG element exposes its attributes as live objects
  // (`rect.rx.baseVal.value = 8`, `g.transform.baseVal.getItem(0).setTranslate(37, 0)`), so a
  // write through one is an attribute write. The family is computed, not listed: the `SVG…`
  // types of the SVG elements' properties, closed over everything they hold or return (the
  // `SVGLength`, `SVGTransform`, `DOMMatrix`, `DOMPoint`, `DOMRect` they hand out).
  const domTypes = (type) =>
    (type.isUnionOrIntersection() ? type.types : [type])
      .map((part) => part.getSymbol() ?? part.aliasSymbol)
      .filter((symbol) => {
        const declaration = symbol?.declarations?.[0];
        return (
          declaration &&
          ts.isInterfaceDeclaration(declaration) &&
          isDomLibrary(declaration.getSourceFile())
        );
      })
      .map((symbol) => symbol.getName());
  const held = (name, { methods }) => {
    const out = [];
    const type = checker.getDeclaredTypeOfSymbol(required(name));
    for (const property of checker.getPropertiesOfType(type)) {
      const declaration = property.declarations?.[0];
      if (!declaration || !isDomLibrary(declaration.getSourceFile())) continue;
      const value = checker.getTypeOfSymbolAtLocation(property, declaration);
      const signatures = value.getCallSignatures();
      if (signatures.length > 0 && !methods) continue;
      for (const part of signatures.length > 0 ? signatures.map((s) => s.getReturnType()) : [value])
        out.push(...domTypes(part));
    }
    return out;
  };
  const elements = new Set(managed);
  const svg = [...elements]
    .filter((name) => /^SVG\w*Element$/.test(name))
    .flatMap((name) => held(name, { methods: false }))
    .filter((name) => name.startsWith('SVG') && !elements.has(name));
  const queue = [...new Set(svg)];
  for (const name of queue) managed.add(name);
  while (queue.length > 0)
    for (const name of held(queue.pop(), { methods: true }))
      if (!managed.has(name) && !UNMANAGED.has(name)) {
        managed.add(name);
        queue.push(name);
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
      const write = node.type === 'MemberExpression' && writeOf(node) !== null;
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
          if (isCall || writeOf(node) !== null) context.report({ node, messageId: 'computed' });
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

/**
 * The native tags a JSX element name denotes: the one definition both `ui/element-allowlist`
 * and `ui/inline-style-keys` use (P1 QA16 F3: each had its own lower-case test, so
 * `const Tag = 'rect' as const; <Tag fill="#f00" />` reached a native element unjudged). A
 * lower-case name is an intrinsic element by JSX semantics; any other name is judged by its type
 * (`tagNames`): undefined for a component, null when a string part cannot be enumerated.
 */
function nativeTags(name, services) {
  if (name.type === 'JSXIdentifier' && /^[a-z]/.test(name.name)) return [name.name];
  if (name.type === 'JSXNamespacedName') return [`${name.namespace.name}:${name.name.name}`];
  return tagNames(name, services);
}

/** A JSX attribute's name as written (`xlink:href` for a namespaced one). */
const attributeName = (name) =>
  name.type === 'JSXNamespacedName' ? `${name.namespace.name}:${name.name.name}` : name.name;

/** Whether `name` is an open attribute (`aria-*`, `data-*`, a handler): the one definition. */
const isOpenAttribute = (name) => OPEN_ATTRIBUTES.some((pattern) => pattern.test(name));

/**
 * Whether `<tag>` may carry `name` as a registered attribute whose value is not a style value
 * (`tag` `*`: an element not known, which takes only the global ones).
 */

function isPlainAttribute(name, tag) {
  if (isOpenAttribute(name)) return true;
  const elements = ATTRIBUTES.get(name);
  return elements !== undefined && (elements.has('*') || elements.has(tag));
}

/**
 * Whether `<tag>` may carry `name` written as an attribute: a plain one, or one whose value
 * `ui/inline-style-keys` judges (`style`, an SVG presentation attribute, the size of a sized
 * element), or raw HTML, which is reported as such.
 */
function isAttribute(name, tag) {
  return isPlainAttribute(name, tag) || isValueAttribute(name, tag) || HTML_KEYS.has(name);
}

/**
 * Whether `name` on `<tag>` is an attribute `ui/inline-style-keys` reads: `style`, an SVG
 * presentation attribute, or a `width`/`height` whose meaning `SIZE_HOSTS` gives (E4).
 */
function isValueAttribute(name, tag) {
  return (
    name === 'style' ||
    SVG_ATTRIBUTES.has(name) ||
    (SIZE_HOSTS.has(tag) && SIZE_ATTRIBUTES.has(name))
  );
}

/** `width`/`height` on an element whose tag (`null`: not known) or DOM interface is given. */
const sizeMeaning = {
  ofTag: (tag) => (tag === null ? 'box' : SIZE_HOSTS.get(tag)?.meaning),
  ofElement: (name) =>
    [...SIZE_HOSTS.values()].find((host) => host.element === name)?.meaning ?? 'box',
  ofReact: (name) => [...SIZE_HOSTS.values()].find((host) => host.react === name)?.meaning ?? 'box',
};

/**
 * The style property a written attribute's value is judged as, or undefined: the one definition
 * for a JSX attribute on a native element, a component prop that lands on one, and
 * `setAttribute`. `meanings` are the `sizeMeaning`s of the elements it may land on.
 */
function attributeProp(name, meanings) {
  const camel = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  if (SVG_ATTRIBUTES.has(camel)) return SVG_ATTRIBUTES.get(camel);
  return SIZE_ATTRIBUTES.has(name) && meanings.includes('box') ? name : undefined;
}

/** The package a declaration lives in (`@scope/name` under its last `node_modules`), or undefined. */
function packageOf(declaration) {
  const file = declaration.getSourceFile().fileName.split(path.sep).join('/');
  const at = file.lastIndexOf('/node_modules/');
  if (at === -1) return undefined;
  const [first, second] = file.slice(at + '/node_modules/'.length).split('/');
  return first.startsWith('@') ? `${first}/${second}` : first;
}

/** Every member of a union or intersection, flattened. */
const members = (type) => (type.isUnionOrIntersection() ? type.types.flatMap(members) : [type]);

/** React's own attribute interfaces: `key` and `ref`, read by React, not by an element. */
const REACT_OWN_ATTRIBUTES = new Set(['Attributes', 'RefAttributes', 'ClassAttributes']);

/**
 * Where a prop we write into a component's props is declared: React's DOM attribute interfaces
 * (`SVGAttributes`, `ImgHTMLAttributes`, …) hand it to a native element, where it is judged as
 * that attribute (`{ react }`); React's own `key`/`ref` and any other declaration are not a
 * value the page shows from here (`{ own: true }`: a package's is handed over only in its
 * adapter, E12); `null`: the props type declares no such key.
 */
function propSource(owner, name, checker) {
  const sites = [];
  for (const type of members(checker.getApparentType(owner))) {
    const symbol = checker.getPropertyOfType(type, name);
    if (symbol?.declarations?.length) sites.push(...symbol.declarations);
    else if (symbol !== undefined || checker.getIndexInfosOfType(type).length > 0) {
      const site = (type.aliasSymbol ?? type.getSymbol())?.declarations?.[0];
      if (site !== undefined) sites.push(site);
    }
  }
  if (sites.length === 0) return null;
  for (const site of sites) {
    const parent = site.parent;
    if (
      packageOf(site) === '@types/react' &&
      ts.isInterfaceDeclaration(parent) &&
      !REACT_OWN_ATTRIBUTES.has(parent.name.text) &&
      /Attributes$/.test(parent.name.text)
    )
      return { react: parent.name.text };
  }
  return { own: true };
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
        'These props are not an object literal written here, so the keys and values they carry are not shown: write the element in JSX with each attribute written out (UI gate E11).',
      attribute:
        '`{{name}}` is not a registered attribute of `<{{tag}}>` (UI gate E11, scripts/ui-lint/registry.mjs ATTRIBUTES).',
      spread:
        'These props reach `<{{tag}}>` by spread: the keys and values they carry are not written here, so write each as an attribute (UI gate E4, E11).',
      props:
        '`{{name}}` reaches `<{{tag}}>` through createElement or cloneElement props: write it as a JSX attribute, where its name and value are checked (UI gate E4, E11).',
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
    /**
     * Props handed to `createElement`/`cloneElement` (`tags` null when the element is not
     * known): only an object literal written here shows its keys, and each must be a registered
     * attribute that holds no style value (a value attribute is judged only in JSX). Anything
     * else is `opaque`: a type names the keys a value has at least, never at most (P1 QA15 F2).
     */
    const checkProps = (node, tags) => {
      if (node.type === 'Literal' && node.value === null) return;
      if (node.type !== 'ObjectExpression') return context.report({ node, messageId: 'opaque' });
      for (const property of node.properties) {
        const key =
          property.type === 'SpreadElement' ? null : writtenKey(property.key, property.computed);
        if (key === null) {
          context.report({ node: property, messageId: 'opaque' });
          continue;
        }
        // Raw HTML keys are reported as such wherever they are written.
        if (HTML_KEYS.has(key)) continue;
        for (const tag of tags ?? ['*'])
          if (!isPlainAttribute(key, tag))
            context.report({ node: property, messageId: 'props', data: { name: key, tag } });
      }
    };
    return {
      JSXOpeningElement(node) {
        const tags = nativeTags(node.name, services);
        check(node, tags);
        // A tag that cannot be enumerated (reported above) takes only the global attributes.
        const native = tags === null ? ['*'] : tags;
        for (const attribute of node.attributes) {
          if (attribute.type === 'JSXSpreadAttribute') {
            // Spread props are never written out here, whatever their type lists (P1 QA15 F2).
            if (native !== undefined)
              context.report({
                node: attribute,
                messageId: 'spread',
                data: { tag: native.join('|') },
              });
            continue;
          }
          const name = attributeName(attribute.name);
          const tag = native?.find(
            (candidate) =>
              (candidate === '*' || ELEMENTS.has(candidate) || own.has(candidate)) &&
              !isAttribute(name, candidate),
          );
          if (tag !== undefined)
            context.report({ node: attribute, messageId: 'attribute', data: { name, tag } });
          else if (attribute.name.type === 'JSXIdentifier' && HTML_KEYS.has(attribute.name.name))
            context.report({ node: attribute, messageId: 'html', data: { name } });
        }
      },
      // { dangerouslySetInnerHTML: … }, { __html: … }, however the object reaches React.
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') return;
        const name = writtenKey(node.key, node.computed);
        // A key not written out reaches a native element only by spread or as props that are
        // not a literal, both reported there; reporting it here would also flag every ordinary
        // `{ [id]: value }` map (P1 QA7 N1).
        if (name !== null && HTML_KEYS.has(name))
          context.report({ node: node.key, messageId: 'html', data: { name } });
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
          if (tags !== undefined && props) checkProps(props, tags);
        }
        if (name === 'cloneElement' && props) checkProps(props, null);
      },
    };
  },
};

/**
 * Whether a type is React's `CSSProperties`, alone, in a union or intersection, or under a
 * wrapper that keeps its keys (`STYLE_TYPE_WRAPPERS`: `Partial<CSSProperties>`,
 * `Omit<CSSProperties, …>`; P1 QA16 S3).
 */
function isCssProperties(type) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  return parts.some(
    (part) =>
      [part.aliasSymbol?.getName(), part.getSymbol()?.getName()].includes('CSSProperties') ||
      (STYLE_TYPE_WRAPPERS.has(part.aliasSymbol?.getName()) &&
        isCssProperties(part.aliasTypeArguments[0])),
  );
}

/** `borderRadius` → `border-radius`, `WebkitLineClamp` → `-webkit-line-clamp`, `--x` → `--x`. */
function cssName(key) {
  if (key.startsWith('--')) return key;
  const kebab = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return /^ms-/.test(kebab) ? `-${kebab}` : kebab;
}

/** A number of milliseconds as CSS (`animate` timing). */
const ms = (number) => (number === 0 ? '0' : `${number}ms`);

const inlineStyleKeys = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Inline styles, DOM style writes and SVG presentation attributes: keys and values written out as literals the value checker allows (UI gate E4).',
    },
    schema: [],
    messages: {
      computed:
        'This style key is computed, so the property it writes is not shown where it is written: write the key out as an identifier or string literal (UI gate E4).',
      value: '{{message}}',
      untracked: '{{message}}',
      keyframes:
        'Keyframes passed to `animate` are checked where they are written: pass an array or object literal (UI gate E4).',
      name: 'This DOM style write names its property through an expression, so which property it writes is not shown: write the name as a string literal here, or a `--x-${…}` template with a literal custom property prefix (UI gate E4).',
      indirect:
        'This DOM method writes a style value; call it directly so its value is checked (UI gate E4).',
      undeclared:
        "`{{name}}` has no declaration in the props type of this component, so what reads it (and whether it reaches the page as a style) is not shown: declare it in the component's props type (UI gate E4).",
      alias:
        'A style declaration is handed to a position not typed as one, where the properties written through it are not shown as style writes: write them on the declaration itself (UI gate E4).',
      styleText:
        'A style is written as CSS text (a `style` attribute, `cssText`), whose declarations are not shown as properties: write each property through `style` instead (UI gate E4).',
    },
  },
  create(context) {
    const { services, checker } = typedServices(context);
    const toTs = (node) => services.esTreeNodeToTSNodeMap.get(node);
    // Every value check ends here, and only `verdict` decides that a value passes (P1 QA13).
    const judge = (node, prop, readings, options) => {
      for (const problem of verdict(readings, prop, options))
        context.report({
          node,
          messageId: problem.messageId,
          data: { message: problem.message },
        });
    };
    const unitFor = (key) => (number) =>
      number === 0 || key.startsWith('--') || REACT_UNITLESS.has(key)
        ? String(number)
        : `${number}px`;
    // Where an identifier is imported from, by its declaration in scope and the module the
    // compiler resolves the specifier to (an import source, not a value), else null.
    const options = services.program.getCompilerOptions();
    const importOf = (identifier) => {
      let scope = context.sourceCode.getScope(identifier);
      let variable;
      while (scope !== null && variable === undefined) {
        variable = scope.set.get(identifier.name);
        scope = scope.upper;
      }
      const definition = variable?.defs.length === 1 ? variable.defs[0] : undefined;
      if (definition?.type !== 'ImportBinding') return null;
      const resolved = ts.resolveModuleName(
        definition.parent.source.value,
        context.filename,
        options,
        ts.sys,
      ).resolvedModule;
      if (resolved === undefined) return null;
      const module = fileKey(context, resolved.resolvedFileName).replace(/\.(?:d\.)?tsx?$/, '');
      const specifier = definition.node;
      if (specifier.type === 'ImportNamespaceSpecifier') return { module, name: '*' };
      if (specifier.type === 'ImportDefaultSpecifier') return { module, name: 'default' };
      return {
        module,
        name:
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value,
      };
    };
    const read = (node, unit) => [writtenValue(node, unit, importOf)];
    const checked = new Set();
    const wholeObject = (node) => {
      if (checked.has(node)) return;
      checked.add(node);
      judge(node, null, [{ runtime: 'object' }]);
    };
    // A style object literal: each key written out, each value judged as written; a spread
    // brings an object whose entries are not written here.
    const checkObject = (object) => {
      if (checked.has(object)) return;
      checked.add(object);
      for (const property of object.properties) {
        if (property.type === 'SpreadElement') {
          wholeObject(property);
          continue;
        }
        const key = writtenKey(property.key, property.computed);
        if (key === null) {
          context.report({ node: property.key, messageId: 'computed' });
          continue;
        }
        judge(property.value, cssName(key), read(property.value, unitFor(key)));
      }
    };
    const checkStyle = (node) =>
      strip(node).type === 'ObjectExpression' ? checkObject(strip(node)) : wholeObject(node);
    // Which expressions are style targets is told by their declared type (an entry point, not a
    // value: what they are assigned is read from syntax only).
    // A style declaration is any value of which some part is one (`CSSStyleDeclaration |
    // undefined` included); a position receives one only if every part it allows is one.
    const parts = (type) => (type.isUnion() ? type.types : [type]);
    const isDeclarationType = (type) => STYLE_DECLARATIONS.has(checker.typeToString(type));
    const isStyleDeclaration = (node) =>
      parts(services.getTypeAtLocation(node)).some(isDeclarationType);
    const nullish = ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void;
    const receivesDeclaration = (type) =>
      parts(type)
        .filter((part) => !(part.flags & nullish))
        .every(isDeclarationType);
    const isStyleObject = (node) => isCssProperties(services.getTypeAtLocation(node));
    /**
     * A prop we write on a component, by where its props type declares it (`propSource`): a React
     * DOM attribute is judged as the attribute it becomes (its `style` is a position typed as a
     * style object, `intoStyle`); any other declaration is ours, or a package's handed over only
     * in its adapter (E12); no declaration is reported (`undeclared`).
     */
    const checkKey = (node, name, source, expression) => {
      if (source === null) return context.report({ node, messageId: 'undeclared', data: { name } });
      if (source.react === undefined || expression === null || name === 'style') return;
      const prop = attributeProp(name, [sizeMeaning.ofReact(source.react)]);
      if (prop !== undefined) judge(expression, prop, read(expression, String));
    };
    const isCssPropertiesLiteral = (node) => {
      const contextual = checker.getContextualType(toTs(node));
      return contextual !== undefined && isCssProperties(contextual);
    };
    // Any position typed as a style object (a library component's `style`, a typed constant, an
    // argument): what is not an object literal there is a whole object whose values are not
    // written here. A literal is checked by `ObjectExpression`.
    const intoStyle = (node) => {
      if (node === null || node === undefined) return;
      if (['ObjectExpression', 'SpreadElement', 'JSXEmptyExpression'].includes(strip(node).type))
        return;
      // A style declaration is judged where it is handed over (`checkHandOver`).
      if (isStyleDeclaration(node)) return;
      if (isCssPropertiesLiteral(node)) wholeObject(node);
    };
    /**
     * A live style declaration (`el.style`, a variable holding it, `getComputedStyle(el)`) handed
     * to a position not typed as one: its members are then written under a type the gate does
     * not read as a style (P1 QA16 S2, QA17 F4). Judged at every expression that yields one, by
     * the position it lands in, not by a list of parents: it may be the object of a member
     * access, a `const`/`let` initializer without a type annotation (the binding takes its type),
     * or the value of a position whose type is a style declaration; anywhere else (a class field,
     * a default, a branch of a condition, an array or object entry, a spread, `yield`, a
     * callback's annotated parameter by way of an array) it is reported as `alias`.
     */
    const checkHandOver = (node) => {
      let at = node;
      while (at.parent.type === 'TSNonNullExpression' || at.parent.type === 'ChainExpression')
        at = at.parent;
      const parent = at.parent;
      if (parent.type === 'MemberExpression' && parent.object === at) return;
      if (
        parent.type === 'VariableDeclarator' &&
        parent.init === at &&
        parent.id.typeAnnotation === undefined
      )
        return;
      // Re-exported or discarded, it keeps its own type.
      if (parent.type === 'ExpressionStatement' || parent.type === 'ExportSpecifier') return;
      if (!isStyleDeclaration(node)) return;
      const contextual = checker.getContextualType(toTs(at));
      if (contextual !== undefined && receivesDeclaration(contextual)) return;
      context.report({ node, messageId: 'alias' });
    };
    // Any write to a member of a style declaration or a `CSSProperties` object (`writeOf`: `=`,
    // a compound operator, `++`, a destructuring or `for…of` target).
    const checkMemberWrite = (member, { value, operator }) => {
      if (operator === 'delete') return;
      const declaration = isStyleDeclaration(member.object);
      if (!declaration && !isStyleObject(member.object)) return;
      const key = writtenKey(member.property, member.computed);
      if (key === null)
        return context.report({ node: member, messageId: declaration ? 'name' : 'computed' });
      // CSS text, not a property (P1 QA23 S2).
      if (declaration && key === 'cssText')
        return context.report({ node: member, messageId: 'styleText' });
      const unit = declaration ? String : unitFor(key);
      // Only a plain `=` shows the value it writes; any other write computes it or receives it
      // from elsewhere.
      if (value !== null) return judge(value, cssName(key), read(value, unit));
      judge(member, cssName(key), [{ runtime: 'expression' }]);
    };
    const checkKeyframe = (object) => {
      for (const property of object.properties) {
        if (property.type === 'SpreadElement') {
          context.report({ node: property, messageId: 'keyframes' });
          continue;
        }
        const key = writtenKey(property.key, property.computed);
        if (key === null) {
          context.report({ node: property.key, messageId: 'computed' });
          continue;
        }
        // Property-indexed keyframes give a list of values per property.
        const values =
          property.value.type === 'ArrayExpression'
            ? property.value.elements.map((element) =>
                element === null
                  ? { runtime: 'expression' }
                  : writtenValue(element, String, importOf),
              )
            : read(property.value, String);
        // `offset`, `easing` and `composite` time the keyframe; their values take the domain
        // of the animation property they stand for.
        const meta = KEYFRAME_META.get(key);
        if (meta === undefined) judge(property.value, cssName(key), values);
        else judge(property.value, key, values, { domain: meta });
      }
    };
    // The keyframes an animation writes (`animate`, `setKeyframes`, `new KeyframeEffect`): an
    // array or object literal written here; `null` clears them.
    const checkKeyframes = (keyframes, at) => {
      if (keyframes === undefined) return context.report({ node: at, messageId: 'keyframes' });
      if (keyframes.type === 'Literal' && keyframes.value === null) return;
      if (keyframes.type === 'ArrayExpression') {
        for (const element of keyframes.elements) {
          if (element?.type === 'ObjectExpression') checkKeyframe(element);
          else context.report({ node: element ?? keyframes, messageId: 'keyframes' });
        }
      } else if (keyframes.type === 'ObjectExpression') checkKeyframe(keyframes);
      else context.report({ node: keyframes, messageId: 'keyframes' });
    };
    // The timing of `animate` (a duration in ms, or an options object): each value takes the
    // domain of the animation property it stands for; a key not registered is reported.
    const checkTiming = (timing) => {
      if (timing.type !== 'ObjectExpression')
        return judge(timing, 'animation-duration', read(timing, ms));
      for (const property of timing.properties) {
        const key =
          property.type === 'SpreadElement' ? null : writtenKey(property.key, property.computed);
        if (key === null) {
          context.report({ node: property, messageId: 'computed' });
          continue;
        }
        const prop = ANIMATION_OPTIONS.get(key);
        if (prop === undefined) judge(property.value, key, read(property.value, String));
        else
          judge(
            property.value,
            prop,
            read(
              property.value,
              prop.endsWith('-duration') || prop.endsWith('-delay') ? ms : String,
            ),
          );
      }
    };
    // A member or binding key that resolves to a DOM method writing a style value: its
    // `DOM_VALUE_WRITERS` entry, else undefined.
    const valueWriter = (symbol) => {
      for (const declaration of symbol?.declarations ?? []) {
        const parent = declaration.parent;
        if (!ts.isInterfaceDeclaration(parent)) continue;
        const writer = DOM_VALUE_WRITERS.get(`${parent.name.text}.${symbol.getName()}`);
        if (writer !== undefined) return writer;
      }
      return undefined;
    };
    const checkWrite = (writer, call, callee) => {
      const args = call.arguments;
      if (writer === 'setProperty') {
        const [name, value] = args;
        const written = name === undefined ? null : writtenName(name);
        if (written === null || value === undefined)
          return context.report({ node: call, messageId: 'name' });
        const prop = written.name ?? written.prefix;
        const publisher = fileKey(context, context.filename) === TOKEN_PUBLISHER;
        judge(value, prop, publisher ? [{ registered: TOKEN_PUBLISHER }] : read(value, String));
        return;
      }
      if (writer === 'setAttribute' || writer === 'setAttributeNS') {
        const [name, value] = writer === 'setAttribute' ? args : args.slice(1);
        const written = name === undefined ? null : writtenName(name);
        // An attribute name not written out could be a presentation attribute.
        if (written === null || written.name === undefined || value === undefined)
          return context.report({ node: call, messageId: 'name' });
        // A `style` attribute is CSS text: its declarations are not written as properties here.
        if (written.name.toLowerCase() === 'style')
          return context.report({ node: call, messageId: 'styleText' });
        // Presentation attributes and box sizes take the inline check, as their JSX form does.
        const prop = attributeProp(written.name, [
          sizeMeaning.ofElement(checker.typeToString(services.getTypeAtLocation(callee.object))),
        ]);
        if (prop !== undefined) judge(value, prop, read(value, String));
        return;
      }
      if (writer === 'animate') {
        const [keyframes, timing] = args;
        if (timing !== undefined) checkTiming(timing);
        return checkKeyframes(keyframes, callee);
      }
      if (writer === 'setKeyframes') return checkKeyframes(args[0], callee);
      if (writer === 'updateTiming') {
        if (args[0] !== undefined) checkTiming(args[0]);
        return;
      }
      throw new Error(`UI gate E4: unknown DOM value writer ${writer}`);
    };
    return {
      VariableDeclarator(node) {
        intoStyle(node.init);
      },
      ReturnStatement(node) {
        intoStyle(node.argument);
      },
      ArrowFunctionExpression(node) {
        if (node.body.type !== 'BlockStatement') intoStyle(node.body);
      },
      NewExpression(node) {
        for (const argument of node.arguments) intoStyle(argument);
        // `new KeyframeEffect(target, keyframes, timing)` writes keyframes as `animate` does.
        const constructor = checker.getSymbolAtLocation(toTs(node.callee));
        if (
          constructor?.getName() === 'KeyframeEffect' &&
          constructor.declarations?.some((declaration) =>
            isDomLibrary(declaration.getSourceFile()),
          ) &&
          node.arguments.length > 1
        ) {
          const [, keyframes, timing] = node.arguments;
          checkKeyframes(keyframes, node);
          if (timing !== undefined) checkTiming(timing);
        }
      },
      Property(node) {
        if (node.parent.type === 'ObjectExpression') intoStyle(node.value);
      },
      AssignmentExpression(node) {
        intoStyle(node.right);
      },
      ArrayExpression(node) {
        for (const element of node.elements) intoStyle(element);
      },
      JSXExpressionContainer(node) {
        intoStyle(node.expression);
      },
      CallExpression(node) {
        checkHandOver(node);
        const [target, ...sources] = node.arguments;
        // `Object.assign(style, …)` writes its sources' entries into a style target.
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Object' &&
          writtenKey(node.callee.property, node.callee.computed) === 'assign' &&
          target !== undefined &&
          target.type !== 'SpreadElement' &&
          (isStyleObject(target) || isStyleDeclaration(target))
        )
          for (const source of sources) checkStyle(source);
        for (const argument of node.arguments) intoStyle(argument);
      },
      // The DOM methods that write a style value are found by the member they resolve to, however
      // the member is spelled (`el.animate`, `el['animate']`); each is judged where it is called
      // directly, and any other reference to one (`.call`, `.bind`, a variable, destructuring)
      // hands it on unjudged and is reported (P1 QA14 F4).
      MemberExpression(node) {
        checkHandOver(node);
        const write = writeOf(node);
        if (write !== null) checkMemberWrite(node, write);
        const access = toTs(node);
        const writer = valueWriter(
          checker.getSymbolAtLocation(
            ts.isPropertyAccessExpression(access) ? access.name : access.argumentExpression,
          ),
        );
        if (writer === undefined) return;
        if (node.parent.type === 'CallExpression' && node.parent.callee === node)
          return checkWrite(writer, node.parent, node);
        context.report({ node, messageId: 'indirect' });
      },
      'ObjectPattern > Property'(node) {
        const binding = toTs(node);
        const key = binding.propertyName ?? binding.name;
        const names = ts.isIdentifier(key) || ts.isStringLiteral(key) ? [key.text] : null;
        // A computed key could name any member; `ui/dom-allowlist` judges which it may.
        if (names === null) return;
        const member = checker.getTypeAtLocation(binding.parent).getProperty(names[0]);
        if (valueWriter(member) !== undefined) context.report({ node, messageId: 'indirect' });
      },
      AwaitExpression: checkHandOver,
      // Every read of a variable (scope analysis gives exactly the value positions).
      'Program:exit'() {
        for (const scope of context.sourceCode.scopeManager.scopes)
          for (const reference of scope.references)
            if (reference.isValueReference && reference.isRead() && !reference.isWrite())
              checkHandOver(reference.identifier);
      },
      // A style object literal anywhere (a typed constant, a component's `style` prop, a return
      // value): checked where it is written.
      ObjectExpression(node) {
        if (isCssPropertiesLiteral(node)) checkObject(node);
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const name = node.name.name;
        const tags = nativeTags(node.parent.name, services);
        const value = node.value;
        const expression =
          value === null
            ? null
            : value.type === 'JSXExpressionContainer'
              ? value.expression.type === 'JSXEmptyExpression'
                ? null
                : value.expression
              : value;
        if (tags === undefined) {
          // A component's prop: judged by where it is declared (`checkKey`).
          const props = checker.getContextualType(toTs(node).parent);
          // An open attribute (`data-*`, `aria-*`, `OPEN_ATTRIBUTES`) needs no declaration in JSX:
          // it is content handed on to the element, never a style value. Any other undeclared
          // name (`stroke-width`) is reported (P1 QA22 F3).
          const source =
            props === undefined
              ? null
              : isOpenAttribute(name) && checker.getPropertyOfType(props, name) === undefined
                ? { own: true }
                : propSource(props, name, checker);
          return checkKey(node, name, source, expression);
        }
        if (expression === null) return;
        if (name === 'style') return checkStyle(expression);
        // An SVG presentation attribute (a number is in user units, so it stays a bare number),
        // or a `width`/`height` that sizes a box.
        const prop = attributeProp(name, (tags ?? [null]).map(sizeMeaning.ofTag));
        if (prop !== undefined) judge(expression, prop, read(expression, String));
      },
    };
  },
};

/**
 * `ui/package-adapter` (E12): a package that writes the page from the values it is handed is
 * imported only by its adapter (`PACKAGES` adapters), judged by the import's syntax alone: a
 * static import, a dynamic `import()`, a re-export. The adapter's own exports name no package
 * binding (`exposes`), judged by syntax at the export: the type annotations it writes (a
 * variable's, a function's parameters and return, a class's public members, a type or
 * interface), and a variable's initializer that is the package's binding itself (directly, or
 * as an object or array literal's entry). Values handed on through other code (a callback, a
 * generic, a global slot) are review's and the P2 screenshots' (plan §4 P1, the lint boundary).
 */
const packageAdapter = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Third-party packages that write the page only through their adapter (UI gate E12).',
    },
    // `packages`: the registration to judge by (tests); the gate uses `PACKAGES`.
    schema: [
      {
        type: 'object',
        properties: { packages: { type: 'object' } },
        additionalProperties: false,
      },
    ],
    messages: {
      adapter:
        '`{{specifier}}` writes the page from the values it is handed, so only its adapter `{{adapter}}` imports it: use that module, or add what you need to it (UI gate E12, scripts/ui-lint/registry.mjs PACKAGES adapters).',
      none: '`{{specifier}}` writes the page from the values it is handed and has no adapter yet: this import is debt until one module of ours is registered as its adapter and the others use it (UI gate E12, scripts/ui-lint/registry.mjs PACKAGES adapters).',
      reexport:
        'The adapter re-exports `{{specifier}}`, handing the package on past it: export functions or components of ours that take our own types instead (UI gate E12).',
      exposes:
        "`{{name}}` is exported and its declaration names `{{binding}}` of `{{specifier}}`, so other modules reach the package through the adapter's exports: export functions, components and types of ours that take our own types (token names, registered runtime values) instead (UI gate E12).",
    },
  },
  create(context) {
    const file = fileKey(context, context.filename);
    const packages = context.options[0]?.packages ?? PACKAGES;
    // Local names this adapter binds to its registered entries (`import type` included): the
    // names its exports may not write.
    const bindings = new Map();
    const exported = [];
    // The package's adapter rule for a written specifier; a non-literal or relative specifier is
    // the bundle graph's.
    const ruleOf = (source) => {
      const specifier =
        source?.type === 'Literal' && typeof source.value === 'string'
          ? source.value
          : source?.type === 'TemplateLiteral' && source.expressions.length === 0
            ? source.quasis[0].value.cooked
            : undefined;
      if (specifier === undefined || specifier.startsWith('.') || specifier.startsWith('/'))
        return undefined;
      const rule = adapterOf(specifier, packages);
      return rule === undefined ? undefined : { ...rule, specifier };
    };
    const judge = (node, source, reexport) => {
      const rule = ruleOf(source);
      if (rule === undefined) return;
      const { specifier, adapter } = rule;
      if (adapter !== file)
        return context.report({
          node,
          messageId: adapter === null ? 'none' : 'adapter',
          data: { specifier, adapter },
        });
      if (reexport) return context.report({ node, messageId: 'reexport', data: { specifier } });
    };
    /** Every package binding named in a type annotation's subtree (type positions only). */
    const named = (node, out) => {
      if (node === null || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        for (const child of node) named(child, out);
        return out;
      }
      if (typeof node.type !== 'string') return out;
      // A function's or method's body is not its signature.
      for (const [key, child] of Object.entries(node)) {
        if (key === 'parent' || key === 'value' || key === 'init') continue;
        if (
          key === 'body' &&
          (FUNCTION_TYPES.has(node.type) || node.type === 'FunctionDeclaration')
        )
          continue;
        if (key === 'right' && node.type === 'TSQualifiedName') continue;
        if (key === 'key' && !node.computed) continue;
        named(child, out);
      }
      if (node.type === 'Identifier' && bindings.has(node.name)) out.push(node);
      return out;
    };
    /** The package binding an initializer is: itself, or an object or array literal's entry. */
    const held = (node, out) => {
      if (node === null || node === undefined) return out;
      if (TRANSPARENT_TS.has(node.type)) return held(node.expression, out);
      if (node.type === 'ArrayExpression') for (const element of node.elements) held(element, out);
      else if (node.type === 'ObjectExpression')
        for (const property of node.properties)
          held(property.type === 'Property' ? property.value : property.argument, out);
      else if (node.type === 'SpreadElement') held(node.argument, out);
      else if (node.type === 'MemberExpression' && !node.computed) held(node.object, out);
      else if (node.type === 'Identifier' && bindings.has(node.name)) out.push(node);
      else if (FUNCTION_TYPES.has(node.type))
        named([node.params, node.returnType, node.typeParameters], out);
      return out;
    };
    /** The binding names a declaration exports, and the nodes its exported signature writes. */
    const signature = (declaration) => {
      switch (declaration.type) {
        case 'VariableDeclaration':
          return declaration.declarations.flatMap((declarator) => [
            ...named(declarator.id.typeAnnotation, []),
            ...held(declarator.init, []),
          ]);
        case 'FunctionDeclaration':
        case 'TSDeclareFunction':
          return named(
            [declaration.params, declaration.returnType, declaration.typeParameters],
            [],
          );
        case 'ClassDeclaration':
          return named(
            [
              declaration.typeParameters,
              declaration.superClass,
              declaration.implements,
              declaration.body.body
                .filter(
                  (member) =>
                    member.accessibility !== 'private' && member.key?.type !== 'PrivateIdentifier',
                )
                .map((member) =>
                  member.type === 'MethodDefinition' || member.type === 'TSAbstractMethodDefinition'
                    ? [member.value.params, member.value.returnType]
                    : [member.typeAnnotation, member.parameter],
                ),
            ],
            [],
          ).concat(declaration.superClass ? held(declaration.superClass, []) : []);
        case 'TSTypeAliasDeclaration':
        case 'TSInterfaceDeclaration':
        case 'TSEnumDeclaration':
        case 'TSModuleDeclaration':
          return named(declaration, []);
        default:
          return held(declaration, []);
      }
    };
    return {
      ImportDeclaration(node) {
        const rule = ruleOf(node.source);
        if (rule?.adapter === file)
          for (const specifier of node.specifiers)
            bindings.set(specifier.local.name, rule.specifier);
        if (node.importKind !== 'type') judge(node, node.source, false);
      },
      ExportNamedDeclaration(node) {
        if (node.source !== null) {
          if (node.exportKind !== 'type') judge(node, node.source, true);
          return;
        }
        if (node.declaration !== null) exported.push({ node: node.declaration, name: null });
        for (const specifier of node.specifiers)
          exported.push({
            node: specifier.local,
            name: specifier.exported.name ?? specifier.exported.value,
          });
      },
      ExportDefaultDeclaration(node) {
        exported.push({ node: node.declaration, name: 'default' });
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== 'type') judge(node, node.source, true);
      },
      ImportExpression(node) {
        judge(node, node.source, false);
      },
      TSImportEqualsDeclaration(node) {
        if (node.importKind !== 'type' && node.moduleReference.type === 'TSExternalModuleReference')
          judge(node, node.moduleReference.expression, false);
      },
      'Program:exit'(program) {
        if (bindings.size === 0) return;
        // `export { x }` exports the top-level declaration named `x`: judged as that declaration.
        const declared = new Map();
        for (const statement of program.body) {
          const own = statement.type.startsWith('Export') ? statement.declaration : statement;
          if (own == null) continue;
          if (own.type === 'VariableDeclaration')
            for (const declarator of own.declarations)
              if (declarator.id.type === 'Identifier') declared.set(declarator.id.name, own);
          if (own.id?.type === 'Identifier') declared.set(own.id.name, own);
        }
        for (const { node, name } of exported) {
          const declaration =
            node.type === 'Identifier' && !bindings.has(node.name) ? declared.get(node.name) : node;
          if (declaration === undefined)
            throw new Error(
              `ui-gate E12: ${file}: \`export { ${node.name} }\` names no top-level declaration`,
            );
          const exportName = name ?? exportedName(declaration);
          for (const binding of signature(declaration))
            context.report({
              node: binding,
              messageId: 'exposes',
              data: {
                name: exportName,
                binding: binding.name,
                specifier: bindings.get(binding.name),
              },
            });
        }
      },
    };
  },
};

/** The name a declaration is exported under (its own, or the variables it declares). */
function exportedName(declaration) {
  if (declaration.type === 'VariableDeclaration')
    return declaration.declarations.map((declarator) => declarator.id.name ?? '…').join(', ');
  return declaration.id?.name ?? 'default';
}

const FUNCTION_TYPES = new Set(['ArrowFunctionExpression', 'FunctionExpression']);

/** Type syntax an expression passes through unchanged. */
const TRANSPARENT_TS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression']);

export default {
  meta: { name: 'ui-gate' },
  rules: {
    'dom-allowlist': domAllowlist,
    'element-allowlist': elementAllowlist,
    'inline-style-keys': inlineStyleKeys,
    'package-adapter': packageAdapter,
  },
};
