/**
 * Badge Generation Config — 角色徽章生成配置
 *
 * 定义角色→Fluent Emoji 3D 映射、阵营配色、导出参数。
 * 由 generate-badges.mjs 读取。新增角色时只需在 EMOJI_MAP 加一行。
 *
 * Fluent Emoji 3D 资源来自 github.com/microsoft/fluentui-emoji (MIT)。
 * 人物类 emoji 有肤色变体，路径含 /Default/ 子目录，文件名后缀 _default。
 */

// ---------------------------------------------------------------------------
// Fluent Emoji 仓库基础 URL
// ---------------------------------------------------------------------------
export const FLUENT_BASE_URL =
  'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets';

// ---------------------------------------------------------------------------
// 角色 → Fluent Emoji 3D 路径映射
// [folderName, fileName, hasSkinTone]
//   hasSkinTone=true → path: {folder}/Default/3D/{file}_3d_default.png
//   hasSkinTone=false → path: {folder}/3D/{file}_3d.png
// ---------------------------------------------------------------------------
export const EMOJI_MAP = {
  // Villager faction
  villager: ['Bust in silhouette', 'bust_in_silhouette', false],
  mirrorSeer: ['Mirror', 'mirror', false],
  drunkSeer: ['Beer mug', 'beer_mug', false],

  // God faction
  seer: ['Crystal ball', 'crystal_ball', false],
  witch: ['Woman mage', 'woman_mage', true],
  poisoner: ['Skull and crossbones', 'skull_and_crossbones', false],
  hunter: ['Bow and arrow', 'bow_and_arrow', false],
  guard: ['Shield', 'shield', false],
  idiot: ['Clown face', 'clown_face', false],
  knight: ['Dagger', 'dagger', false],
  magician: ['Top hat', 'top_hat', false],
  witcher: ['Kitchen knife', 'kitchen_knife', false],
  psychic: ['Eye', 'eye', false],
  dreamcatcher: ['Crescent moon', 'crescent_moon', false],
  graveyardKeeper: ['Coffin', 'coffin', false],
  pureWhite: ['White heart', 'white_heart', false],
  dancer: ['Woman dancing', 'woman_dancing', true],
  silenceElder: ['Shushing face', 'shushing_face', false],
  votebanElder: ['Prohibited', 'prohibited', false],

  // Wolf faction
  wolf: ['Wolf', 'wolf', false],
  wolfQueen: ['Princess', 'princess', true],
  wolfKing: ['Crown', 'crown', false],
  darkWolfKing: ['Black heart', 'black_heart', false],
  nightmare: ['Face screaming in fear', 'face_screaming_in_fear', false],
  gargoyle: ['Moai', 'moai', false],
  awakenedGargoyle: ['Fire', 'fire', false],
  bloodMoon: ['Drop of blood', 'drop_of_blood', false],
  wolfRobot: ['Robot', 'robot', false],
  wolfWitch: ['Man mage', 'man_mage', true],
  spiritKnight: ['Crossed swords', 'crossed_swords', false],
  masquerade: ['Performing arts', 'performing_arts', false],
  warden: ['Chains', 'chains', false],

  // Third-party / Special
  slacker: ['Sleeping face', 'sleeping_face', false],
  wildChild: ['Baby', 'baby', true],
  piper: ['Flute', 'flute', false],
  shadow: ['Ghost', 'ghost', false],
  avenger: ['Kitchen knife', 'kitchen_knife', false],
  treasureMaster: ['Gem stone', 'gem_stone', false],
  thief: ['Joker', 'joker', false],
  cupid: ['Heart with arrow', 'heart_with_arrow', false],
  crow: ['Black bird', 'black_bird', false],
  maskedMan: ['Disguised face', 'disguised_face', false],
};

// ---------------------------------------------------------------------------
// 导出参数
// ---------------------------------------------------------------------------
export const EXPORT_SIZES = [128];
export const DEFAULT_OUTDIR = 'assets/badges';
