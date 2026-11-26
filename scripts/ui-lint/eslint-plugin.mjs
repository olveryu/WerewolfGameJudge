/**
 * Local ESLint rules for the web client's UI gate (rule IDs refer to the UI drift lock plan).
 *
 * - `ui/no-style-elements` (E5, first part): no stylesheet enters the page from code. A call is
 *   judged by what the type checker resolves it to, not by how it is spelled: DOM
 *   `createElement`/`createElementNS` and React `createElement`/`jsx*` — through aliases, `bind`,
 *   computed members or `call` — may not create `<style>`/`<link>`, and a tag the checker cannot
 *   enumerate is rejected too. Any call returning a style or link element is rejected, and the
 *   HTML sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`,
 *   `createContextualFragment`, `parseFromString`, `setHTMLUnsafe`) are closed, since markup can
 *   carry a `<style>`.
 * - `ui/inline-style-static-keys` (E4, first part): the properties an inline style writes are
 *   enumerable from the source. Every object literal typed as `CSSProperties` — written inline,
 *   spread, behind `satisfies`, a conditional, a typed variable or a `createElement` prop — uses
 *   static keys or keys whose type is a union of string literals, and a value reaching `style`
 *   may not have an index signature (`Object.fromEntries`, `Record<string, …>`).
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
const HTML_SINK_PROPERTIES = new Set(['innerHTML', 'outerHTML']);
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
    function checkTag(node) {
      if (node === undefined || node.type === 'SpreadElement') return false;
      const names = possibleStrings(node, services);
      if (names === undefined) return false;
      if (names === null) {
        context.report({ node, messageId: 'dynamic' });
        return true;
      }
      const banned = names.filter((tag) => BANNED_TAGS.has(tag.toLowerCase()));
      for (const tag of banned) context.report({ node, messageId: 'element', data: { tag } });
      return banned.length > 0;
    }

    return {
      JSXOpeningElement(node) {
        // Intrinsic JSX tags are lowercase; `<Link>` is a component.
        if (node.name.type === 'JSXIdentifier' && BANNED_TAGS.has(node.name.name)) {
          context.report({ node, messageId: 'element', data: { tag: node.name.name } });
        }
      },
      CallExpression(node) {
        const { name, fromDom } = resolvedCallee(node, services, checker);
        const callee =
          node.callee.type === 'ChainExpression' ? node.callee.expression : node.callee;
        const member = memberName(callee);
        let reported = false;
        if (name === 'call' || name === 'apply') {
          // fn.call(thisArg, …args) / fn.apply(thisArg, args) on an element factory.
          const target = callee.type === 'MemberExpression' ? callee.object : undefined;
          const targetType = target && services.getTypeAtLocation(target);
          const factory = targetType
            ?.getCallSignatures()
            .map((signature) => signature.getDeclaration())
            .map((declaration) => declaration && ts.getNameOfDeclaration(declaration))
            .find((id) => id && ts.isIdentifier(id) && ELEMENT_FACTORIES.has(id.text));
          if (factory) {
            if (name === 'apply') {
              context.report({ node, messageId: 'dynamic' });
              reported = true;
            } else {
              reported = checkTag(node.arguments[ELEMENT_FACTORIES.get(factory.text) + 1]);
            }
          }
        } else if (name !== undefined && ELEMENT_FACTORIES.has(name)) {
          reported = checkTag(node.arguments[ELEMENT_FACTORIES.get(name)]);
        } else if (member !== undefined && ELEMENT_FACTORIES.has(member)) {
          reported = checkTag(node.arguments[ELEMENT_FACTORIES.get(member)]);
        }
        if (htmlSinks && fromDom && HTML_SINK_METHODS.has(name)) {
          context.report({ node, messageId: 'sink', data: { name } });
        }
        if (reported) return;
        // Backstop for any other route to a style or link element.
        const returned = services.getTypeAtLocation(node);
        const banned = typeNames(returned).find((typeName) => BANNED_ELEMENT_TYPES.has(typeName));
        if (banned) context.report({ node, messageId: 'element', data: { tag: banned } });
      },
      AssignmentExpression(node) {
        const name = memberName(node.left);
        if (htmlSinks && name !== undefined && HTML_SINK_PROPERTIES.has(name)) {
          context.report({ node, messageId: 'sink', data: { name } });
        }
      },
    };
  },
};

function isCssProperties(type) {
  return typeNames(type).includes('CSSProperties');
}

/**
 * True when an object type (or a union/intersection member) has a plain `string` index signature.
 * Pattern signatures such as `[key: \`--${string}\`]` (the web client's custom-property
 * augmentation of CSSProperties) still name a property family, so they pass.
 */
function hasIndexSignature(type, checker) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  return parts.some(
    (part) =>
      part.flags & ts.TypeFlags.Object &&
      checker
        .getIndexInfosOfType(part)
        .some((info) => info.keyType.flags & (ts.TypeFlags.String | ts.TypeFlags.Number)),
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
