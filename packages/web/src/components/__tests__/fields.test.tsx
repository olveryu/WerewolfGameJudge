import { fireEvent, render, screen } from '@testing-library/react';

import { Checkbox } from '../Checkbox';
import { Radio } from '../Radio';
import { Select } from '../Select';
import { TextArea } from '../TextArea';
import { TextField } from '../TextField';

describe('TextField', () => {
  it('renders a plain text input that reports changes', () => {
    const onChange = vi.fn();
    render(<TextField aria-label="名称" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: '名称' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).not.toHaveAttribute('aria-invalid');
    fireEvent.change(input, { target: { value: '狼' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('marks a rejected value invalid', () => {
    render(<TextField aria-label="页码" defaultValue="9" invalid align="center" />);
    const input = screen.getByRole('textbox', { name: '页码' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('data-align', 'center');
  });

  it('draws the search frame around a searchbox', () => {
    render(<TextField aria-label="搜索角色" type="search" />);
    const input = screen.getByRole('searchbox', { name: '搜索角色' });
    expect(input.closest('label')).not.toBeNull();
  });

  it('shows and hides a revealable password', () => {
    render(<TextField aria-label="密码" type="password" defaultValue="secret" reveal />);
    const input = screen.getByLabelText('密码');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: '显示密码' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('has no reveal key unless asked', () => {
    render(<TextField aria-label="密码" type="password" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('TextArea', () => {
  it('renders a multi-line field with its height mode', () => {
    render(<TextArea aria-label="笔记" height="auto" invalid />);
    const field = screen.getByRole('textbox', { name: '笔记' });
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('data-height', 'auto');
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Select', () => {
  it('renders a single-choice combobox', () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="类别" value="a" onChange={onChange}>
        <option value="a">甲</option>
        <option value="b">乙</option>
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: '类别' });
    fireEvent.change(select, { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Checkbox and Radio', () => {
  it('render native check box and radio controls', () => {
    render(
      <>
        <Checkbox aria-label="全选" defaultChecked />
        <Radio aria-label="随机" size="sm" name="track" />
      </>,
    );
    expect(screen.getByRole('checkbox', { name: '全选' })).toBeChecked();
    const radio = screen.getByRole('radio', { name: '随机' });
    expect(radio).not.toBeChecked();
    expect(radio).toHaveAttribute('data-size', 'sm');
    fireEvent.click(radio);
    expect(radio).toBeChecked();
  });
});
