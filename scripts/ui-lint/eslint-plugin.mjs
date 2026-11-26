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
 *   `createContextualFragment`, `parseFromString` and `setHTMLUnsafe`.
 * - `ui/inline-style-static-keys` (E4, first part): the properties an inline style writes are
 *   enumerable from the source. Every object literal typed as `CSSProperties` — written inline,
 *   spread, behind `satisfies`, a conditional, a typed variable or a `createElement` prop — uses
 *   static keys or keys whose type is a union of string literals, and a value reaching `style`
 *   may not have an index signature (`Object.fromEntries`, `Record<string, …>`, or a pattern key
 *   such as `` `border${string}` ``). The one index signature allowed is exactly
 *   `` `--${string}` ``: custom properties, the web client's augmentation of CSSProperties.
 */

import ts from 'typescript';

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
const UNENUMERABLE = ts.TypeFlags.StringLike | ts.TypeFlags.Any | ts.TypeFlags.Unknown;

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

/**
 * The function a call resolves to (through aliases, bind, members): its declared name, and
 * whether TypeScript's DOM library declares it.
 */
function resolvedCallee(call, services, checker) {
  const tsNode = services.esTreeNodeToTSNodeMap.get(call);
  const declaration = checker.getResolvedSignature(tsNode)?.getDeclaration();
  const id = declaration && ts.getNameOfDeclaration(declaration);
  return {
    name: id && ts.isIdentifier(id) ? id.text : undefined,
    fromDom:
      declaration !== undefined && /lib\.dom\.d\.ts$/.test(declaration.getSourceFile().fileName),
  };
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
        properties: { htmlSinks: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      element:
        '<{{tag}}> elements are not created from code; styles live in bundled CSS (UI gate E5).',
      dynamic:
        'The element tag here cannot be proven not to be <style>/<link>; use a literal tag (UI gate E5).',
      sink: '{{name}} writes markup, which can carry a stylesheet; render through React (UI gate E5).',
    },
  },
  create(context) {
    const { services, checker } = typedServices(context);
    const htmlSinks = context.options[0]?.htmlSinks ?? true;

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

    /** The element factory a function value resolves to (by its call signatures), if any. */
    function factoryOf(target) {
      if (target === undefined || target.type === 'SpreadElement') return undefined;
      const type = services.getTypeAtLocation(target);
      if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return null;
      const id = type
        .getCallSignatures()
        .map((signature) => signature.getDeclaration())
        .map((declaration) => declaration && ts.getNameOfDeclaration(declaration))
        .find((name) => name && ts.isIdentifier(name) && ELEMENT_FACTORIES.has(name.text));
      return id?.text;
    }

    /** `fn.apply(this, args)` / `Reflect.apply(fn, this, args)`: the tag sits inside `args`. */
    function checkArgumentList(call, factory, list) {
      if (list?.type !== 'ArrayExpression') {
        context.report({ node: call, messageId: 'dynamic' });
        return true;
      }
      return checkTag(tagArgument(list.elements, ELEMENT_FACTORIES.get(factory)), call);
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

    function hasSinkProperty(node) {
      const type = services.getTypeAtLocation(node);
      return ['innerHTML', 'outerHTML'].some((name) => type.getProperty(name) !== undefined);
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
        const { name, fromDom } = resolvedCallee(node, services, checker);
        const callee =
          node.callee.type === 'ChainExpression' ? node.callee.expression : node.callee;
        const member = memberName(callee);
        const reflect =
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Reflect';
        let reported = false;
        if (reflect && (member === 'apply' || member === 'construct')) {
          // Reflect.apply(fn, thisArg, args) / Reflect.construct(fn, args).
          const factory = factoryOf(node.arguments[0]);
          if (factory === null) {
            context.report({ node, messageId: 'dynamic' });
            reported = true;
          } else if (factory !== undefined) {
            reported = checkArgumentList(node, factory, node.arguments[member === 'apply' ? 2 : 1]);
          }
        } else if (name === 'call' || name === 'apply') {
          // fn.call(thisArg, …args) / fn.apply(thisArg, args) on an element factory.
          const factory = callee.type === 'MemberExpression' ? factoryOf(callee.object) : undefined;
          if (factory) {
            reported =
              name === 'apply'
                ? checkArgumentList(node, factory, node.arguments[1])
                : checkTag(tagArgument(node.arguments, ELEMENT_FACTORIES.get(factory) + 1), node);
          }
        } else if (name !== undefined && ELEMENT_FACTORIES.has(name)) {
          reported = checkTag(tagArgument(node.arguments, ELEMENT_FACTORIES.get(name)), node);
        } else if (member !== undefined && ELEMENT_FACTORIES.has(member)) {
          reported = checkTag(tagArgument(node.arguments, ELEMENT_FACTORIES.get(member)), node);
        }
        if (fromDom && HTML_SINK_METHODS.has(name)) reportSink(node, name);
        // Reflect.set(el, 'innerHTML', …) / Object.defineProperty(el, key, …) on a DOM node.
        if (
          (reflect && member === 'set') ||
          (callee.type === 'MemberExpression' &&
            callee.object.type === 'Identifier' &&
            callee.object.name === 'Object' &&
            member === 'defineProperty')
        ) {
          const [target, key] = node.arguments;
          if (target && key && key.type !== 'SpreadElement' && hasSinkProperty(target)) {
            const sink = sinkKey(key);
            if (sink !== undefined) reportSink(node, sink ?? 'a computed key');
          }
        }
        // Object.assign(el, source): a source that has, or may have, innerHTML/outerHTML.
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Object' &&
          member === 'assign' &&
          node.arguments[0] &&
          node.arguments[0].type !== 'SpreadElement' &&
          hasSinkProperty(node.arguments[0])
        ) {
          for (const source of node.arguments.slice(1)) {
            const value = source.type === 'SpreadElement' ? source.argument : source;
            if (value.type === 'ObjectExpression') continue; // its keys are checked by Property
            const type = services.getTypeAtLocation(value);
            if (hasSinkProperty(value) || hasIndexSignature(type, checker)) {
              reportSink(source, 'Object.assign');
            }
          }
        }
        if (reported) return;
        // Backstop for any other route to a style or link element.
        const returned = services.getTypeAtLocation(node);
        const banned = typeNames(returned).find((typeName) => BANNED_ELEMENT_TYPES.has(typeName));
        if (banned) context.report({ node, messageId: 'element', data: { tag: banned } });
      },
      // { innerHTML: … } anywhere (Object.assign, defineProperties, props objects).
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') return;
        const key =
          !node.computed && node.key.type === 'Identifier'
            ? node.key.name
            : node.key.type === 'Literal' && typeof node.key.value === 'string'
              ? node.key.value
              : undefined;
        if (key !== undefined && HTML_SINK_PROPERTIES.has(key)) reportSink(node, key);
        else if (node.computed && key === undefined) {
          const sink = possibleStrings(node.key, services)?.find?.((n) =>
            HTML_SINK_PROPERTIES.has(n),
          );
          if (sink) reportSink(node, sink);
        }
      },
      AssignmentExpression(node) {
        const left = node.left;
        if (left.type !== 'MemberExpression') return;
        const name = memberName(left);
        if (name !== undefined) {
          if (HTML_SINK_PROPERTIES.has(name)) reportSink(node, name);
          return;
        }
        // el[key] = …: a key that can be, or cannot be shown not to be, innerHTML/outerHTML.
        if (left.computed && hasSinkProperty(left.object)) {
          const sink = sinkKey(left.property);
          if (sink !== undefined) reportSink(node, sink ?? 'a computed key');
        }
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
      // createElement(tag, { style: … }) and other props objects.
      Property(node) {
        if (node.computed || node.key.type !== 'Identifier' || node.key.name !== 'style') return;
        if (node.parent.type !== 'ObjectExpression') return;
        checkStyleValue(node.value);
      },
    };
  },
};

export default {
  meta: { name: 'ui-lint' },
  rules: {
    'no-style-elements': noStyleElements,
    'inline-style-static-keys': inlineStyleStaticKeys,
  },
};
