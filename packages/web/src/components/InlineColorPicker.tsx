/**
 * The app's only entry to Ark's color picker (pinned by `Client dialogs: one Ark dialog root` in
 * `contracts/architecture.contract.test.ts`).
 *
 * The root is always `inline`. A non-inline zag color picker (1.47.0, `color-picker.machine`)
 * opens a dismissable popover layer of its own, which would sit in the layer stack outside
 * `AppDialog` and bring back the parent-removal cascade that `AppDialog.Root` blocks. Only the
 * inline parts are exported, so no popover, trigger or root provider can be built from here.
 */
import { ColorPicker, type ColorPickerRootProps, parseColor } from '@ark-ui/react/color-picker';

type InlineColorPickerRootProps = Omit<
  ColorPickerRootProps,
  'inline' | 'open' | 'defaultOpen' | 'onOpenChange'
>;

/** Ark `ColorPicker.Root` fixed to `inline`: it renders in place and opens no layer. */
function InlineColorPickerRoot(props: InlineColorPickerRootProps) {
  return <ColorPicker.Root {...props} inline />;
}

/** Color-picker parts used by the app; `Root` is the inline root above. */
export const InlineColorPicker = {
  Root: InlineColorPickerRoot,
  Area: ColorPicker.Area,
  AreaBackground: ColorPicker.AreaBackground,
  AreaThumb: ColorPicker.AreaThumb,
  ChannelSlider: ColorPicker.ChannelSlider,
  ChannelSliderTrack: ColorPicker.ChannelSliderTrack,
  ChannelSliderThumb: ColorPicker.ChannelSliderThumb,
  ValueSwatch: ColorPicker.ValueSwatch,
} as const;

export { parseColor };
