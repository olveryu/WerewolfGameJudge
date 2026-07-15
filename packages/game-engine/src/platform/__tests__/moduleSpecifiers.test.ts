import { getModuleSpecifiers } from './moduleSpecifiers';

describe('getModuleSpecifiers', () => {
  it('collects every supported TypeScript module reference syntax', () => {
    const source = `
      import type { TypeOnly } from './type-only';
      import './side-effect';
      export { value } from './re-export';
      export type * from './type-re-export';
      import equalsImport = require('./import-equals');
      type ImportedType = import('./import-type').ImportedType;
      const dynamicImport = import('./dynamic');
      const commonJs = require('./commonjs');
      const resolved = require.resolve('./resolved');
      const moduleRequire = module.require('./module-require');
    `;

    expect(getModuleSpecifiers('fixture.ts', source)).toEqual([
      './type-only',
      './side-effect',
      './re-export',
      './type-re-export',
      './import-equals',
      './import-type',
      './dynamic',
      './commonjs',
      './resolved',
      './module-require',
    ]);
  });

  it('rejects a computed module path instead of silently skipping it', () => {
    expect(() => getModuleSpecifiers('fixture.ts', "import('./' + moduleName)")).toThrow(
      '[FAIL-FAST] fixture.ts contains a non-literal module path',
    );
  });
});
