import { render, screen } from '@testing-library/react-native';

import { FormTextField } from '../FormTextField';

describe('FormTextField accessibility', () => {
  it.each(['default', 'search'] as const)(
    'associates and clears errors for %s fields',
    (variant) => {
      const { rerender } = render(
        <FormTextField variant={variant} placeholder="邮箱" error="邮箱格式错误" />,
      );
      const errorId: unknown = screen.getByRole('alert').props.nativeID;
      expect(screen.getByLabelText('邮箱').props['aria-describedby']).toBe(errorId);
      expect(screen.getByLabelText('邮箱').props['aria-invalid']).toBe(true);
      rerender(<FormTextField variant={variant} placeholder="邮箱" />);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByLabelText('邮箱').props['aria-describedby']).toBeUndefined();
      expect(screen.getByLabelText('邮箱').props['aria-invalid']).toBe(false);
    },
  );
});
