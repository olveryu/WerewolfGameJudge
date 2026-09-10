/** FashionButton — Fashion Shadow palette adapter over the shared Button behavior. */
import type React from 'react';
import type { ComponentProps } from 'react';

import { Button } from '@/components/Button';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

type FashionButtonProps = ComponentProps<typeof Button>;

export const FashionButton: React.FC<FashionButtonProps> = (props) => {
  const variant = props.variant ?? 'secondary';
  const resolvedButtonColor =
    props.buttonColor ??
    (variant === 'primary'
      ? fashionShadowColors.neonPink
      : variant === 'danger'
        ? fashionShadowColors.danger
        : variant === 'ghost'
          ? fashionShadowColors.transparent
          : fashionShadowColors.neonCyanSoft);
  const resolvedTextColor =
    props.textColor ??
    (variant === 'primary' || variant === 'danger'
      ? fashionShadowColors.black
      : variant === 'ghost'
        ? fashionShadowColors.neonCyan
        : fashionShadowColors.text);

  const fashionStyle =
    props.disabled === true && props.loading !== true
      ? { backgroundColor: fashionShadowColors.surfaceRaised }
      : variant === 'secondary'
        ? { backgroundColor: fashionShadowColors.surfaceRaised }
        : undefined;

  return (
    <Button
      {...props}
      variant={variant}
      buttonColor={resolvedButtonColor}
      textColor={resolvedTextColor}
      style={[fashionStyle, props.style]}
    />
  );
};
