/**
 * The avatar census follows every way a site can be written: each case below is a shape the
 * census once missed or could miss, and pins what it records for it (`?` where it cannot follow).
 */
import { join } from 'node:path';

import { avatarCensus } from './avatarCensus';

const SRC = '/src';
const AVATAR = "export function Avatar() {\n  return <span className='avatar' />;\n}\n";

/** The census of in-memory sources (paths relative to `/src`) with `Avatar` as the carrier. */
function census(files: Readonly<Record<string, string>>): Record<string, string[]> {
  const all: Record<string, string> = { 'components/avatar/Avatar.tsx': AVATAR, ...files };
  const sources = new Map(Object.entries(all).map(([file, text]) => [join(SRC, file), text]));
  const result = avatarCensus({
    srcDir: SRC,
    files: [...sources.keys()],
    read: (path) => sources.get(path),
    carriers: [{ file: join(SRC, 'components/avatar/Avatar.tsx'), name: 'Avatar' }],
    // `box`: a box drawn around an avatar; `ring`: a host with no box. Either ends a chain.
    endsChain: (names) => names.includes('box') || names.includes('ring'),
  });
  return result;
}

const IMPORT = "import { Avatar } from '@/components/avatar/Avatar';\n";

/** The census of one page file `p.tsx` with the Avatar import. */
function page(body: string): string[] | undefined {
  return census({ 'p.tsx': IMPORT + body })['p.tsx'];
}

describe('avatar census', () => {
  it('traces a site through every element out to its box', () => {
    expect(
      page(
        'export const P = () => <div className="box"><b className="stage"><Avatar /></b></div>;',
      ),
    ).toEqual(['Avatar in stage < box']);
  });

  it('records the carrier’s own classes first', () => {
    expect(
      page('export const P = () => <div className="box"><Avatar className="mine" /></div>;'),
    ).toEqual(['Avatar in own mine < box']);
  });

  describe('reads classes', () => {
    it.each([
      [
        'a template with a constant',
        "const C = 'ring';\nexport const P = () => <div className={`${C} box`}><Avatar /></div>;",
        'ring box',
      ],
      [
        'an && expression',
        'export const P = ({ on }: { on: boolean }) => <div className={on && "ring"}><Avatar /></div>;',
        'ring',
      ],
      [
        'a ternary with undefined',
        'export const P = ({ on }: { on: boolean }) => <div className={on ? "ring" : undefined}><Avatar /></div>;',
        'ring',
      ],
      [
        'a ?? fallback',
        'export const P = ({ c }: { c?: string }) => <div className={c ?? "ring"}><Avatar /></div>;',
        '? ring',
      ],
    ])('from %s', (_case, body, classes) => {
      expect(page(body)?.[0]).toBe(`Avatar in ${classes}`);
    });

    it('from a constant imported from another module, through a re-export', () => {
      const result = census({
        'classes.ts': "export const RING = 'ring';\n",
        'barrel.ts': "export { RING as THE_RING } from './classes';\n",
        'p.tsx': `${IMPORT}import { THE_RING } from './barrel';\nexport const P = () => <div className={THE_RING}><Avatar /></div>;`,
      });
      expect(result['p.tsx']).toEqual(['Avatar in ring']);
    });

    it.each([
      ['a call', "export const P = () => <div className={['ring'].join(' ')}><Avatar /></div>;"],
      [
        'a parameter',
        'export const P = ({ c }: { c: string }) => <div className={c}><Avatar /></div>;',
      ],
      [
        'a let',
        "let c = 'ring';\nc = 'x';\nexport const P = () => <div className={c}><Avatar /></div>;",
      ],
      [
        'a shadowed constant',
        "const C = 'box';\nexport function P() {\n  const C = 'ring';\n  return <div className={C}><Avatar /></div>;\n}",
      ],
      [
        'a template mixing a call',
        "export const P = () => <div className={`box ${['ring'].join('')}`}><Avatar /></div>;",
      ],
      [
        'a spread of props',
        'export const P = (props: object) => <div {...props}><Avatar /></div>;',
      ],
    ])('but not %s, which reads as ?', (_case, body) => {
      expect(page(body)?.[0]).toContain('?');
    });
  });

  describe('finds the carrier', () => {
    it('under an import alias', () => {
      expect(
        census({
          'p.tsx':
            'import { Avatar as Face } from \'@/components/avatar/Avatar\';\nexport const P = () => <div className="ring"><Face /></div>;',
        })['p.tsx'],
      ).toEqual(['Avatar in ring']);
    });

    it('through a namespace import', () => {
      expect(
        census({
          'p.tsx':
            'import * as A from \'@/components/avatar/Avatar\';\nexport const P = () => <div className="ring"><A.Avatar /></div>;',
        })['p.tsx'],
      ).toEqual(['Avatar in ring']);
    });

    it('through a barrel re-exporting it under another name', () => {
      const result = census({
        'barrel.ts': "export { Avatar as Face } from '@/components/avatar/Avatar';\n",
        'p.tsx':
          'import { Face } from \'./barrel\';\nexport const P = () => <div className="ring"><Face /></div>;',
      });
      expect(result['p.tsx']).toEqual(['Avatar in ring']);
    });

    it.each([
      [
        'createElement',
        "import { createElement } from 'react';\nexport const P = () => createElement(Avatar);",
      ],
      ['a local alias', 'const Face = Avatar;\nexport const P = () => <Face />;'],
      ['a component passed as a prop', 'export const P = () => <List item={Avatar} />;'],
    ])('used other than as a tag (%s), as referenced', (_case, body) => {
      expect(page(body)).toContain('Avatar referenced in ?');
    });
  });

  describe('follows a site', () => {
    it('through fragments, named or not', () => {
      expect(
        page(
          'import { Fragment } from \'react\';\nexport const P = () => <div className="box"><Fragment><><Avatar /></></Fragment></div>;',
        ),
      ).toEqual(['Avatar in box']);
    });

    it('through a .map callback and a render prop, which are transparent', () => {
      expect(
        page('export const P = () => <div className="ring">{[0].map(() => <Avatar />)}</div>;'),
      ).toEqual(['Avatar in ring']);
      expect(
        page(
          'export const P = () => <div className="ring"><Slot render={() => <Avatar />} /></div>;',
        ),
      ).toEqual(['Avatar in <Slot render>']);
    });

    it('passed as a prop of a self-closing component', () => {
      expect(
        page('export const P = () => <div className="ring"><Ring face={<Avatar />} /></div>;'),
      ).toEqual(['Avatar in <Ring face>']);
    });

    it('into a component that returns it, from a one-line arrow or through memo', () => {
      expect(
        page(
          'const Face = () => <Avatar />;\nexport const P = () => <div className="ring"><Face /></div>;',
        ),
      ).toEqual(['Avatar in returned by Face', 'Face in ring']);
      expect(
        page(
          'import { memo } from \'react\';\nconst Face = memo(() => <Avatar />);\nexport const P = () => <div className="ring"><Face /></div>;',
        ),
      ).toEqual(['Avatar in returned by Face', 'Face in ring']);
    });

    it('into another file rendering the returning component', () => {
      const result = census({
        'face.tsx': `${IMPORT}export function Face() {\n  return <Avatar />;\n}`,
        'p.tsx':
          'import { Face } from \'./face\';\nexport const P = () => <div className="ring"><Face /></div>;',
      });
      expect(result['p.tsx']).toEqual(['Face in ring']);
    });

    it('into the calls of a lowercase helper', () => {
      expect(
        page(
          'function face() {\n  return <Avatar />;\n}\nexport const P = () => <div className="ring">{face()}</div>;',
        ),
      ).toEqual(['Avatar in returned by face', 'face() in ring']);
    });

    it('through a const and an object property to where they are read', () => {
      expect(
        page(
          'function slot() {\n  const preview = <Avatar />;\n  return { preview };\n}\nexport const P = () => <div className="ring">{slot().preview}</div>;',
        ),
      ).toEqual([
        'Avatar in held by preview',
        'via preview in held by .preview',
        'via .preview in ring',
      ]);
    });

    it('but not out of an anonymous default export', () => {
      expect(page('export default () => <Avatar />;')).toEqual(['Avatar in returned by ?']);
    });
  });

  describe('follows a site into the component it is passed to', () => {
    it('as children', () => {
      expect(
        page(
          'function Cell({ children }: { children: React.ReactNode }) {\n  return <b className="box">{children}</b>;\n}\nexport const P = () => <Cell><Avatar /></Cell>;',
        ),
      ).toEqual(['via Cell.children in box', 'Avatar in <Cell>']);
    });

    it('as a prop read off `props`', () => {
      expect(
        page(
          'function Cell(props: { face: React.ReactNode }) {\n  return <b className="box">{props.face}</b>;\n}\nexport const P = () => <Cell face={<Avatar />} />;',
        ),
      ).toEqual(['via Cell.face in box', 'Avatar in <Cell face>']);
    });
  });

  describe('reads a spread of props', () => {
    it('as `?` when no later className overrides it', () => {
      expect(
        page('export const P = (p: object) => <div className="box" {...p}><Avatar /></div>;'),
      ).toEqual(['Avatar in box ?']);
    });

    it('as nothing when a later className overrides it', () => {
      expect(
        page('export const P = (p: object) => <div {...p} className="box"><Avatar /></div>;'),
      ).toEqual(['Avatar in box']);
    });
  });

  it('follows a carrier re-exported under another name from a .ts barrel', () => {
    const result = census({
      'barrel.ts': "export { Avatar as Face } from '@/components/avatar/Avatar';\n",
      'p.tsx':
        'import { Face } from \'./barrel\';\nexport const P = () => <b className="ring"><Face /></b>;',
    });
    expect(result['p.tsx']).toEqual(['Avatar in ring']);
  });

  it('follows a lowercase helper into the files that call it', () => {
    const result = census({
      'face.tsx': IMPORT + 'export function face() {\n  return <Avatar />;\n}\n',
      'p.tsx':
        'import { face } from \'./face\';\nexport const P = () => <b className="ring">{face()}</b>;',
    });
    expect(result['face.tsx']).toEqual(['Avatar in returned by face']);
    expect(result['p.tsx']).toEqual(['face() in ring']);
  });

  it('parses only files that can reach a carrier', () => {
    const result = census({
      'other.tsx':
        'export const Avatar = () => <div className="ring" />;\nexport const P = () => <Avatar />;',
    });
    expect(result['other.tsx']).toBeUndefined();
  });
});
