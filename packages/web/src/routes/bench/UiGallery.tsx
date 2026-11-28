import './UiGallery.css';

import { useState } from 'react';

import approveImage from '@/assets/avalon-vote/approve.webp';
import rejectImage from '@/assets/avalon-vote/reject.webp';
import { Avatar } from '@/components/avatar/Avatar';
import { AVATAR_CONCENTRIC_CLASS } from '@/components/avatar/avatarConcentric';
import { makeBuiltinAvatarUrl, pickHandDrawnAvatarUrls } from '@/components/avatar/avatarSources';
import { Badge, type BadgeTone } from '@/components/Badge';
import { Button, type ButtonTone } from '@/components/Button';
import { Chip, type ChipTone } from '@/components/Chip';
import { ChoiceCard } from '@/components/ChoiceCard';
import { FactionChip } from '@/components/FactionChip';
import { IconButton } from '@/components/IconButton';
import { IndeterminateProgressBar } from '@/components/IndeterminateProgressBar';
import { NumPad } from '@/components/NumPad';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SeatDot } from '@/components/SeatDot';
import { Spinner } from '@/components/Spinner';
import { Stepper } from '@/components/Stepper';
import { Switch } from '@/components/Switch';
import { TabList, Tabs } from '@/components/Tabs';
import { TESTIDS } from '@/testids';
import IconAdd from '~icons/ion/add';
import IconSettings from '~icons/ion/settings-outline';

const BUTTON_VARIANTS = ['primary', 'secondary', 'danger', 'ghost', 'outline', 'soft'] as const;
const BUTTON_SIZES = ['xs', 'sm', 'md', 'lg'] as const;
const BUTTON_TONES: readonly ButtonTone[] = ['wolf', 'god', 'villager', 'third', 'neutral'];
const BADGE_TONES: readonly BadgeTone[] = ['wolf', 'god', 'villager', 'third', 'muted'];
const CHIP_TONES: readonly ChipTone[] = ['wolf', 'god', 'villager', 'third', 'neutral', 'success'];
/** Fixed user ids, so every fallback avatar draws the same tint on every run. */
const AVATAR_SEEDS = ['gallery-a', 'gallery-b', 'gallery-c'] as const;
/** One avatar of every source: fallback (no avatar), generated (common, rare), hand-drawn portrait. */
const AVATAR_SOURCES: readonly (string | null)[] = [
  null,
  makeBuiltinAvatarUrl('genC-gallery'),
  makeBuiltinAvatarUrl('genR-gallery'),
  ...pickHandDrawnAvatarUrls(1),
];
const AVATAR_SIZES = [24, 48, 80] as const;

/**
 * Every shared component in every variant, size and state, drawn from fixed data with no
 * backend: the page the visual gate (`e2e/visual`) screenshots block by block. Each block is a
 * `TESTIDS.uiGalleryBlock` section, so a change to one component shows up in that block's image.
 * Hover and focus are produced by the real pointer and keyboard in the spec, on the
 * `interaction` block's targets, so no component carries a test-only state hook.
 */
export function UiGallery() {
  const [code, setCode] = useState('12');
  return (
    <main className="ui-gallery" data-testid={TESTIDS.uiGalleryRoot}>
      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('screen-header')}>
        <ScreenHeader title="陈列页" parentPath="/" />
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('button')}>
        {BUTTON_VARIANTS.map((variant) => (
          <div key={variant} className="ui-gallery-row">
            {BUTTON_SIZES.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {variant}
              </Button>
            ))}
          </div>
        ))}
        <div className="ui-gallery-row">
          <Button disabled>disabled</Button>
          <Button loading>loading</Button>
          <Button variant="secondary" disabled>
            disabled
          </Button>
        </div>
        <div className="ui-gallery-row">
          {BUTTON_TONES.map((tone) => (
            <Button key={tone} tone={tone} size="sm">
              {tone}
            </Button>
          ))}
        </div>
        <Button fullWidth>fullWidth</Button>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('interaction')}>
        <div className="ui-gallery-row">
          <Button data-testid={TESTIDS.uiGalleryTarget('button-primary')}>主操作</Button>
          <Button variant="secondary" data-testid={TESTIDS.uiGalleryTarget('button-secondary')}>
            次操作
          </Button>
          <IconButton
            label="设置"
            icon={<IconSettings aria-hidden />}
            data-testid={TESTIDS.uiGalleryTarget('icon-button')}
          />
        </div>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('icon-button')}>
        <div className="ui-gallery-row">
          <IconButton label="添加" icon={<IconAdd aria-hidden />} />
          <IconButton label="设置" icon={<IconSettings aria-hidden />} />
          <IconButton label="添加" icon={<IconAdd aria-hidden />} disabled />
        </div>
        <div className="ui-gallery-row">
          <IconButton label="小" size="sm" icon={<IconAdd aria-hidden />} />
          <IconButton label="大" size="lg" icon={<IconAdd aria-hidden />} />
          <IconButton label="开启" active icon={<IconSettings aria-hidden />} />
          <IconButton label="纯图标" variant="plain" icon={<IconSettings aria-hidden />} />
          <IconButton label="纯图标禁用" variant="plain" disabled icon={<IconAdd aria-hidden />} />
        </div>
        <div className="ui-gallery-row ui-gallery-media">
          <IconButton label="关闭" variant="on-media" icon={<IconAdd aria-hidden />} />
          <Spinner label="加载中" size="sm" tone="inverse" />
        </div>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('switch')}>
        <div className="ui-gallery-row">
          <Switch aria-label="关" defaultChecked={false} />
          <Switch aria-label="开" defaultChecked />
          <Switch aria-label="警示" tone="warning" defaultChecked />
          <Switch aria-label="禁用" disabled />
          <Switch aria-label="禁用开" disabled defaultChecked />
        </div>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('choice-card')}>
        <div className="ui-gallery-row">
          <ChoiceCard
            label="赞成"
            imageSrc={approveImage}
            isSelected
            isDisabled={false}
            testId={TESTIDS.uiGalleryChoice('selected')}
            onClick={() => {}}
          />
          <ChoiceCard
            label="反对"
            imageSrc={rejectImage}
            isSelected={false}
            isDisabled={false}
            testId={TESTIDS.uiGalleryChoice('unselected')}
            onClick={() => {}}
          />
          <ChoiceCard
            label="禁用"
            imageSrc={rejectImage}
            isDisabled
            testId={TESTIDS.uiGalleryChoice('disabled')}
            onClick={() => {}}
          />
        </div>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('badge')}>
        <div className="ui-gallery-row">
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
        <div className="ui-gallery-row">
          <FactionChip label="预言家" tone="god" size="md" />
          <FactionChip label="平民×4" tone="villager" onPress={() => {}} showChevron />
        </div>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('chip')}>
        <div className="ui-gallery-row">
          <Chip pressed onClick={() => {}}>
            全部
          </Chip>
          <Chip pressed={false} onClick={() => {}}>
            经典
          </Chip>
          <Chip pressed={false} disabled onClick={() => {}}>
            禁用
          </Chip>
          <Chip onClick={() => {}}>动作</Chip>
        </div>
        <div className="ui-gallery-row">
          {CHIP_TONES.map((tone) => (
            <Chip key={tone} tone={tone} pressed={tone === 'wolf'} onClick={() => {}}>
              {tone}
            </Chip>
          ))}
        </div>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('tabs')}>
        <Tabs value="wolf" onValueChange={() => {}}>
          <TabList
            label="分段页签"
            variant="segmented"
            items={[
              { value: 'wolf', label: '角色' },
              { value: 'god', label: '板子' },
            ]}
          />
        </Tabs>
        <Tabs value="god" onValueChange={() => {}}>
          <TabList
            label="下划线页签"
            variant="underline"
            items={[
              { value: 'wolf', label: '狼人', tone: 'wolf' },
              { value: 'god', label: '神职', tone: 'god' },
              { value: 'villager', label: '平民', tone: 'villager' },
              { value: 'third', label: '第三方', tone: 'third' },
            ]}
          />
        </Tabs>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('stepper')}>
        <Stepper
          label="人数"
          entry={{ kind: 'text', value: '8', onChangeText: () => {} }}
          onDecrement={() => {}}
          onIncrement={() => {}}
          isDecrementDisabled={false}
          isIncrementDisabled={false}
          testId="gallery-stepper-text"
          decrementTestId="gallery-stepper-text-dec"
          incrementTestId="gallery-stepper-text-inc"
        />
        <Stepper
          label="平民"
          entry={{ kind: 'readonly', value: 0 }}
          onDecrement={() => {}}
          onIncrement={() => {}}
          isDecrementDisabled
          isIncrementDisabled={false}
          testId="gallery-stepper-readonly"
          decrementTestId="gallery-stepper-readonly-dec"
          incrementTestId="gallery-stepper-readonly-inc"
        />
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('seat-dot')}>
        <div className="ui-gallery-row">
          <SeatDot seat={0} />
          <SeatDot seat={1} size="sm" />
          <SeatDot seat={2} emphasis="leader" />
          <SeatDot seat={3} emphasis="filled" />
          <SeatDot seat={4} withdrawn stateLabel="已退水" />
        </div>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('avatar')}>
        <div className="ui-gallery-avatars">
          {AVATAR_SEEDS.map((seed) => (
            <Avatar key={seed} userId={seed} avatarUrl={null} size={48} />
          ))}
        </div>
        <div className="ui-gallery-avatars">
          {AVATAR_SOURCES.map((avatarUrl) => (
            <Avatar
              key={avatarUrl ?? 'fallback'}
              userId="gallery-a"
              avatarUrl={avatarUrl}
              size={48}
            />
          ))}
        </div>
        <div className="ui-gallery-avatars">
          {AVATAR_SIZES.map((size) => (
            <Avatar
              key={size}
              userId="gallery-b"
              avatarUrl={AVATAR_SOURCES[1] ?? null}
              size={size}
            />
          ))}
          {/* `fill` in a sized host, and in a concentric box (border plus padding as its inset). */}
          <span className="ui-gallery-avatar-host">
            <Avatar userId="gallery-c" avatarUrl={AVATAR_SOURCES[3] ?? null} size="fill" />
          </span>
          <span className={`ui-gallery-avatar-box ${AVATAR_CONCENTRIC_CLASS}`}>
            <Avatar userId="gallery-c" avatarUrl={AVATAR_SOURCES[3] ?? null} size="fill" />
          </span>
        </div>
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('progress')}>
        <div className="ui-gallery-row">
          <Spinner label="加载中" size="sm" />
          <Spinner label="加载中" />
          <Spinner label="加载中" size="lg" />
        </div>
        <IndeterminateProgressBar />
        <IndeterminateProgressBar tone="error" />
      </section>

      <section className="ui-gallery-block" data-testid={TESTIDS.uiGalleryBlock('num-pad')}>
        <NumPad value={code} onValueChange={setCode} maxLength={4} />
      </section>
    </main>
  );
}
