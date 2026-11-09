/**
 * Name styles: every catalog name style has a config, every animation it names is a keyframe in
 * `nameStyles.css`, and the colour variables those keyframes read are supplied by the config.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NAME_STYLE_IDS } from '@game-judge/game-engine/product/rewards';
import { render, screen } from '@testing-library/react';

import { NAME_STYLE_CONFIGS } from '../nameStyleConfigs';
import { NameStyleText } from '../NameStyleText';

const css = readFileSync(join(import.meta.dirname, '..', 'nameStyles.css'), 'utf8');

/** `@keyframes name { … }` bodies keyed by name (one nesting level). */
const keyframes = new Map(
  [...css.matchAll(/@keyframes (\w+) \{((?:[^{}]|\{[^{}]*\})*)\}/g)].map(
    ([, name, body]) => [name!, body!] as const,
  ),
);

describe('name styles', () => {
  it('has a config for every catalog name style, under its own id', () => {
    expect(Object.keys(NAME_STYLE_CONFIGS).sort()).toEqual([...NAME_STYLE_IDS].sort());
    for (const [id, config] of Object.entries(NAME_STYLE_CONFIGS)) expect(config.id).toBe(id);
  });

  it('animates only with keyframes the stylesheet defines and the filters they read', () => {
    for (const config of Object.values(NAME_STYLE_CONFIGS)) {
      for (const animation of config.animations ?? []) {
        const body = keyframes.get(animation.name);
        expect(body, `${config.id}: @keyframes ${animation.name}`).toBeDefined();
        for (const [, index] of body!.matchAll(/--name-style-filter-(\d)/g)) {
          expect(config.filters?.[Number(index)], `${config.id}: filter ${index}`).toBeDefined();
        }
      }
    }
  });

  it('renders gradient and animated styles through data attributes and plain text otherwise', () => {
    render(
      <>
        <NameStyleText styleId="goldenScript">金</NameStyleText>
        <NameStyleText styleId="plainCrimson">红</NameStyleText>
        <NameStyleText styleId="notAStyle">无</NameStyleText>
      </>,
    );
    const mythic = screen.getByText('金');
    expect(mythic).toHaveAttribute('data-gradient', 'true');
    expect(mythic).toHaveAttribute('data-animated', 'true');
    expect(mythic.style.getPropertyValue('--name-style-animation-name')).toBe(
      'goldenScriptWeave, goldenScriptCharge',
    );
    const common = screen.getByText('红');
    expect(common).toHaveAttribute('data-gradient', 'false');
    expect(common.style.color).not.toBe('');
    expect(screen.getByText('无')).not.toHaveAttribute('style');
  });
});
