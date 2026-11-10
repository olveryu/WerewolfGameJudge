/**
 * Ionicons by name, for models that choose icons as data (bottom actions, role cards, host tools).
 * Components that know their icon at build time import it from `~icons/ion/*` directly.
 */
import type { ComponentType, SVGProps } from 'react';

import IonAdd from '~icons/ion/add';
import IonAddCircleOutline from '~icons/ion/add-circle-outline';
import IonAlbumsOutline from '~icons/ion/albums-outline';
import IonAlert from '~icons/ion/alert';
import IonAlertCircle from '~icons/ion/alert-circle';
import IonAlertCircleOutline from '~icons/ion/alert-circle-outline';
import IonAnalytics from '~icons/ion/analytics';
import IonAnalyticsOutline from '~icons/ion/analytics-outline';
import IonArrowBack from '~icons/ion/arrow-back';
import IonArrowForward from '~icons/ion/arrow-forward';
import IonArrowForwardOutline from '~icons/ion/arrow-forward-outline';
import IonArrowRedoOutline from '~icons/ion/arrow-redo-outline';
import IonArrowUndoOutline from '~icons/ion/arrow-undo-outline';
import IonBackspaceOutline from '~icons/ion/backspace-outline';
import IonBarChartOutline from '~icons/ion/bar-chart-outline';
import IonBaseballOutline from '~icons/ion/baseball-outline';
import IonBookOutline from '~icons/ion/book-outline';
import IonBrush from '~icons/ion/brush';
import IonBrushOutline from '~icons/ion/brush-outline';
import IonBulbOutline from '~icons/ion/bulb-outline';
import IonCameraOutline from '~icons/ion/camera-outline';
import IonChatboxEllipsesOutline from '~icons/ion/chatbox-ellipses-outline';
import IonChatbubbleEllipsesOutline from '~icons/ion/chatbubble-ellipses-outline';
import IonChatbubbleOutline from '~icons/ion/chatbubble-outline';
import IonChatbubblesOutline from '~icons/ion/chatbubbles-outline';
import IonCheckboxOutline from '~icons/ion/checkbox-outline';
import IonCheckmark from '~icons/ion/checkmark';
import IonCheckmarkCircle from '~icons/ion/checkmark-circle';
import IonCheckmarkCircleOutline from '~icons/ion/checkmark-circle-outline';
import IonCheckmarkDoneOutline from '~icons/ion/checkmark-done-outline';
import IonCheckmarkOutline from '~icons/ion/checkmark-outline';
import IonChevronBack from '~icons/ion/chevron-back';
import IonChevronDown from '~icons/ion/chevron-down';
import IonChevronForward from '~icons/ion/chevron-forward';
import IonChevronUp from '~icons/ion/chevron-up';
import IonClipboardOutline from '~icons/ion/clipboard-outline';
import IonClose from '~icons/ion/close';
import IonCloseCircle from '~icons/ion/close-circle';
import IonCloseCircleOutline from '~icons/ion/close-circle-outline';
import IonCloudOfflineOutline from '~icons/ion/cloud-offline-outline';
import IonCloudOutline from '~icons/ion/cloud-outline';
import IonCloudUploadOutline from '~icons/ion/cloud-upload-outline';
import IonColorFillOutline from '~icons/ion/color-fill-outline';
import IonCopyOutline from '~icons/ion/copy-outline';
import IonCreate from '~icons/ion/create';
import IonCreateOutline from '~icons/ion/create-outline';
import IonDiamondOutline from '~icons/ion/diamond-outline';
import IonDocumentOutline from '~icons/ion/document-outline';
import IonDocumentTextOutline from '~icons/ion/document-text-outline';
import IonDownloadOutline from '~icons/ion/download-outline';
import IonEllipse from '~icons/ion/ellipse';
import IonEllipseOutline from '~icons/ion/ellipse-outline';
import IonEllipsisHorizontalCircle from '~icons/ion/ellipsis-horizontal-circle';
import IonEnterOutline from '~icons/ion/enter-outline';
import IonExpandOutline from '~icons/ion/expand-outline';
import IonEyeOffOutline from '~icons/ion/eye-off-outline';
import IonEyeOutline from '~icons/ion/eye-outline';
import IonFilmOutline from '~icons/ion/film-outline';
import IonFilter from '~icons/ion/filter';
import IonFingerPrintOutline from '~icons/ion/finger-print-outline';
import IonFlag from '~icons/ion/flag';
import IonFlagOutline from '~icons/ion/flag-outline';
import IonFlashOutline from '~icons/ion/flash-outline';
import IonFlaskOutline from '~icons/ion/flask-outline';
import IonFunnel from '~icons/ion/funnel';
import IonFunnelOutline from '~icons/ion/funnel-outline';
import IonGameController from '~icons/ion/game-controller';
import IonGameControllerOutline from '~icons/ion/game-controller-outline';
import IonGiftOutline from '~icons/ion/gift-outline';
import IonGitBranchOutline from '~icons/ion/git-branch-outline';
import IonGridOutline from '~icons/ion/grid-outline';
import IonHandLeftOutline from '~icons/ion/hand-left-outline';
import IonHelpCircleOutline from '~icons/ion/help-circle-outline';
import IonHelpOutline from '~icons/ion/help-outline';
import IonHomeOutline from '~icons/ion/home-outline';
import IonHourglassOutline from '~icons/ion/hourglass-outline';
import IonImageOutline from '~icons/ion/image-outline';
import IonImagesOutline from '~icons/ion/images-outline';
import IonInfiniteOutline from '~icons/ion/infinite-outline';
import IonInformationCircleOutline from '~icons/ion/information-circle-outline';
import IonLanguageOutline from '~icons/ion/language-outline';
import IonLayersOutline from '~icons/ion/layers-outline';
import IonLibraryOutline from '~icons/ion/library-outline';
import IonLinkOutline from '~icons/ion/link-outline';
import IonList from '~icons/ion/list';
import IonListOutline from '~icons/ion/list-outline';
import IonLocateOutline from '~icons/ion/locate-outline';
import IonLockClosed from '~icons/ion/lock-closed';
import IonLockClosedOutline from '~icons/ion/lock-closed-outline';
import IonLogInOutline from '~icons/ion/log-in-outline';
import IonMailOutline from '~icons/ion/mail-outline';
import IonMegaphoneOutline from '~icons/ion/megaphone-outline';
import IonMicOutline from '~icons/ion/mic-outline';
import IonMoonOutline from '~icons/ion/moon-outline';
import IonMusicalNotes from '~icons/ion/musical-notes';
import IonMusicalNotesOutline from '~icons/ion/musical-notes-outline';
import IonOptionsOutline from '~icons/ion/options-outline';
import IonPaperPlaneOutline from '~icons/ion/paper-plane-outline';
import IonPause from '~icons/ion/pause';
import IonPencilOutline from '~icons/ion/pencil-outline';
import IonPeopleOutline from '~icons/ion/people-outline';
import IonPersonAddOutline from '~icons/ion/person-add-outline';
import IonPersonCircleOutline from '~icons/ion/person-circle-outline';
import IonPersonOutline from '~icons/ion/person-outline';
import IonPersonRemoveOutline from '~icons/ion/person-remove-outline';
import IonPieChartOutline from '~icons/ion/pie-chart-outline';
import IonPlanetOutline from '~icons/ion/planet-outline';
import IonPlay from '~icons/ion/play';
import IonPlayCircle from '~icons/ion/play-circle';
import IonPlayForwardOutline from '~icons/ion/play-forward-outline';
import IonPlayOutline from '~icons/ion/play-outline';
import IonPulseOutline from '~icons/ion/pulse-outline';
import IonRadio from '~icons/ion/radio';
import IonRadioButtonOff from '~icons/ion/radio-button-off';
import IonRadioButtonOn from '~icons/ion/radio-button-on';
import IonRadioButtonOnOutline from '~icons/ion/radio-button-on-outline';
import IonRadioOutline from '~icons/ion/radio-outline';
import IonRefresh from '~icons/ion/refresh';
import IonRefreshOutline from '~icons/ion/refresh-outline';
import IonRemove from '~icons/ion/remove';
import IonRemoveOutline from '~icons/ion/remove-outline';
import IonRepeatOutline from '~icons/ion/repeat-outline';
import IonReturnDownBackOutline from '~icons/ion/return-down-back-outline';
import IonRibbonOutline from '~icons/ion/ribbon-outline';
import IonSearch from '~icons/ion/search';
import IonSearchOutline from '~icons/ion/search-outline';
import IonSend from '~icons/ion/send';
import IonShareOutline from '~icons/ion/share-outline';
import IonShareSocialOutline from '~icons/ion/share-social-outline';
import IonShieldCheckmark from '~icons/ion/shield-checkmark';
import IonShieldCheckmarkOutline from '~icons/ion/shield-checkmark-outline';
import IonShieldOutline from '~icons/ion/shield-outline';
import IonShirtOutline from '~icons/ion/shirt-outline';
import IonShuffle from '~icons/ion/shuffle';
import IonShuffleOutline from '~icons/ion/shuffle-outline';
import IonSkullOutline from '~icons/ion/skull-outline';
import IonSparkles from '~icons/ion/sparkles';
import IonSparklesOutline from '~icons/ion/sparkles-outline';
import IonSpeedometerOutline from '~icons/ion/speedometer-outline';
import IonSquareOutline from '~icons/ion/square-outline';
import IonStar from '~icons/ion/star';
import IonStarOutline from '~icons/ion/star-outline';
import IonStopCircle from '~icons/ion/stop-circle';
import IonStopCircleOutline from '~icons/ion/stop-circle-outline';
import IonSunnyOutline from '~icons/ion/sunny-outline';
import IonSwapHorizontalOutline from '~icons/ion/swap-horizontal-outline';
import IonSyncCircle from '~icons/ion/sync-circle';
import IonSyncOutline from '~icons/ion/sync-outline';
import IonTextOutline from '~icons/ion/text-outline';
import IonThumbsUp from '~icons/ion/thumbs-up';
import IonThumbsUpOutline from '~icons/ion/thumbs-up-outline';
import IonTicketOutline from '~icons/ion/ticket-outline';
import IonTimeOutline from '~icons/ion/time-outline';
import IonTimer from '~icons/ion/timer';
import IonTimerOutline from '~icons/ion/timer-outline';
import IonTrashOutline from '~icons/ion/trash-outline';
import IonTrophy from '~icons/ion/trophy';
import IonTrophyOutline from '~icons/ion/trophy-outline';
import IonUnlinkOutline from '~icons/ion/unlink-outline';
import IonVolumeHigh from '~icons/ion/volume-high';
import IonVolumeHighOutline from '~icons/ion/volume-high-outline';
import IonVolumeLow from '~icons/ion/volume-low';
import IonWarning from '~icons/ion/warning';
import IonWarningOutline from '~icons/ion/warning-outline';
import IonWaterOutline from '~icons/ion/water-outline';

const ION_ICONS = {
  add: IonAdd,
  'add-circle-outline': IonAddCircleOutline,
  'albums-outline': IonAlbumsOutline,
  alert: IonAlert,
  'alert-circle': IonAlertCircle,
  'alert-circle-outline': IonAlertCircleOutline,
  analytics: IonAnalytics,
  'analytics-outline': IonAnalyticsOutline,
  'arrow-back': IonArrowBack,
  'arrow-forward': IonArrowForward,
  'arrow-forward-outline': IonArrowForwardOutline,
  'arrow-redo-outline': IonArrowRedoOutline,
  'arrow-undo-outline': IonArrowUndoOutline,
  'backspace-outline': IonBackspaceOutline,
  'bar-chart-outline': IonBarChartOutline,
  'baseball-outline': IonBaseballOutline,
  'book-outline': IonBookOutline,
  brush: IonBrush,
  'brush-outline': IonBrushOutline,
  'bulb-outline': IonBulbOutline,
  'camera-outline': IonCameraOutline,
  'chatbox-ellipses-outline': IonChatboxEllipsesOutline,
  'chatbubble-ellipses-outline': IonChatbubbleEllipsesOutline,
  'chatbubble-outline': IonChatbubbleOutline,
  'chatbubbles-outline': IonChatbubblesOutline,
  'checkbox-outline': IonCheckboxOutline,
  checkmark: IonCheckmark,
  'checkmark-circle': IonCheckmarkCircle,
  'checkmark-circle-outline': IonCheckmarkCircleOutline,
  'checkmark-done-outline': IonCheckmarkDoneOutline,
  'checkmark-outline': IonCheckmarkOutline,
  'chevron-back': IonChevronBack,
  'chevron-down': IonChevronDown,
  'chevron-forward': IonChevronForward,
  'chevron-up': IonChevronUp,
  'clipboard-outline': IonClipboardOutline,
  close: IonClose,
  'close-circle': IonCloseCircle,
  'close-circle-outline': IonCloseCircleOutline,
  'cloud-offline-outline': IonCloudOfflineOutline,
  'cloud-outline': IonCloudOutline,
  'cloud-upload-outline': IonCloudUploadOutline,
  'color-fill-outline': IonColorFillOutline,
  'copy-outline': IonCopyOutline,
  create: IonCreate,
  'create-outline': IonCreateOutline,
  'diamond-outline': IonDiamondOutline,
  'document-outline': IonDocumentOutline,
  'document-text-outline': IonDocumentTextOutline,
  'download-outline': IonDownloadOutline,
  ellipse: IonEllipse,
  'ellipse-outline': IonEllipseOutline,
  'ellipsis-horizontal-circle': IonEllipsisHorizontalCircle,
  'enter-outline': IonEnterOutline,
  'expand-outline': IonExpandOutline,
  'eye-off-outline': IonEyeOffOutline,
  'eye-outline': IonEyeOutline,
  'film-outline': IonFilmOutline,
  filter: IonFilter,
  'finger-print-outline': IonFingerPrintOutline,
  flag: IonFlag,
  'flag-outline': IonFlagOutline,
  'flash-outline': IonFlashOutline,
  'flask-outline': IonFlaskOutline,
  funnel: IonFunnel,
  'funnel-outline': IonFunnelOutline,
  'game-controller': IonGameController,
  'game-controller-outline': IonGameControllerOutline,
  'gift-outline': IonGiftOutline,
  'git-branch-outline': IonGitBranchOutline,
  'grid-outline': IonGridOutline,
  'hand-left-outline': IonHandLeftOutline,
  'help-circle-outline': IonHelpCircleOutline,
  'help-outline': IonHelpOutline,
  'home-outline': IonHomeOutline,
  'hourglass-outline': IonHourglassOutline,
  'image-outline': IonImageOutline,
  'images-outline': IonImagesOutline,
  'infinite-outline': IonInfiniteOutline,
  'information-circle-outline': IonInformationCircleOutline,
  'language-outline': IonLanguageOutline,
  'layers-outline': IonLayersOutline,
  'library-outline': IonLibraryOutline,
  'link-outline': IonLinkOutline,
  list: IonList,
  'list-outline': IonListOutline,
  'locate-outline': IonLocateOutline,
  'lock-closed': IonLockClosed,
  'lock-closed-outline': IonLockClosedOutline,
  'log-in-outline': IonLogInOutline,
  'mail-outline': IonMailOutline,
  'megaphone-outline': IonMegaphoneOutline,
  'mic-outline': IonMicOutline,
  'moon-outline': IonMoonOutline,
  'musical-notes': IonMusicalNotes,
  'musical-notes-outline': IonMusicalNotesOutline,
  'options-outline': IonOptionsOutline,
  'paper-plane-outline': IonPaperPlaneOutline,
  pause: IonPause,
  'pencil-outline': IonPencilOutline,
  'people-outline': IonPeopleOutline,
  'person-add-outline': IonPersonAddOutline,
  'person-circle-outline': IonPersonCircleOutline,
  'person-outline': IonPersonOutline,
  'person-remove-outline': IonPersonRemoveOutline,
  'pie-chart-outline': IonPieChartOutline,
  'planet-outline': IonPlanetOutline,
  play: IonPlay,
  'play-circle': IonPlayCircle,
  'play-forward-outline': IonPlayForwardOutline,
  'play-outline': IonPlayOutline,
  'pulse-outline': IonPulseOutline,
  radio: IonRadio,
  'radio-button-off': IonRadioButtonOff,
  'radio-button-on': IonRadioButtonOn,
  'radio-button-on-outline': IonRadioButtonOnOutline,
  'radio-outline': IonRadioOutline,
  refresh: IonRefresh,
  'refresh-outline': IonRefreshOutline,
  remove: IonRemove,
  'remove-outline': IonRemoveOutline,
  'repeat-outline': IonRepeatOutline,
  'return-down-back-outline': IonReturnDownBackOutline,
  'ribbon-outline': IonRibbonOutline,
  search: IonSearch,
  'search-outline': IonSearchOutline,
  send: IonSend,
  'share-outline': IonShareOutline,
  'share-social-outline': IonShareSocialOutline,
  'shield-checkmark': IonShieldCheckmark,
  'shield-checkmark-outline': IonShieldCheckmarkOutline,
  'shield-outline': IonShieldOutline,
  'shirt-outline': IonShirtOutline,
  shuffle: IonShuffle,
  'shuffle-outline': IonShuffleOutline,
  'skull-outline': IonSkullOutline,
  sparkles: IonSparkles,
  'sparkles-outline': IonSparklesOutline,
  'speedometer-outline': IonSpeedometerOutline,
  'square-outline': IonSquareOutline,
  star: IonStar,
  'star-outline': IonStarOutline,
  'stop-circle': IonStopCircle,
  'stop-circle-outline': IonStopCircleOutline,
  'sunny-outline': IonSunnyOutline,
  'swap-horizontal-outline': IonSwapHorizontalOutline,
  'sync-circle': IonSyncCircle,
  'sync-outline': IonSyncOutline,
  'text-outline': IonTextOutline,
  'thumbs-up': IonThumbsUp,
  'thumbs-up-outline': IonThumbsUpOutline,
  'ticket-outline': IonTicketOutline,
  'time-outline': IonTimeOutline,
  timer: IonTimer,
  'timer-outline': IonTimerOutline,
  'trash-outline': IonTrashOutline,
  trophy: IonTrophy,
  'trophy-outline': IonTrophyOutline,
  'unlink-outline': IonUnlinkOutline,
  'volume-high': IonVolumeHigh,
  'volume-high-outline': IonVolumeHighOutline,
  'volume-low': IonVolumeLow,
  warning: IonWarning,
  'warning-outline': IonWarningOutline,
  'water-outline': IonWaterOutline,
} as const satisfies Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

/** An Ionicons glyph name available to data-driven icons. */
export type IoniconName = keyof typeof ION_ICONS;

interface IonIconProps extends SVGProps<SVGSVGElement> {
  name: IoniconName;
}

/** Renders the Ionicons glyph `name`; decorative unless an `aria-label` is passed. */
export function IonIcon({ name, ...props }: IonIconProps) {
  const Icon = ION_ICONS[name];
  return <Icon aria-hidden={props['aria-label'] === undefined} {...props} />;
}
