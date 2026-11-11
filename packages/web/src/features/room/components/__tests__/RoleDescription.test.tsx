/** Role description layout: one single-clause field or none reads as centered text, more as sections. */
import { render, screen } from '@testing-library/react';

import { RoleDescription } from '@/features/room/components/RoleCard';
import type { DescriptionField } from '@/features/room/model/RevealRoleData';

const skill: DescriptionField = { label: '主动技能', content: '每晚袭击一名玩家', testID: 'skill' };
const restriction: DescriptionField = {
  label: '限制条件',
  content: '不能自刀；不能空刀',
  tone: 'warning',
};

describe('RoleDescription', () => {
  it('renders a single field as the titled text, without its label', () => {
    render(<RoleDescription fields={[skill]} fallbackText="无技能描述" title="技能介绍" />);

    expect(screen.getByRole('heading', { name: '技能介绍' })).toBeInTheDocument();
    expect(screen.getByTestId('skill')).toHaveTextContent('每晚袭击一名玩家');
    expect(screen.queryByText('主动技能')).not.toBeInTheDocument();
  });

  it('ignores empty fields when counting', () => {
    render(
      <RoleDescription
        fields={[skill, { label: '被动特性', content: '' }]}
        fallbackText="无技能描述"
        title="技能介绍"
      />,
    );

    expect(screen.getByRole('heading', { name: '技能介绍' })).toBeInTheDocument();
    expect(screen.queryByText('被动特性')).not.toBeInTheDocument();
  });

  it('falls back to the plain text when no field has content', () => {
    render(<RoleDescription fields={[]} fallbackText="单段介绍" title="身份" />);

    expect(screen.getByRole('heading', { name: '身份' })).toBeInTheDocument();
    expect(screen.getByText('单段介绍')).toBeInTheDocument();
  });

  it('renders a single field holding several clauses as a labelled section with bullets', () => {
    render(<RoleDescription fields={[restriction]} fallbackText="" title="技能介绍" />);

    expect(screen.queryByRole('heading', { name: '技能介绍' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '限制条件' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '不能自刀',
      '不能空刀',
    ]);
  });

  it('renders two or more fields as labelled sections with semicolon bullets', () => {
    render(<RoleDescription fields={[skill, restriction]} fallbackText="" title="技能介绍" />);

    expect(screen.queryByRole('heading', { name: '技能介绍' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '主动技能' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '限制条件' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '不能自刀',
      '不能空刀',
    ]);
  });
});
