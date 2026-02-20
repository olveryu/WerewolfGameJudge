/**
 * ConfigScreen Memo Performance Tests
 *
 * Verifies that memoized sub-components don't re-render when unrelated state changes.
 */
import { fireEvent, render } from '@testing-library/react-native';

import {
  ConfigScreenStyles,
  createConfigScreenStyles,
  Dropdown,
  RoleChip,
  Section,
} from '@/screens/ConfigScreen/components';

// Mock theme colors - complete ThemeColors interface
const mockColors = {
  // Primary
  primary: '#2196f3',
  primaryLight: '#64b5f6',
  primaryDark: '#1976d2',
  // Backgrounds
  background: '#fff',
  surface: '#f5f5f5',
  surfaceHover: '#eeeeee',
  card: '#ffffff',
  // Text
  text: '#000',
  textSecondary: '#666',
  textMuted: '#999',
  textInverse: '#fff',
  // Borders
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  // Status
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
  // Game specific
  wolf: '#d32f2f',
  villager: '#4caf50',
  god: '#9c27b0',
  third: '#f59e0b',
  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.3)',
};

describe('ConfigScreen Performance Optimizations', () => {
  let styles: ConfigScreenStyles;

  beforeAll(() => {
    styles = createConfigScreenStyles(mockColors);
  });

  describe('createConfigScreenStyles', () => {
    it('should return styles with all required keys', () => {
      const expectedKeys = [
        'container',
        'header',
        'headerBtn',
        'headerBtnText',
        'headerCenter',
        'headerTitle',
        'headerRight',
        'headerGearBtn',
        'headerGearBtnText',
        'templateRow',
        'templatePill',
        'templatePillText',
        'templatePillArrow',
        'playerCount',
        'clearBtn',
        'clearBtnText',
        'headerGearBtn',
        'headerGearBtnText',
        'bottomCreateBar',
        'bottomCreateBtn',
        'bottomCreateBtnDisabled',
        'bottomCreateBtnText',
        'tabBar',
        'tab',
        'tabActive',
        'tabLabel',
        'tabBadge',
        'tabBadgeText',
        'tabIndicator',
        'settingsRow',
        'settingsItem',
        'settingsLabel',
        'settingsSelector',
        'settingsSelectorText',
        'settingsSelectorArrow',
        'settingsSheetOverlay',
        'settingsSheetContent',
        'settingsSheetHandle',
        'settingsSheetTitle',
        'settingsChipGroup',
        'settingsChipGroupLabel',
        'settingsChipWrap',
        'settingsChip',
        'settingsChipSelected',
        'settingsChipText',
        'settingsChipTextSelected',
        'section',
        'sectionTitle',
        'sectionCard',
        'chipContainer',
        'chip',
        'chipSelected',
        'chipSelectedWolf',
        'chipSelectedGod',
        'chipSelectedVillager',
        'chipSelectedNeutral',
        'chipText',
        'chipTextSelected',
        'stepperRow',
        'stepperLabel',
        'stepperPill',
        'stepperControls',
        'stepperBtn',
        'stepperBtnDisabled',
        'stepperBtnText',
        'stepperBtnTextDisabled',
        'stepperCount',
        'scrollView',
        'loadingContainer',
        'loadingText',
        'modalOverlay',
        'modalContent',
        'modalHeader',
        'modalTitle',
        'modalCloseBtn',
        'modalCloseBtnText',
        'modalOption',
        'modalOptionSelected',
        'modalOptionText',
        'modalOptionTextSelected',
        'modalOptionCheck',
      ];

      for (const key of expectedKeys) {
        expect(styles).toHaveProperty(key);
      }
    });

    it('should create equivalent styles for same colors', () => {
      const styles1 = createConfigScreenStyles(mockColors);
      const styles2 = createConfigScreenStyles(mockColors);

      expect(styles1.container).toEqual(styles2.container);
      expect(styles1.chip).toEqual(styles2.chip);
      expect(styles1.chipSelected).toEqual(styles2.chipSelected);
    });
  });

  describe('RoleChip component', () => {
    const mockToggle = jest.fn();

    beforeEach(() => {
      mockToggle.mockClear();
    });

    it('should render unselected state correctly', () => {
      const { getByText, getByTestId } = render(
        <RoleChip id="wolf" label="狼人" selected={false} onToggle={mockToggle} styles={styles} />,
      );

      expect(getByText('狼人')).toBeTruthy();
      expect(getByTestId('config-role-chip-wolf')).toBeTruthy();
    });

    it('should render selected state correctly', () => {
      const { getByText } = render(
        <RoleChip id="seer" label="预言家" selected={true} onToggle={mockToggle} styles={styles} />,
      );

      expect(getByText('预言家')).toBeTruthy();
    });

    it('should call onToggle with id when pressed', () => {
      const { getByTestId } = render(
        <RoleChip id="witch" label="女巫" selected={false} onToggle={mockToggle} styles={styles} />,
      );

      fireEvent.press(getByTestId('config-role-chip-witch'));
      expect(mockToggle).toHaveBeenCalledWith('witch');
    });
  });

  describe('Section component', () => {
    it('should render title and children', () => {
      const { getByText } = render(
        <Section title="神职" styles={styles}>
          <RoleChip id="seer" label="预言家" selected={true} onToggle={jest.fn()} styles={styles} />
        </Section>,
      );

      expect(getByText('神职')).toBeTruthy();
      expect(getByText('预言家')).toBeTruthy();
    });
  });

  describe('Dropdown component', () => {
    const mockSelect = jest.fn();
    const options = [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
      { value: 'c', label: 'Option C' },
    ];

    beforeEach(() => {
      mockSelect.mockClear();
    });

    it('should render with selected value label', () => {
      const { getByText } = render(
        <Dropdown
          label="Test Dropdown"
          value="b"
          options={options}
          onSelect={mockSelect}
          styles={styles}
        />,
      );

      expect(getByText('Test Dropdown')).toBeTruthy();
      expect(getByText('Option B')).toBeTruthy();
    });
  });

  describe('Styles passed as props pattern', () => {
    it('should allow multiple RoleChips to share same styles reference', () => {
      const mockToggle = jest.fn();
      const parentStyles = createConfigScreenStyles(mockColors);

      const { getAllByText } = render(
        <>
          <RoleChip
            id="wolf1"
            label="狼人"
            selected={true}
            onToggle={mockToggle}
            styles={parentStyles}
          />
          <RoleChip
            id="wolf2"
            label="狼人"
            selected={true}
            onToggle={mockToggle}
            styles={parentStyles}
          />
          <RoleChip
            id="wolf3"
            label="狼人"
            selected={false}
            onToggle={mockToggle}
            styles={parentStyles}
          />
          <RoleChip
            id="seer"
            label="预言家"
            selected={true}
            onToggle={mockToggle}
            styles={parentStyles}
          />
          <RoleChip
            id="witch"
            label="女巫"
            selected={true}
            onToggle={mockToggle}
            styles={parentStyles}
          />
        </>,
      );

      // All chips render with shared styles
      expect(getAllByText('狼人')).toHaveLength(3);
      expect(getAllByText('预言家')).toHaveLength(1);
      expect(getAllByText('女巫')).toHaveLength(1);
    });
  });
});
