/**
 * Local ESLint rules for the web client's UI gate (rule IDs refer to the UI drift lock plan).
 *
 * - `ui/no-style-elements` (E5, first part): no stylesheet enters the page from code. A call is
 *   judged by what the type checker resolves it to, not by how it is spelled: DOM
 *   `createElement`/`createElementNS` and React `createElement`/`jsx*` — through aliases, `bind`,
 *   computed members, `call`, `apply` or `Reflect.apply` — may not create `<style>`/`<link>`; a
 *   tag the checker cannot enumerate (a wide string, a spread argument, an argument list it
 *   cannot read) is rejected too, and so is a JSX tag held in a variable whose type is a string.
 *   Any call returning a style or link element is rejected, and the HTML sinks are closed, since
 *   markup can carry a `<style>`: `innerHTML`/`outerHTML` however they are written (assignment,
 *   computed key, `Object.assign`, `Reflect.set`, `Object.defineProperty`, an object literal
 *   key), `dangerouslySetInnerHTML`, and the DOM methods `insertAdjacentHTML`, `document.write`,
 *   `createContextualFragment`, `parseFromString` and `setHTMLUnsafe` — called directly or through
 *   `call`, `apply` or `Reflect.apply` — and the descriptor of a sink property
 *   (`getOwnPropertyDescriptor`, `__lookupSetter__`), whose setter writes markup. Writes through a
 *   target whose type cannot rule a DOM node out (`object`, `{}`, `any`, `unknown`, a type
 *   parameter) count as writes to a node. React DOM's resource APIs `preinit`/`preload` (which
 *   insert `<link rel=stylesheet>`) are rejected outright, and build code may not describe a
 *   `{ tag: 'style' }` HTML tag (Vite's `transformIndexHtml`). P1 QA3 H6: one resolution of the
 *   invoked function serves the element factories, the sink methods and the resource APIs.
 * - `ui/import-scope`: module specifiers stay inside what the gate checks. A stylesheet import
 *   resolves to a `.css` file in the web source (no package CSS, no file outside it, no query
 *   such as `?inline`); production code imports no test module (`*.test.*`, `__tests__/`), where
 *   the HTML sinks are open; `import.meta.glob` patterns name one asset extension, never scripts
 *   or styles; a dynamic `import()` takes a literal specifier (P1 QA3 H1/H8).
 * - `ui/inline-style-static-keys` (E4, first part): the properties an inline style writes are
 *   enumerable from the source. Every object literal typed as `CSSProperties` — written inline,
 *   spread, behind `satisfies`, a conditional, a typed variable or a `createElement` prop — uses
 *   static keys or keys whose type is a union of string literals, and a value reaching `style`
 *   may not have an index signature (`Object.fromEntries`, `Record<string, …>`, or a pattern key
 *   such as `` `border${string}` ``). The one index signature allowed is exactly
 *   `` `--${string}` ``: custom properties, the web client's augmentation of CSSProperties.
 */

import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { inCssGate, isTestModule, WEB_PACKAGE, WEB_SOURCE } from './scope.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

const ELEMENT_FACTORIES = new Map([
  // name → index of the tag argument
  ['createElement', 0],
  ['createElementNS', 1],
  ['jsx', 0],
  ['jsxs', 0],
  ['jsxDEV', 0],
]);
const BANNED_TAGS = new Set(['style', 'link']);
const BANNED_ELEMENT_TYPES = new Set(['HTMLStyleElement', 'HTMLLinkElement', 'SVGStyleElement']);
const HTML_SINK_PROPERTIES = new Set(['innerHTML', 'outerHTML', 'dangerouslySetInnerHTML']);
const HTML_SINK_METHODS = new Set([
  'insertAdjacentHTML',
  'write',
  'writeln',
  'createContextualFragment',
  'parseFromString',
  'setHTMLUnsafe',
]);
const DESCRIPTOR_READERS = new Set(['__lookupSetter__', '__lookupGetter__', '__defineSetter__']);
/** React DOM resource APIs: `preinit(href, { as: 'style' })` inserts a stylesheet link. */
const REACT_DOM_RESOURCES = new Set(['preinit', 'preload']);
const UNENUMERABLE = ts.TypeFlags.StringLike | ts.TypeFlags.Any | ts.TypeFlags.Unknown;
const WIDE_TARGET =
  ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.NonPrimitive | ts.TypeFlags.TypeParameter;

function typedServices(context) {
  const services = context.sourceCode.parserServices;
  if (services?.program == null) {
    throw new Error(`${context.id} needs type information (parserOptions.projectService).`);
  }
  return { services, checker: services.program.getTypeChecker() };
}

function memberName(node) {
  if (node.type !== 'MemberExpression') return undefined;
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.property.type === 'Literal' && typeof node.property.value === 'string')
    return node.property.value;
  return undefined;
}

/**
 * The string values `node` can take, `undefined` when it is not a string at all (a component
 * reference), or `null` for a string the checker cannot enumerate.
 */
function possibleStrings(node, services) {
  if (node.type === 'Literal') return typeof node.value === 'string' ? [node.value] : undefined;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    return [node.quasis.map((quasi) => quasi.value.cooked).join('')];
  const type = services.getTypeAtLocation(node);
  const parts = type.isUnion() ? type.types : [type];
  const names = [];
  for (const part of parts) {
    if (part.isStringLiteral()) {
      names.push(part.value);
      continue;
    }
    const pieces = part.isIntersection() ? part.types : [part];
    if (pieces.some((piece) => piece.flags & UNENUMERABLE)) return null;
  }
  return names.length > 0 ? names : undefined;
}

/** What a function declaration is: its name, and whether the DOM library or React DOM declares it. */
function describeDeclaration(declaration) {
  const id = declaration && ts.getNameOfDeclaration(declaration);
  const fileName = declaration?.getSourceFile().fileName ?? '';
  return {
    name: id && ts.isIdentifier(id) ? id.text : undefined,
    fromDom: /lib\.dom\.d\.ts$/.test(fileName),
    fromReactDom: /[\\/]@types[\\/]react-dom[\\/]/.test(fileName),
    fromLib: /[\\/]typescript[\\/]lib[\\/]lib\.[^\\/]*\.d\.ts$/.test(fileName),
  };
}

/** The function a call resolves to (through aliases, bind, members). */
function resolvedCallee(call, services, checker) {
  const tsNode = services.esTreeNodeToTSNodeMap.get(call);
  return describeDeclaration(checker.getResolvedSignature(tsNode)?.getDeclaration());
}

/** The functions a value can be, by its call signatures; `null` when its type is any/unknown. */
function functionsOf(node, services) {
  if (node === undefined || node.type === 'SpreadElement') return null;
  const type = services.getTypeAtLocation(node);
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return null;
  return type
    .getCallSignatures()
    .map((signature) => describeDeclaration(signature.getDeclaration()));
}

/** Name of the type or of any union/intersection member, via its symbol or alias. */
function typeNames(type) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  return parts.flatMap((part) =>
    [part.aliasSymbol?.getName(), part.getSymbol()?.getName()].filter(Boolean),
  );
}

const noStyleElements = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow creating stylesheets from code (UI gate E5).' },
    schema: [
      {
        type: 'object',
        properties: { htmlSinks: { type: 'boolean' }, htmlTagDescriptors: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      element:
        '<{{tag}}> elements are not created from code; styles live in bundled CSS (UI gate E5).',
      dynamic:
        'The element tag here cannot be proven not to be <style>/<link>; use a literal tag (UI gate E5).',
      sink: '{{name}} writes markup, which can carry a stylesheet; render through React (UI gate E5).',
      resource:
        'react-dom {{name}}() can insert a stylesheet link; styles live in bundled CSS (UI gate E5).',
    },
  },
  create(context) {
    const { services, checker } = typedServices(context);
    const htmlSinks = context.options[0]?.htmlSinks ?? true;
    // Build code (Vite plugins) describes injected HTML tags as { tag, attrs, children }.
    const htmlTagDescriptors = context.options[0]?.htmlTagDescriptors ?? false;

    /** Reports a banned or unenumerable tag; returns whether it reported. */
    function checkTag(node, reportNode = node) {
      if (node === undefined) return false;
      if (node.type === 'SpreadElement') {
        context.report({ node: reportNode, messageId: 'dynamic' });
        return true;
      }
      const names = possibleStrings(node, services);
      if (names === undefined) return false;
      if (names === null) {
        context.report({ node: reportNode, messageId: 'dynamic' });
        return true;
      }
      const banned = names.filter((tag) => BANNED_TAGS.has(tag.toLowerCase()));
      for (const tag of banned) {
        context.report({ node: reportNode, messageId: 'element', data: { tag } });
      }
      return banned.length > 0;
    }

    /**
     * The tag argument at `index` of an argument list: a spread at or before it makes the position
     * unknowable, so the spread itself is returned (and reported as dynamic).
     */
    function tagArgument(args, index) {
      for (let i = 0; i <= index && i < args.length; i += 1) {
        if (args[i].type === 'SpreadElement') return args[i];
      }
      return args[index];
    }

    /** The argument list a call hands the invoked function; `null` when it cannot be read. */
    function listOf(node) {
      return node?.type === 'ArrayExpression' ? node.elements : null;
    }

    /**
     * The function a call invokes and the arguments it receives, seen through `fn.call`,
     * `fn.apply`, `Reflect.apply` and `Reflect.construct`. `functions` is `null` when the invoked
     * value's type is any/unknown, `args` is `null` when the argument list cannot be read.
     */
    function invocation(node, callee, member) {
      const reflect =
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'Reflect';
      if (reflect && (member === 'apply' || member === 'construct')) {
        const args = listOf(node.arguments[member === 'apply' ? 2 : 1]);
        return { indirect: true, functions: functionsOf(node.arguments[0], services), args };
      }
      const direct = resolvedCallee(node, services, checker);
      if (
        direct.fromLib &&
        (direct.name === 'call' || direct.name === 'apply') &&
        callee.type === 'MemberExpression'
      ) {
        const args = direct.name === 'call' ? node.arguments.slice(1) : listOf(node.arguments[1]);
        return { indirect: true, functions: functionsOf(callee.object, services), args };
      }
      return { indirect: false, functions: [direct], args: node.arguments };
    }

    function reportSink(node, name) {
      if (htmlSinks) context.report({ node, messageId: 'sink', data: { name } });
    }

    /** Whether a key expression can name an HTML sink property; `null` when unenumerable. */
    function sinkKey(key) {
      const names = possibleStrings(key, services);
      if (names === null) return null;
      return names?.find((name) => HTML_SINK_PROPERTIES.has(name));
    }

    /**
     * Whether a write target may be a DOM node with an HTML sink: its type has innerHTML or
     * outerHTML, or is too wide to rule a node out (`object`, `{}`, any, unknown, a type parameter).
     */
    function mayHaveSink(node) {
      const type = services.getTypeAtLocation(node);
      const parts = type.isUnion() ? type.types : [type];
      return parts.some(
        (part) =>
          Boolean(part.flags & WIDE_TARGET) ||
          ['innerHTML', 'outerHTML'].some((name) => part.getProperty(name) !== undefined) ||
          (Boolean(part.flags & ts.TypeFlags.Object) &&
            part.getProperties().length === 0 &&
            checker.getIndexInfosOfType(part).length === 0 &&
            part.getCallSignatures().length === 0),
      );
    }

    /** Reports when `key` written on `target` can be a sink property (or cannot be enumerated). */
    function checkKeyedWrite(node, target, key) {
      if (!target || !key || target.type === 'SpreadElement' || key.type === 'SpreadElement')
        return;
      if (!mayHaveSink(target)) return;
      const sink = sinkKey(key);
      if (sink !== undefined) reportSink(node, sink ?? 'a computed key');
    }

    /** `Object.assign(el, …sources)` / `Object.defineProperties(el, props)`. */
    function checkPropertySources(node, sources) {
      for (const source of sources) {
        const value = source.type === 'SpreadElement' ? source.argument : source;
        if (value.type === 'ObjectExpression') {
          // Literal sink keys are reported by Property; a key it cannot enumerate is a sink here.
          for (const property of value.properties) {
            if (property.type === 'SpreadElement') checkPropertySources(node, [property.argument]);
            else if (property.computed && sinkKey(property.key) === null) {
              reportSink(property, 'a computed key');
            }
          }
          continue;
        }
        const type = services.getTypeAtLocation(value);
        if (mayHaveSink(value) || hasIndexSignature(type, checker))
          reportSink(source, 'a source object');
      }
    }

    /** Whether a value may hold the `stylesheet` link type (or cannot be read). */
    function mayBeStylesheet(node) {
      if (!node || node.type === 'SpreadElement') return true;
      const values = possibleStrings(node, services);
      if (values === undefined) return false;
      return values === null || values.some((value) => /(?:^|\s)stylesheet(?:\s|$)/i.test(value));
    }

    /** Turning an existing element (a clone, a queried node) into a stylesheet link. */
    function reportStylesheetLink(node) {
      context.report({ node, messageId: 'element', data: { tag: 'link rel="stylesheet"' } });
    }

    return {
      JSXOpeningElement(node) {
        const { name } = node;
        // Intrinsic JSX tags are lowercase identifiers; `<Link>` is a component reference.
        if (name.type === 'JSXIdentifier' && /^[a-z]/.test(name.name)) {
          if (BANNED_TAGS.has(name.name)) {
            context.report({ node, messageId: 'element', data: { tag: name.name } });
          }
          return;
        }
        // `<Tag>` with `const Tag = 'style'` compiles to jsx('style'): judge the tag's type.
        if (name.type === 'JSXIdentifier' || name.type === 'JSXMemberExpression') {
          checkTag(name, node);
        }
      },
      JSXAttribute(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'dangerouslySetInnerHTML') {
          reportSink(node, 'dangerouslySetInnerHTML');
        }
      },
      CallExpression(node) {
        const callee =
          node.callee.type === 'ChainExpression' ? node.callee.expression : node.callee;
        const member = memberName(callee);
        const { indirect, functions, args } = invocation(node, callee, member);
        let reported = false;
        if (functions === null) {
          // fn.call(…) / Reflect.apply(fn, …) with an any/unknown fn: the function is unknown.
          context.report({ node, messageId: 'dynamic' });
          reported = true;
        } else {
          const names = functions.map((fn) => fn.name);
          if (!indirect && member !== undefined) names.push(member);
          const factory = names.find((fnName) => ELEMENT_FACTORIES.has(fnName));
          if (factory !== undefined) {
            if (args === null) {
              context.report({ node, messageId: 'dynamic' });
              reported = true;
            } else {
              reported = checkTag(tagArgument(args, ELEMENT_FACTORIES.get(factory)), node);
            }
          }
          for (const fn of functions) {
            if (fn.fromDom && HTML_SINK_METHODS.has(fn.name)) reportSink(node, fn.name);
            if (fn.fromReactDom && REACT_DOM_RESOURCES.has(fn.name)) {
              context.report({ node, messageId: 'resource', data: { name: fn.name } });
              reported = true;
            }
          }
        }
        const objectCall = (owner) =>
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === owner;
        const [first, second] = node.arguments;
        // Reflect.set(el, 'innerHTML', …) / Object.defineProperty(el, key, …).
        if (
          (objectCall('Reflect') && member === 'set') ||
          (objectCall('Object') && member === 'defineProperty')
        ) {
          checkKeyedWrite(node, first, second);
        }
        // A sink property's descriptor: its setter writes markup.
        if (
          (objectCall('Object') || objectCall('Reflect')) &&
          member === 'getOwnPropertyDescriptor'
        ) {
          checkKeyedWrite(node, first, second);
        }
        if (
          objectCall('Object') &&
          member === 'getOwnPropertyDescriptors' &&
          first &&
          mayHaveSink(first)
        ) {
          reportSink(node, 'getOwnPropertyDescriptors');
        }
        // x.__lookupSetter__('innerHTML'): whatever x is typed as, the key decides.
        if (DESCRIPTOR_READERS.has(member) && first && first.type !== 'SpreadElement') {
          const sink = sinkKey(first);
          if (sink !== undefined) reportSink(node, sink ?? 'a computed key');
        }
        if (
          objectCall('Object') &&
          (member === 'assign' || member === 'defineProperties') &&
          first &&
          first.type !== 'SpreadElement' &&
          mayHaveSink(first)
        ) {
          checkPropertySources(node, node.arguments.slice(1));
        }
        // el.setAttribute('rel', 'stylesheet') / el.relList.add('stylesheet'): an existing element
        // (a clone of a <link>, a queried node) becomes a stylesheet link (P1 QA3 H6 a7).
        if (member === 'setAttribute' || member === 'setAttributeNS') {
          const [nameArg, valueArg] =
            member === 'setAttribute' ? [first, second] : node.arguments.slice(1);
          const names =
            nameArg && nameArg.type !== 'SpreadElement' ? possibleStrings(nameArg, services) : null;
          const rel = names === null || names?.some((attr) => attr.toLowerCase() === 'rel');
          if (rel && mayBeStylesheet(valueArg)) {
            reportStylesheetLink(node);
            reported = true;
          }
        }
        if (
          ['add', 'replace', 'toggle'].includes(member) &&
          callee.type === 'MemberExpression' &&
          memberName(callee.object) === 'relList' &&
          node.arguments.some((arg) => mayBeStylesheet(arg))
        ) {
          reportStylesheetLink(node);
          reported = true;
        }
        if (reported) return;
        // Backstop for any other route to a style or link element.
        const returned = services.getTypeAtLocation(node);
        const banned = typeNames(returned).find((typeName) => BANNED_ELEMENT_TYPES.has(typeName));
        if (banned) context.report({ node, messageId: 'element', data: { tag: banned } });
      },
      // { innerHTML: … } anywhere (Object.assign, defineProperties, props objects), and a Vite
      // HTML tag descriptor { tag: 'style' } in build code.
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') return;
        const key =
          !node.computed && node.key.type === 'Identifier'
            ? [node.key.name]
            : possibleStrings(node.key, services);
        const sink = key?.find?.((name) => HTML_SINK_PROPERTIES.has(name));
        if (sink) reportSink(node, sink);
        if (
          htmlTagDescriptors &&
          key?.includes?.('tag') &&
          node.value.type !== 'AssignmentPattern'
        ) {
          checkTag(node.value, node);
        }
      },
      AssignmentExpression(node) {
        const left = node.left;
        if (left.type !== 'MemberExpression') return;
        const name = memberName(left);
        if (name !== undefined) {
          if (HTML_SINK_PROPERTIES.has(name)) reportSink(node, name);
          if (name === 'rel' && mayBeStylesheet(node.right)) reportStylesheetLink(node);
          if (
            name === 'value' &&
            memberName(left.object) === 'relList' &&
            mayBeStylesheet(node.right)
          ) {
            reportStylesheetLink(node);
          }
          return;
        }
        // el[key] = …: a key that can be, or cannot be shown not to be, innerHTML/outerHTML.
        if (left.computed) checkKeyedWrite(node, left.object, left.property);
      },
    };
  },
};

function isCssProperties(type) {
  return typeNames(type).includes('CSSProperties');
}

/** True for exactly the key type `` `--${string}` `` (custom properties). */
function isCustomPropertyKey(keyType) {
  return (
    Boolean(keyType.flags & ts.TypeFlags.TemplateLiteral) &&
    keyType.texts.length === 2 &&
    keyType.texts[0] === '--' &&
    keyType.texts[1] === '' &&
    Boolean(keyType.types[0].flags & ts.TypeFlags.String)
  );
}

/**
 * True when an object type (or a union/intersection member) has an index signature other than
 * `` `--${string}` `` (the web client's custom-property augmentation of CSSProperties): a
 * `string`, `number` or pattern key (`` `border${string}` ``) leaves the written properties
 * unenumerable.
 */
function hasIndexSignature(type, checker) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  return parts.some(
    (part) =>
      part.flags & ts.TypeFlags.Object &&
      checker.getIndexInfosOfType(part).some((info) => !isCustomPropertyKey(info.keyType)),
  );
}

const inlineStyleStaticKeys = {
  meta: {
    type: 'problem',
    docs: { description: 'Require enumerable keys in inline style objects (UI gate E4).' },
    schema: [],
    messages: {
      computed:
        'Style object keys are static names or string-literal unions; this key hides which property is written (UI gate E4).',
      indexed:
        'This style value has an index signature, so the properties it writes are not enumerable (UI gate E4).',
    },
  },
  create(context) {
    const { services, checker } = typedServices(context);
    const checked = new Set();

    function dynamicKeys(object) {
      return object.properties.filter((property) => {
        if (property.type !== 'Property' || !property.computed) return false;
        const key = property.key;
        if (key.type === 'Literal' && typeof key.value === 'string') return false;
        if (key.type === 'TemplateLiteral' && key.expressions.length === 0) return false;
        return !Array.isArray(possibleStrings(key, services));
      });
    }

    function checkObject(object) {
      if (checked.has(object)) return;
      checked.add(object);
      for (const property of dynamicKeys(object)) {
        context.report({ node: property.key, messageId: 'computed' });
      }
      for (const property of object.properties) {
        if (property.type === 'SpreadElement') checkStyleValue(property.argument);
      }
    }

    /** A value that reaches `style`: literals are checked key by key, others by their type. */
    function checkStyleValue(node) {
      switch (node.type) {
        case 'ObjectExpression':
          checkObject(node);
          return;
        case 'ConditionalExpression':
          checkStyleValue(node.consequent);
          checkStyleValue(node.alternate);
          return;
        case 'LogicalExpression':
          checkStyleValue(node.left);
          checkStyleValue(node.right);
          return;
        case 'TSSatisfiesExpression':
        case 'TSAsExpression':
        case 'TSNonNullExpression':
          checkStyleValue(node.expression);
          return;
        default:
          if (hasIndexSignature(services.getTypeAtLocation(node), checker)) {
            context.report({ node, messageId: 'indexed' });
          }
      }
    }

    return {
      // Any object literal typed as CSSProperties (a typed variable, a return value, …).
      ObjectExpression(node) {
        const contextual = checker.getContextualType(services.esTreeNodeToTSNodeMap.get(node));
        if (contextual !== undefined && isCssProperties(contextual)) checkObject(node);
      },
      // <el style={…}>
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'style') return;
        if (node.value?.type !== 'JSXExpressionContainer') return;
        if (node.value.expression.type === 'JSXEmptyExpression') return;
        checkStyleValue(node.value.expression);
      },
      // createElement(tag, { style: … }) and other props objects, however the key is spelled
      // ('style', ['style'], a constant): a key that cannot be enumerated may be `style` too.
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') return;
        const names =
          !node.computed && node.key.type === 'Identifier'
            ? [node.key.name]
            : possibleStrings(node.key, services);
        if (names === null || names?.includes('style')) checkStyleValue(node.value);
      },
      // <el {...props}>: the spread object's `style` member reaches the element.
      JSXSpreadAttribute(node) {
        if (node.argument.type === 'ObjectExpression') return; // its keys are checked by Property
        const tsNode = services.esTreeNodeToTSNodeMap.get(node.argument);
        const type = services.getTypeAtLocation(node.argument);
        const style = type.getProperty('style');
        const styleType = style && checker.getTypeOfSymbolAtLocation(style, tsNode);
        if (styleType !== undefined && hasIndexSignature(styleType, checker)) {
          context.report({ node, messageId: 'indexed' });
        }
      },
    };
  },
};

/** Style languages Vite bundles (only plain `.css` is allowed). */
const STYLE_SPECIFIER = /\.(?:css|pcss|postcss|scss|sass|less|styl|stylus|sss)$/i;
const SCRIPT_OR_STYLE_EXTENSION =
  /^(?:[cm]?[jt]sx?|json|css|pcss|postcss|scss|sass|less|styl|stylus|sss|html?|vue|svelte)$/i;

/** The file a relative or `@/` specifier names (no query), or undefined for a package import. */
function specifierPath(specifier, filename) {
  const bare = specifier.replace(/[?#].*$/, '');
  if (/^\.\.?\//.test(bare)) return path.resolve(path.dirname(filename), bare);
  if (bare.startsWith('@/')) return path.join(REPO_ROOT, WEB_SOURCE, bare.slice(2));
  if (bare.startsWith('@game-judge/game-engine/')) {
    return path.join(
      REPO_ROOT,
      'packages/game-engine/src',
      bare.slice('@game-judge/game-engine/'.length),
    );
  }
  return undefined;
}

/** Repo paths an extensionless specifier may resolve to, as the bundler would try them. */
function moduleCandidates(target) {
  const file = repoRelative(target);
  if (/\.[cm]?[jt]sx?$/.test(file)) return [file];
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((suffix) => `${file}${suffix}`);
}

function repoRelative(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/');
}

const importScope = {
  meta: {
    type: 'problem',
    docs: { description: 'Keep imports inside what the UI gate checks.' },
    schema: [],
    messages: {
      style:
        'Stylesheet import {{specifier}} {{why}}; import a .css file inside {{root}}, which the CSS gate checks (UI gate).',
      test: 'Production code imports no test module ({{specifier}}): the HTML sinks are open there (UI gate E5).',
      glob: 'import.meta.glob patterns name one asset extension, never scripts or styles ({{pattern}}) (UI gate).',
      dynamic: 'import() takes a literal specifier, so what it loads is checked (UI gate).',
    },
  },
  create(context) {
    const filename = context.filename;
    const inTest = isTestModule(repoRelative(filename));

    function checkSpecifier(node, specifier) {
      const target = specifierPath(specifier, filename);
      if (STYLE_SPECIFIER.test(specifier.replace(/[?#].*$/, '')) || /\.css[?#]/i.test(specifier)) {
        let why;
        if (/[?#]/.test(specifier)) why = 'carries a query';
        else if (!specifier.toLowerCase().endsWith('.css')) why = 'is not plain .css';
        else if (target === undefined) why = 'comes from a package';
        else if (!fs.existsSync(target)) why = 'does not exist';
        else {
          if (!inCssGate(repoRelative(fs.realpathSync(target))))
            why = `resolves outside what the CSS gate lints (${WEB_PACKAGE})`;
        }
        if (why)
          context.report({ node, messageId: 'style', data: { specifier, why, root: WEB_PACKAGE } });
      }
      if (!inTest && target !== undefined && moduleCandidates(target).some(isTestModule)) {
        context.report({ node, messageId: 'test', data: { specifier } });
      }
    }

    function checkSource(source) {
      if (source == null) return;
      if (source.type === 'Literal' && typeof source.value === 'string') {
        checkSpecifier(source, source.value);
      } else if (source.type === 'TemplateLiteral' && source.expressions.length === 0) {
        checkSpecifier(source, source.quasis[0].value.cooked);
      } else {
        context.report({ node: source, messageId: 'dynamic' });
      }
    }

    function checkGlobPattern(node) {
      if (node.type === 'ArrayExpression') {
        node.elements.forEach((element) => element && checkGlobPattern(element));
        return;
      }
      const pattern =
        node.type === 'Literal' && typeof node.value === 'string'
          ? node.value
          : node.type === 'TemplateLiteral' && node.expressions.length === 0
            ? node.quasis[0].value.cooked
            : undefined;
      if (pattern?.startsWith('!')) return;
      const extension = pattern === undefined ? undefined : /\.([A-Za-z0-9]+)$/.exec(pattern)?.[1];
      if (extension === undefined || SCRIPT_OR_STYLE_EXTENSION.test(extension)) {
        context.report({
          node,
          messageId: 'glob',
          data: { pattern: pattern ?? '(not a literal)' },
        });
      }
    }

    return {
      ImportDeclaration: (node) => checkSource(node.source),
      ExportNamedDeclaration: (node) => checkSource(node.source),
      ExportAllDeclaration: (node) => checkSource(node.source),
      ImportExpression: (node) => checkSource(node.source),
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'MetaProperty' &&
          memberName(callee)?.startsWith('glob') &&
          node.arguments[0]
        ) {
          checkGlobPattern(node.arguments[0]);
        }
      },
    };
  },
};

export default {
  meta: { name: 'ui-lint' },
  rules: {
    'no-style-elements': noStyleElements,
    'inline-style-static-keys': inlineStyleStaticKeys,
    'import-scope': importScope,
  },
};
