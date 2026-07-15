import ts from 'typescript';

function scriptKindFor(filePath: string): ts.ScriptKind {
  return filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function stringLiteralText(node: ts.Node | undefined): string | null {
  return node !== undefined && ts.isStringLiteralLike(node) ? node.text : null;
}

function isCommonJsModuleLoader(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) return expression.text === 'require';
  if (!ts.isPropertyAccessExpression(expression)) return false;

  return (
    (ts.isIdentifier(expression.expression) &&
      expression.expression.text === 'require' &&
      expression.name.text === 'resolve') ||
    (ts.isIdentifier(expression.expression) &&
      expression.expression.text === 'module' &&
      expression.name.text === 'require')
  );
}

function requireLiteralModulePath(filePath: string, node: ts.Node | undefined): string {
  const modulePath = stringLiteralText(node);
  if (modulePath !== null) return modulePath;

  throw new Error(`[FAIL-FAST] ${filePath} contains a non-literal module path`);
}

/** Parse every statically knowable TypeScript module dependency in source order. */
export function getModuleSpecifiers(filePath: string, source: string): readonly string[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  );
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier !== undefined) {
        specifiers.push(requireLiteralModulePath(filePath, node.moduleSpecifier));
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (ts.isExternalModuleReference(node.moduleReference)) {
        specifiers.push(requireLiteralModulePath(filePath, node.moduleReference.expression));
      }
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (!ts.isLiteralTypeNode(argument)) {
        throw new Error(`[FAIL-FAST] ${filePath} contains a non-literal import type`);
      }
      specifiers.push(requireLiteralModulePath(filePath, argument.literal));
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        isCommonJsModuleLoader(node.expression))
    ) {
      specifiers.push(requireLiteralModulePath(filePath, node.arguments[0]));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}
