/**
 * Shared drawing toolbar for Pictionary and draw-and-guess, so the two games cannot drift.
 *
 * Compact icon-only row: tool / colour / width / undo / redo (optional); every button keeps its
 * accessible name. Each opens a panel; the colour panel holds the preset swatches, recently used
 * colours and an HSV picker (Ark UI).
 */

import './DrawingToolbar.css';

import { ColorPicker, parseColor } from '@ark-ui/react/color-picker';
import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { ComponentType, CSSProperties, SVGProps } from 'react';
import { useRef, useState } from 'react';

import IconAdd from '~icons/ion/add';
import IconArrowBack from '~icons/ion/arrow-back';
import IconArrowRedoOutline from '~icons/ion/arrow-redo-outline';
import IconArrowUndoOutline from '~icons/ion/arrow-undo-outline';
import IconBackspaceOutline from '~icons/ion/backspace-outline';
import IconBrushOutline from '~icons/ion/brush-outline';
import IconCheckmark from '~icons/ion/checkmark';
import IconClose from '~icons/ion/close';
import IconColorFillOutline from '~icons/ion/color-fill-outline';
import IconEllipse from '~icons/ion/ellipse';
import IconEllipseOutline from '~icons/ion/ellipse-outline';
import IconRemoveOutline from '~icons/ion/remove-outline';
import IconSquareOutline from '~icons/ion/square-outline';
import IconTrashOutline from '~icons/ion/trash-outline';

import type { DrawingTool } from '../model/drawing';

type ToolbarIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** One preset colour shown as a swatch. */
export interface DrawingPaletteEntry {
  readonly value: string;
  readonly name: string;
}

/** Controlled toolbar state and callbacks supplied by the drawing game. */
export interface DrawingToolbarProps {
  readonly tool: DrawingTool;
  readonly color: string;
  readonly strokeWidth: number;
  readonly canUndo: boolean;
  readonly canRedo?: boolean;
  readonly disabled: boolean;
  readonly palette: readonly DrawingPaletteEntry[];
  readonly widths: readonly number[];
  readonly onToolChange: (tool: DrawingTool) => void;
  readonly onColorChange: (color: string) => void;
  readonly onWidthChange: (width: number) => void;
  readonly onUndo: () => void;
  readonly onRedo?: () => void;
  /** The game owns the clear confirmation; the toolbar only forwards the request. */
  readonly onClear: () => void;
}

const TOOL_OPTIONS = [
  { tool: 'brush', label: '画笔', icon: IconBrushOutline },
  { tool: 'eraser', label: '橡皮', icon: IconBackspaceOutline },
  { tool: 'line', label: '直线', icon: IconRemoveOutline },
  { tool: 'rectangle', label: '矩形', icon: IconSquareOutline },
  { tool: 'ellipse', label: '椭圆', icon: IconEllipseOutline },
  { tool: 'fill', label: '填充', icon: IconColorFillOutline },
] as const satisfies readonly {
  readonly tool: DrawingTool;
  readonly label: string;
  readonly icon: ToolbarIcon;
}[];

const RECENT_COLOR_COUNT = 5;
/** Below this viewport width the colour panel docks to the bottom edge as a sheet. */
const COLOR_SHEET_BREAKPOINT = 600;
const OPAQUE_HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

type ToolbarPanel = 'tool' | 'color' | 'width';

/** Where the colour panel opens: docked sheet, or a popover above the colour button. */
type ColorPanelPlacement =
  | { readonly kind: 'sheet' }
  | { readonly kind: 'popover'; readonly anchorLeft: number; readonly anchorTop: number };

function sameColor(left: string, right: string): boolean {
  return left.toUpperCase() === right.toUpperCase();
}

function isDarkColor(value: string): boolean {
  return parseColor(value).toFormat('hsla').getChannelValue('lightness') < 50;
}

function ToolButton({
  label,
  caption,
  icon: toolIcon,
  isSelected = false,
  disabled,
  onClick,
}: {
  readonly label: string;
  /** Visible text under the icon in the panels; null in the icon-only toolbar row. */
  readonly caption: string | null;
  readonly icon: ToolbarIcon;
  readonly isSelected?: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  const ToolIcon = toolIcon;
  return (
    <button
      type="button"
      className="drawing-toolbar-button"
      aria-label={label}
      aria-pressed={isSelected}
      title={label}
      data-selected={isSelected}
      disabled={disabled}
      onClick={onClick}
    >
      <ToolIcon aria-hidden className="drawing-toolbar-icon" />
      {caption !== null && <span className="drawing-toolbar-caption">{caption}</span>}
    </button>
  );
}

function PanelCloseButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      type="button"
      className="drawing-toolbar-panel-icon-button"
      aria-label="关闭选择面板"
      onClick={onClick}
    >
      <IconClose aria-hidden />
    </button>
  );
}

function ColorPickerPanel({
  color,
  onColorChange,
}: {
  readonly color: string;
  readonly onColorChange: (hex: string) => void;
}) {
  return (
    <ColorPicker.Root
      inline
      className="drawing-color-picker"
      defaultValue={parseColor(color)}
      onValueChangeEnd={(details) => {
        const hex = details.value.toString('hex');
        if (!OPAQUE_HEX_COLOR.test(hex)) {
          throw new Error('[FAIL-FAST] Color picker returned an invalid opaque color');
        }
        onColorChange(hex);
      }}
    >
      <ColorPicker.Area className="drawing-color-picker-area" aria-label="饱和度与明度">
        <ColorPicker.AreaBackground className="drawing-color-picker-area-background" />
        <ColorPicker.AreaThumb
          className="drawing-color-picker-thumb"
          aria-label="调整饱和度与明度"
        />
      </ColorPicker.Area>
      <ColorPicker.ChannelSlider
        className="drawing-color-picker-hue"
        channel="hue"
        aria-label="色相"
      >
        <ColorPicker.ChannelSliderTrack className="drawing-color-picker-hue-track" />
        <ColorPicker.ChannelSliderThumb
          className="drawing-color-picker-thumb"
          aria-label="调整色相"
        />
      </ColorPicker.ChannelSlider>
      <ColorPicker.ValueSwatch className="drawing-color-picker-preview" aria-label="当前颜色预览" />
    </ColorPicker.Root>
  );
}

function colorPanelStyle(placement: ColorPanelPlacement): CSSProperties | undefined {
  if (placement.kind === 'sheet') return undefined;
  return {
    left: `clamp(var(--space-small), ${placement.anchorLeft}px, calc(100vw - var(--drawing-color-popover-width) - var(--space-small)))`,
    bottom: `calc(${window.innerHeight - placement.anchorTop}px + var(--space-small))`,
    maxHeight: `calc(${placement.anchorTop}px - env(safe-area-inset-top) - var(--space-medium))`,
  };
}

/** Compact drawing toolbar with tool, colour and width panels. */
export function DrawingToolbar(props: DrawingToolbarProps) {
  const [activePanel, setActivePanel] = useState<ToolbarPanel | null>(null);
  const [recentColors, setRecentColors] = useState<readonly string[]>([]);
  const [colorPlacement, setColorPlacement] = useState<ColorPanelPlacement>({ kind: 'sheet' });
  const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const { disabled } = props;

  const selectedTool = TOOL_OPTIONS.find((option) => option.tool === props.tool);
  if (selectedTool === undefined) {
    throw new Error('[FAIL-FAST] Unknown drawing tool');
  }
  const selectedSwatch = props.palette.find((swatch) => sameColor(swatch.value, props.color));

  const closePanel = () => {
    setActivePanel(null);
    setIsColorPickerVisible(false);
  };

  const rememberColor = (hex: string) => {
    if (props.palette.some((swatch) => sameColor(swatch.value, hex))) return;
    setRecentColors((previous) =>
      [hex, ...previous.filter((entry) => !sameColor(entry, hex))].slice(0, RECENT_COLOR_COUNT),
    );
  };

  // Remembers the colour in effect while the panel was open, before any choice made on close.
  const closeColorPanel = () => {
    rememberColor(props.color);
    closePanel();
  };

  const chooseColor = (hex: string) => {
    props.onColorChange(hex);
    closeColorPanel();
  };

  const openColorPanel = () => {
    const button = colorButtonRef.current;
    if (button === null) throw new Error('[FAIL-FAST] Colour button is not mounted');
    if (window.innerWidth < COLOR_SHEET_BREAKPOINT) {
      setColorPlacement({ kind: 'sheet' });
    } else {
      const bounds = button.getBoundingClientRect();
      setColorPlacement({ kind: 'popover', anchorLeft: bounds.left, anchorTop: bounds.top });
    }
    setActivePanel('color');
  };

  const isPanelOpen = activePanel !== null && !disabled;

  return (
    <div className="drawing-toolbar">
      <ToolButton
        label={`选择工具，当前${selectedTool.label}`}
        caption={null}
        icon={selectedTool.icon}
        disabled={disabled}
        onClick={() => setActivePanel('tool')}
      />
      <button
        ref={colorButtonRef}
        type="button"
        className="drawing-toolbar-button"
        aria-label={`选择颜色，当前${selectedSwatch?.name ?? '自定义颜色'}`}
        disabled={disabled}
        onClick={openColorPanel}
      >
        <span className="drawing-toolbar-color-dot" style={{ backgroundColor: props.color }} />
      </button>
      <ToolButton
        label={`选择粗细，当前 ${props.strokeWidth} 像素`}
        caption={null}
        icon={IconEllipse}
        disabled={disabled}
        onClick={() => setActivePanel('width')}
      />
      <ToolButton
        label="撤销"
        caption={null}
        icon={IconArrowUndoOutline}
        disabled={disabled || !props.canUndo}
        onClick={props.onUndo}
      />
      {props.onRedo !== undefined && (
        <ToolButton
          label="重做"
          caption={null}
          icon={IconArrowRedoOutline}
          disabled={disabled || !props.canRedo}
          onClick={props.onRedo}
        />
      )}

      <Dialog.Root
        open={isPanelOpen && activePanel === 'color'}
        onOpenChange={(details) => {
          if (!details.open) closeColorPanel();
        }}
        lazyMount
        unmountOnExit
      >
        <Portal>
          <Dialog.Backdrop className="drawing-toolbar-backdrop" />
          <Dialog.Positioner className="drawing-toolbar-positioner">
            <Dialog.Content
              className="drawing-color-panel"
              data-placement={colorPlacement.kind}
              style={colorPanelStyle(colorPlacement)}
              aria-label="画笔颜色面板"
            >
              <div className="drawing-toolbar-panel-header">
                {isColorPickerVisible && (
                  <button
                    type="button"
                    className="drawing-toolbar-panel-icon-button"
                    aria-label="返回常用颜色"
                    onClick={() => setIsColorPickerVisible(false)}
                  >
                    <IconArrowBack aria-hidden />
                  </button>
                )}
                <h2 className="drawing-toolbar-panel-title">
                  {isColorPickerVisible ? '调色板' : '颜色'}
                </h2>
                <span
                  className="drawing-color-current"
                  role="img"
                  aria-label="当前颜色"
                  style={{ backgroundColor: props.color }}
                />
                <PanelCloseButton onClick={closeColorPanel} />
              </div>
              {isColorPickerVisible ? (
                <ColorPickerPanel color={props.color} onColorChange={props.onColorChange} />
              ) : (
                <div className="drawing-color-body">
                  <div className="drawing-swatch-grid">
                    {props.palette.map((entry) => {
                      const isSelected = sameColor(props.color, entry.value);
                      return (
                        <button
                          key={entry.value}
                          type="button"
                          className="drawing-swatch"
                          aria-label={`颜色${entry.name}`}
                          aria-pressed={isSelected}
                          data-testid={`drawing-toolbar-color-${entry.name}`}
                          data-dark={isDarkColor(entry.value)}
                          style={{ backgroundColor: entry.value }}
                          onClick={() => chooseColor(entry.value)}
                        >
                          {isSelected && <IconCheckmark aria-hidden />}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="drawing-swatch drawing-swatch-custom"
                      aria-label="自定义颜色"
                      data-testid="drawing-toolbar-custom-color"
                      onClick={() => setIsColorPickerVisible(true)}
                    >
                      <IconAdd aria-hidden />
                    </button>
                  </div>
                  {recentColors.length > 0 && (
                    <>
                      <span className="drawing-color-section-title">最近使用</span>
                      <div className="drawing-swatch-grid">
                        {recentColors.map((recent, index) => (
                          <button
                            key={recent}
                            type="button"
                            className="drawing-swatch"
                            aria-label={`最近颜色 ${index + 1}`}
                            style={{ backgroundColor: recent }}
                            onClick={() => chooseColor(recent)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root
        open={isPanelOpen && activePanel !== 'color'}
        onOpenChange={(details) => {
          if (!details.open) closePanel();
        }}
        lazyMount
        unmountOnExit
      >
        <Portal>
          <Dialog.Backdrop className="drawing-toolbar-backdrop" />
          <Dialog.Positioner className="drawing-toolbar-positioner drawing-toolbar-sheet-positioner">
            <Dialog.Content className="drawing-toolbar-sheet">
              <div className="drawing-toolbar-panel-header">
                <Dialog.Title className="drawing-toolbar-panel-title">
                  {activePanel === 'tool' ? '绘画工具' : '画笔粗细'}
                </Dialog.Title>
                <PanelCloseButton onClick={closePanel} />
              </div>
              {activePanel === 'tool' && (
                <div className="drawing-toolbar-option-grid">
                  {TOOL_OPTIONS.map((option) => (
                    <ToolButton
                      key={option.tool}
                      label={option.label}
                      caption={option.label}
                      icon={option.icon}
                      isSelected={props.tool === option.tool}
                      disabled={disabled}
                      onClick={() => {
                        props.onToolChange(option.tool);
                        closePanel();
                      }}
                    />
                  ))}
                  <ToolButton
                    label="清空画布"
                    caption="清空"
                    icon={IconTrashOutline}
                    disabled={disabled || !props.canUndo}
                    onClick={() => {
                      closePanel();
                      props.onClear();
                    }}
                  />
                </div>
              )}
              {activePanel === 'width' && (
                <div className="drawing-toolbar-option-grid">
                  {props.widths.map((width) => (
                    <button
                      key={width}
                      type="button"
                      className="drawing-width-option"
                      aria-label={`笔宽 ${width}`}
                      aria-pressed={props.strokeWidth === width}
                      data-testid={`drawing-toolbar-width-${width}`}
                      disabled={disabled}
                      onClick={() => {
                        props.onWidthChange(width);
                        closePanel();
                      }}
                    >
                      <span
                        className="drawing-width-dot"
                        style={{
                          width,
                          height: width,
                          backgroundColor:
                            props.tool === 'eraser' ? 'var(--color-text-muted)' : props.color,
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </div>
  );
}
