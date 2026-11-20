/**
 * 烬海纪元 · 方块类型定义
 * 三地层：浅层碎石与残骸(硬度 0.3–1) / 中层矿脉岩层(硬度 10–30) / 深层硬岩与发光晶体(硬度 40–70)
 */
export type BlockCategory = 'empty' | 'shallow' | 'mid' | 'deep' | 'liquid' | 'ore' | 'special';

export interface BlockDef {
  id: string;
  name: string;
  category: BlockCategory;
  hardness: number;       // 破坏所需能量
  toolLevel: number;      // 0=徒手可破, 1=镐I, 2=镐II ...
  paletteId: string;      // 调色板 id
  variants: string[];     // 调色板变体（用于渲染细节）
  emitsLight?: number;    // 0-15 光照等级
  liquid?: boolean;
  gravity?: boolean;
  drops?: { blockId: string; chance: number }[];
}

export const BLOCKS: Record<string, BlockDef> = {
  empty: { id: 'empty', name: '空气', category: 'empty', hardness: 0, toolLevel: 0, paletteId: '', variants: [] },

  // === 浅层：残骸带 ===
  wreck_scrap: {
    id: 'wreck_scrap', name: '残骸碎片', category: 'shallow',
    hardness: 0.5, toolLevel: 0,
    paletteId: 'iron03', variants: ['iron01', 'iron03', 'iron04'],
    drops: [{ blockId: 'wreck_scrap', chance: 1.0 }],
  },
  wreck_hull: {
    id: 'wreck_hull', name: '坠舰舰体', category: 'shallow',
    hardness: 1, toolLevel: 0,
    paletteId: 'rust03', variants: ['rust02', 'rust03', 'iron03'],
    drops: [{ blockId: 'wreck_scrap', chance: 0.7 }],
  },
  ember_ash: {
    id: 'ember_ash', name: '余烬', category: 'shallow',
    hardness: 0.3, toolLevel: 0,
    paletteId: 'ember04', variants: ['ember02', 'ember03', 'ember05'],
    gravity: true,
    emitsLight: 3,
    drops: [],
  },
  fire_crack: {
    id: 'fire_crack', name: '断口火焰', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'ember01', variants: ['ember01', 'ember02'],
    emitsLight: 8,
    drops: [],
  },

  // === 浅层：龟裂荒原 ===
  wind_rock: {
    id: 'wind_rock', name: '风蚀岩', category: 'shallow',
    hardness: 1, toolLevel: 0,
    paletteId: 'rust03', variants: ['rust02', 'rust03', 'rust04'],
    drops: [{ blockId: 'wind_rock', chance: 1.0 }],
  },
  cracked_ground: {
    id: 'cracked_ground', name: '龟裂地表', category: 'shallow',
    hardness: 0.8, toolLevel: 0,
    paletteId: 'rust04', variants: ['rust03', 'rust04', 'bone03'],
    drops: [{ blockId: 'cracked_ground', chance: 1.0 }],
  },
  surface_dust: {
    id: 'surface_dust', name: '粉尘', category: 'shallow',
    hardness: 0.3, toolLevel: 0,
    paletteId: 'bone03', variants: ['bone02', 'bone03'],
    gravity: true,
    drops: [],
  },

  // === 浅层：戈壁地表 ===
  desert_ground: {
    id: 'desert_ground', name: '戈壁土', category: 'shallow',
    hardness: 0.7, toolLevel: 0,
    paletteId: 'bone03', variants: ['bone02', 'bone03', 'bone04'],
    drops: [{ blockId: 'desert_ground', chance: 1.0 }],
  },

  // === 中层：矿脉 ===
  ore_rock: {
    id: 'ore_rock', name: '矿脉岩', category: 'mid',
    hardness: 15, toolLevel: 1,
    paletteId: 'iron04', variants: ['iron03', 'iron04', 'rust04'],
    drops: [{ blockId: 'ore_rock', chance: 1.0 }],
  },
  ore_copper: {
    id: 'ore_copper', name: '铜脉', category: 'ore',
    hardness: 18, toolLevel: 1,
    paletteId: 'rust02', variants: ['rust01', 'rust02', 'rust03'],
    drops: [{ blockId: 'ore_copper', chance: 1.0 }],
  },
  ore_iron: {
    id: 'ore_iron', name: '铁脉', category: 'ore',
    hardness: 22, toolLevel: 1,
    paletteId: 'iron01', variants: ['iron01', 'iron02', 'iron03'],
    drops: [{ blockId: 'ore_iron', chance: 1.0 }],
  },
  ore_gold: {
    id: 'ore_gold', name: '余金矿脉', category: 'ore',
    hardness: 28, toolLevel: 2,
    paletteId: 'ember02', variants: ['ember01', 'ember02', 'ember03'],
    emitsLight: 2,
    drops: [{ blockId: 'ore_gold', chance: 1.0 }],
  },

  // === 深层：硬岩 + 晶体 ===
  deep_rock: {
    id: 'deep_rock', name: '深岩', category: 'deep',
    hardness: 50, toolLevel: 2,
    paletteId: 'iron05', variants: ['iron04', 'iron05', 'bg02'],
    drops: [{ blockId: 'deep_rock', chance: 1.0 }],
  },
  crystal_glow: {
    id: 'crystal_glow', name: '发光晶体', category: 'deep',
    hardness: 40, toolLevel: 2,
    paletteId: 'cold01', variants: ['cold01', 'cold02', 'cold03'],
    emitsLight: 12,
    drops: [{ blockId: 'crystal_glow', chance: 1.0 }],
  },
  void_crystal: {
    id: 'void_crystal', name: '幽紫晶体', category: 'deep',
    hardness: 65, toolLevel: 3,
    paletteId: 'void01', variants: ['void01', 'void02', 'void03'],
    emitsLight: 14,
    drops: [{ blockId: 'void_crystal', chance: 1.0 }],
  },

  // === 无声海：液态金属 ===
  liquid_metal: {
    id: 'liquid_metal', name: '液态金属', category: 'liquid',
    hardness: 0, toolLevel: 0,
    paletteId: 'cold02', variants: ['cold01', 'cold02', 'cold03'],
    liquid: true,
    emitsLight: 6,
    drops: [],
  },
  metal_float: {
    id: 'metal_float', name: '浮游金属体', category: 'special',
    hardness: 5, toolLevel: 1,
    paletteId: 'iron01', variants: ['iron01', 'iron02', 'cold01'],
    drops: [{ blockId: 'wreck_scrap', chance: 1.0 }],
  },

  // === 异兽巢穴 ===
  chitin_hive: {
    id: 'chitin_hive', name: '甲壳蜂巢', category: 'special',
    hardness: 20, toolLevel: 1,
    paletteId: 'bone01', variants: ['bone01', 'bone02', 'bone03'],
    emitsLight: 1,
    drops: [{ blockId: 'chitin_hive', chance: 0.8 }],
  },
  bio_glow: {
    id: 'bio_glow', name: '幽蓝荧光囊', category: 'special',
    hardness: 8, toolLevel: 1,
    paletteId: 'void02', variants: ['void01', 'void02'],
    emitsLight: 10,
    drops: [{ blockId: 'bio_glow', chance: 0.9 }],
  },

  // === 地底幽谷：叛军据点 + 暗能量结界 ===
  rebel_brick: {
    id: 'rebel_brick', name: '据点墙砖', category: 'mid',
    hardness: 25, toolLevel: 2,
    paletteId: 'bone04', variants: ['bone03', 'bone04', 'bone05'],
    drops: [{ blockId: 'rebel_brick', chance: 1.0 }],
  },
  void_barrier: {
    id: 'void_barrier', name: '暗能量结界', category: 'special',
    hardness: 70, toolLevel: 3,
    paletteId: 'void03', variants: ['void02', 'void03', 'void04'],
    emitsLight: 15,
    drops: [],
  },

  // === 暗能量同化产物（黑雾污染后的方块）===
  dark_seed: {
    id: 'dark_seed', name: '暗能晶种', category: 'special',
    hardness: 30, toolLevel: 2,
    paletteId: 'void02', variants: ['void01', 'void02', 'void03'],
    emitsLight: 8,
    drops: [{ blockId: 'dark_seed', chance: 1.0 }],
  },
  dark_filament: {
    id: 'dark_filament', name: '暗能丝', category: 'special',
    hardness: 55, toolLevel: 2,
    paletteId: 'void03', variants: ['void02', 'void03', 'void04'],
    emitsLight: 12,
    drops: [{ blockId: 'dark_filament', chance: 1.0 }],
  },

  // === 对抗黑雾 ===
  purify_torch: {
    id: 'purify_torch', name: '净化火炬', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'ember01', variants: ['ember01', 'ember02'],
    emitsLight: 14,
    drops: [{ blockId: 'purify_torch', chance: 1.0 }],
  },

  // === 饰品（不可放置，仅合成产物/装备）===
  dash_boots: {
    id: 'dash_boots', name: '疾行靴', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'ember03', variants: [],
    drops: [],
  },
  regen_ring: {
    id: 'regen_ring', name: '再生之戒', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'cold02', variants: [],
    drops: [],
  },
  defense_charm: {
    id: 'defense_charm', name: '守护护符', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'iron03', variants: [],
    drops: [],
  },
  magnet_crystal: {
    id: 'magnet_crystal', name: '拾荒水晶', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'void01', variants: [],
    drops: [],
  },
  speed_glove: {
    id: 'speed_glove', name: '疾风手套', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'rust02', variants: [],
    drops: [],
  },
  wing_charm: {
    id: 'wing_charm', name: '幽光翅符', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'cold01', variants: [],
    drops: [],
  },

  // === M13: Boss 专属饰品（不可合成，100% 掉落）===
  rock_titan_crown: {
    id: 'rock_titan_crown', name: '岩石泰坦王冠', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'iron04', variants: [],
    drops: [],
  },
  crystal_warden_core: {
    id: 'crystal_warden_core', name: '晶守核心', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'void01', variants: [],
    drops: [],
  },
  void_assimilator_heart: {
    id: 'void_assimilator_heart', name: '同化之心', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'void03', variants: [],
    drops: [],
  },

  // === M14: 夜间精英 Boss 饰品 ===
  wreck_warlord_medal: { id: 'wreck_warlord_medal', name: '残骸战勋', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'iron02', variants: [], drops: [] },
  storm_banner: { id: 'storm_banner', name: '风暴战旗', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust01', variants: [], drops: [] },
  magma_core: { id: 'magma_core', name: '熔岩核心', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'ember02', variants: [], drops: [] },
  frost_veil: { id: 'frost_veil', name: '冰霜披纱', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'cold02', variants: [], drops: [] },
  hive_stinger: { id: 'hive_stinger', name: '毒刺护符', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'bone03', variants: [], drops: [] },
  shadow_cowl: { id: 'shadow_cowl', name: '暗影兜帽', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void04', variants: [], drops: [] },

  // === M18: 远程武器弹药 ===
  wooden_arrow: { id: 'wooden_arrow', name: '木箭', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust01', variants: [], drops: [] },
  dark_bolt: { id: 'dark_bolt', name: '暗焰弹', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void03', variants: [], drops: [] },
  copper_bow: { id: 'copper_bow', name: '铜弓', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust02', variants: [], drops: [] },
  void_crossbow: { id: 'void_crossbow', name: '虚空弩', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void01', variants: [], drops: [] },
  void_staff: { id: 'void_staff', name: '暗焰法杖', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void03', variants: [], drops: [] },

  // === M20: NPC + 金币 ===
  gold_coin: { id: 'gold_coin', name: '金币', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'gold01', variants: [], drops: [] },
  merchant_npc: { id: 'merchant_npc', name: '流浪商人', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'gold01', variants: [], drops: [] },

  // === M21: 试炼坛 ===
  wreck_trial_altar: { id: 'wreck_trial_altar', name: '残骸试炼坛', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust03', variants: [], drops: [] },
  void_trial_altar: { id: 'void_trial_altar', name: '虚空试炼坛', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void01', variants: [], drops: [] },
  beast_trial_altar: { id: 'beast_trial_altar', name: '野兽试炼坛', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'bio02', variants: [], drops: [] },

  // === M22: 药水 ===
  health_potion: { id: 'health_potion', name: '生命药水', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'red01', variants: [], drops: [] },
  iron_potion: { id: 'iron_potion', name: '铁皮药水', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'iron01', variants: [], drops: [] },
  swift_potion: { id: 'swift_potion', name: '敏捷药水', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'water01', variants: [], drops: [] },
  strength_potion: { id: 'strength_potion', name: '力量药水', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'orange01', variants: [], drops: [] },
  night_vision_potion: { id: 'night_vision_potion', name: '夜视药水', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'glow01', variants: [], drops: [] },

  // === M23: 坐骑 ===
  wreck_horse_saddle: { id: 'wreck_horse_saddle', name: '残骸战马鞍', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust02', variants: [], drops: [] },
  slime_saddle: { id: 'slime_saddle', name: '史莱姆鞍', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'bio01', variants: [], drops: [] },
  void_drake_saddle: { id: 'void_drake_saddle', name: '虚空飞龙鞍', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void01', variants: [], drops: [] },

  // === M24: 钓鱼 ===
  rust_scaled_fish: { id: 'rust_scaled_fish', name: '锈鳞鱼', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust02', variants: [], drops: [] },
  rock_bone_fish: { id: 'rock_bone_fish', name: '岩骨鱼', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'bone02', variants: [], drops: [] },
  gold_vein_fish: { id: 'gold_vein_fish', name: '金矿鱼', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'gold01', variants: [], drops: [] },
  liquid_metal_fish: { id: 'liquid_metal_fish', name: '液态金属鱼', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'cold02', variants: [], drops: [] },
  glow_worm_fish: { id: 'glow_worm_fish', name: '荧光虫鱼', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void02', variants: [], drops: [] },
  shadow_eel: { id: 'shadow_eel', name: '暗影鳗鱼', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void01', variants: [], drops: [] },
  void_koi: { id: 'void_koi', name: '虚空锦鲤', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void03', variants: [], drops: [] },
  old_chest: { id: 'old_chest', name: '旧宝箱', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust03', variants: [], drops: [] },
  basic_fishing_rod: { id: 'basic_fishing_rod', name: '基础钓鱼竿', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust02', variants: [], drops: [] },
  reinforced_fishing_rod: { id: 'reinforced_fishing_rod', name: '强化钓鱼竿', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'iron01', variants: [], drops: [] },

  // === M25: 宠物 ===
  ember_sprite_summon: { id: 'ember_sprite_summon', name: '余烬精灵灯', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'ember02', variants: [], drops: [] },
  glow_wisp_summon: { id: 'glow_wisp_summon', name: '幽蓝萤虫瓶', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'cold01', variants: [], drops: [] },
  void_whelp_summon: { id: 'void_whelp_summon', name: '虚空幼龙蛋', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void02', variants: [], drops: [] },

  // === M26: 护甲（4套装 × 3部位）===
  copper_helm: { id: 'copper_helm', name: '铜头盔', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust02', variants: [], drops: [] },
  copper_chest: { id: 'copper_chest', name: '铜胸甲', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust02', variants: [], drops: [] },
  copper_greaves: { id: 'copper_greaves', name: '铜腿甲', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust02', variants: [], drops: [] },
  iron_helm: { id: 'iron_helm', name: '铁头盔', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'iron01', variants: [], drops: [] },
  iron_chest: { id: 'iron_chest', name: '铁胸甲', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'iron01', variants: [], drops: [] },
  iron_greaves: { id: 'iron_greaves', name: '铁腿甲', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'iron01', variants: [], drops: [] },
  ember_helm: { id: 'ember_helm', name: '余金头盔', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'ember02', variants: [], drops: [] },
  ember_chest: { id: 'ember_chest', name: '余金胸甲', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'ember02', variants: [], drops: [] },
  ember_greaves: { id: 'ember_greaves', name: '余金腿甲', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'ember02', variants: [], drops: [] },
  void_helm: { id: 'void_helm', name: '虚空头盔', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void01', variants: [], drops: [] },
  void_chest: { id: 'void_chest', name: '虚空胸甲', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void01', variants: [], drops: [] },
  void_greaves: { id: 'void_greaves', name: '虚空腿甲', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void01', variants: [], drops: [] },

  // === M27: 宝箱 ===
  chest: {
    id: 'chest', name: '储物箱', category: 'special',
    hardness: 12, toolLevel: 1,
    paletteId: 'rust03', variants: [],
    drops: [{ blockId: 'chest', chance: 1.0 }],
  },

  // === M28: 熔炉 + 金属锭 ===
  furnace: {
    id: 'furnace', name: '熔炉', category: 'special',
    hardness: 18, toolLevel: 1,
    paletteId: 'ember02', variants: [],
    emitsLight: 8,
    drops: [{ blockId: 'furnace', chance: 1.0 }],
  },
  copper_bar: { id: 'copper_bar', name: '铜锭', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'rust03', variants: [], drops: [] },
  iron_bar: { id: 'iron_bar', name: '铁锭', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'iron02', variants: [], drops: [] },
  gold_bar: { id: 'gold_bar', name: '金锭', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'gold01', variants: [], drops: [] },
  void_bar: { id: 'void_bar', name: '虚空锭', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'void02', variants: [], drops: [] },

  // === M30: 生命 / 魔力水晶 ===
  life_crystal: { id: 'life_crystal', name: '生命水晶', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'red01', variants: [], drops: [] },
  mana_crystal: { id: 'mana_crystal', name: '魔力水晶', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'cold01', variants: [], drops: [] },

  // === M31: 种植 ===
  wheat_stage0: {
    id: 'wheat_stage0', name: '余烬小麦幼苗', category: 'special',
    hardness: 1, toolLevel: 0, paletteId: 'bio01', variants: [], drops: [],
  },
  wheat_stage1: {
    id: 'wheat_stage1', name: '余烬小麦（生长中）', category: 'special',
    hardness: 1, toolLevel: 0, paletteId: 'bio02', variants: [], drops: [],
  },
  wheat_stage2: {
    id: 'wheat_stage2', name: '余烬小麦（成熟）', category: 'special',
    hardness: 2, toolLevel: 0, paletteId: 'gold01', variants: [],
    drops: [
      { blockId: 'ember_wheat', chance: 1.0 },
      { blockId: 'ember_wheat', chance: 0.6 },
      { blockId: 'wheat_seed', chance: 1.0 },
    ],
  },
  wheat_seed: { id: 'wheat_seed', name: '余烬小麦种子', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'bio01', variants: [], drops: [] },
  ember_wheat: { id: 'ember_wheat', name: '余烬小麦', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'gold01', variants: [], drops: [] },

  // === M32: NPC 城镇入驻 ===
  settlement_flag: {
    id: 'settlement_flag', name: '定居旗', category: 'special',
    hardness: 8, toolLevel: 0, paletteId: 'red02', variants: [],
    drops: [{ blockId: 'settlement_flag', chance: 1.0 }],
  },
  settler_medic: { id: 'settler_medic', name: '医师', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'bio02', variants: [], drops: [] },
  settler_engineer: { id: 'settler_engineer', name: '工程师', category: 'special', hardness: 0, toolLevel: 0, paletteId: 'iron02', variants: [], drops: [] },

  // === 大框架: 地牢 ===
  dungeon_brick: {
    id: 'dungeon_brick', name: '地牢砖', category: 'special',
    hardness: 90, toolLevel: 3,
    paletteId: 'bone04', variants: ['bone03', 'bone04'],
    drops: [{ blockId: 'dungeon_brick', chance: 1.0 }],
  },
  dungeon_door: {
    id: 'dungeon_door', name: '地牢之门', category: 'special',
    hardness: 999, toolLevel: 9,
    paletteId: 'void03', variants: ['void03'],
    drops: [],
  },
  dungeon_altar: {
    id: 'dungeon_altar', name: '骷髅祭坛', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'ember02', variants: [],
    emitsLight: 6,
    drops: [],
  },

  // === 大框架: 地下晶簇（可开采，掉落生命 / 魔力水晶）===
  // 追加在末尾，保持已有方块索引不变（旧存档兼容）
  life_crystal_node: {
    id: 'life_crystal_node', name: '生命晶簇', category: 'deep',
    hardness: 30, toolLevel: 1,
    paletteId: 'red01', variants: ['red01', 'red02', 'ember01'],
    emitsLight: 9,
    drops: [{ blockId: 'life_crystal', chance: 1.0 }],
  },
  mana_crystal_node: {
    id: 'mana_crystal_node', name: '魔力晶簇', category: 'deep',
    hardness: 34, toolLevel: 2,
    paletteId: 'cold01', variants: ['cold01', 'cold02', 'cold03'],
    emitsLight: 9,
    drops: [{ blockId: 'mana_crystal', chance: 1.0 }],
  },

  // === 大框架: 霜蚀冻原（冷色雪原）===
  // 追加在末尾，保持已有方块索引不变（旧存档兼容）
  frost_snow: {
    id: 'frost_snow', name: '霜雪地表', category: 'shallow',
    hardness: 0.5, toolLevel: 0,
    paletteId: 'bone01', variants: ['bone01', 'bone02', 'cold01'],
    drops: [{ blockId: 'frost_snow', chance: 1.0 }],
  },
  ice_layer: {
    id: 'ice_layer', name: '冰层', category: 'shallow',
    hardness: 4, toolLevel: 1,
    paletteId: 'cold01', variants: ['cold01', 'cold02', 'cold03'],
    drops: [{ blockId: 'ice_layer', chance: 1.0 }],
  },
  permafrost: {
    id: 'permafrost', name: '永冻土', category: 'mid',
    hardness: 16, toolLevel: 1,
    paletteId: 'cold03', variants: ['cold03', 'cold04', 'iron03'],
    drops: [{ blockId: 'permafrost', chance: 1.0 }],
  },
  frost_rock: {
    id: 'frost_rock', name: '冻岩', category: 'deep',
    hardness: 46, toolLevel: 2,
    paletteId: 'iron05', variants: ['iron04', 'iron05', 'cold04'],
    drops: [{ blockId: 'frost_rock', chance: 1.0 }],
  },

  // === 大框架: 熔渣火山（火山灰 / 玄武岩 / 岩浆）===
  ash_ground: {
    id: 'ash_ground', name: '火山灰', category: 'shallow',
    hardness: 0.6, toolLevel: 0,
    paletteId: 'iron03', variants: ['iron03', 'bone05', 'ember05'],
    drops: [{ blockId: 'ash_ground', chance: 1.0 }],
  },
  basalt: {
    id: 'basalt', name: '玄武岩', category: 'shallow',
    hardness: 2, toolLevel: 1,
    paletteId: 'iron04', variants: ['iron04', 'iron05'],
    drops: [{ blockId: 'basalt', chance: 1.0 }],
  },
  obsidian: {
    id: 'obsidian', name: '黑曜岩', category: 'mid',
    hardness: 32, toolLevel: 2,
    paletteId: 'iron05', variants: ['iron05', 'void04'],
    drops: [{ blockId: 'obsidian', chance: 1.0 }],
  },
  ember_vein: {
    id: 'ember_vein', name: '余烬矿脉', category: 'ore',
    hardness: 24, toolLevel: 2,
    paletteId: 'ember03', variants: ['ember02', 'ember03', 'ember04'],
    emitsLight: 4,
    drops: [{ blockId: 'ember_vein', chance: 1.0 }],
  },
  magma_lava: {
    id: 'magma_lava', name: '岩浆', category: 'liquid',
    hardness: 0, toolLevel: 0,
    paletteId: 'ember02', variants: ['ember01', 'ember02', 'ember03'],
    liquid: true,
    emitsLight: 12,
    drops: [],
  },

  // === 大框架: 腐蚀沼泽 / 灰烬王庭 ===
  // 追加在末尾，保持已有方块索引不变（旧存档兼容）
  swamp_mud: {
    id: 'swamp_mud', name: '沼泽淤泥', category: 'shallow',
    hardness: 0.9, toolLevel: 0,
    paletteId: 'bone04', variants: ['bone03', 'bone04', 'rust05'],
    drops: [{ blockId: 'swamp_mud', chance: 1.0 }],
  },
  murk_water: {
    id: 'murk_water', name: '毒沼水', category: 'liquid',
    hardness: 0, toolLevel: 0,
    paletteId: 'rust05', variants: ['rust04', 'rust05', 'bone04'],
    liquid: true,
    drops: [],
  },
  rot_peat: {
    id: 'rot_peat', name: '腐殖泥炭', category: 'mid',
    hardness: 12, toolLevel: 1,
    paletteId: 'rust05', variants: ['rust04', 'rust05', 'bone05'],
    drops: [{ blockId: 'rot_peat', chance: 1.0 }],
  },
  rot_bone: {
    id: 'rot_bone', name: '枯骨层', category: 'mid',
    hardness: 8, toolLevel: 1,
    paletteId: 'bone02', variants: ['bone02', 'bone03', 'bone04'],
    drops: [{ blockId: 'rot_bone', chance: 1.0 }],
  },
  fen_rock: {
    id: 'fen_rock', name: '沼底岩', category: 'deep',
    hardness: 48, toolLevel: 2,
    paletteId: 'iron04', variants: ['iron04', 'bone05', 'cold04'],
    drops: [{ blockId: 'fen_rock', chance: 1.0 }],
  },
  spore_glow: {
    id: 'spore_glow', name: '发光孢子', category: 'special',
    hardness: 6, toolLevel: 1,
    paletteId: 'void02', variants: ['void01', 'void02'],
    emitsLight: 9,
    drops: [{ blockId: 'spore_glow', chance: 1.0 }],
  },

  court_tile: {
    id: 'court_tile', name: '王庭地砖', category: 'shallow',
    hardness: 1.2, toolLevel: 0,
    paletteId: 'bone03', variants: ['bone02', 'bone03', 'bone04'],
    drops: [{ blockId: 'court_tile', chance: 1.0 }],
  },
  court_rubble: {
    id: 'court_rubble', name: '碎砖堆', category: 'mid',
    hardness: 18, toolLevel: 1,
    paletteId: 'bone04', variants: ['bone03', 'bone04', 'iron03'],
    drops: [{ blockId: 'court_rubble', chance: 1.0 }],
  },
  court_brick: {
    id: 'court_brick', name: '王庭砖', category: 'mid',
    hardness: 26, toolLevel: 2,
    paletteId: 'bone05', variants: ['bone04', 'bone05', 'iron04'],
    drops: [{ blockId: 'court_brick', chance: 1.0 }],
  },
  court_deep: {
    id: 'court_deep', name: '王庭基石', category: 'deep',
    hardness: 52, toolLevel: 2,
    paletteId: 'iron05', variants: ['iron05', 'void04'],
    drops: [{ blockId: 'court_deep', chance: 1.0 }],
  },
  court_column: {
    id: 'court_column', name: '断裂石柱', category: 'special',
    hardness: 60, toolLevel: 2,
    paletteId: 'bone02', variants: ['bone01', 'bone02', 'bone03'],
    drops: [{ blockId: 'court_column', chance: 1.0 }],
  },
  court_brazier: {
    id: 'court_brazier', name: '王庭火盆', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'ember02', variants: ['ember01', 'ember02'],
    emitsLight: 10,
    drops: [],
  },

  // === 大框架: 雷鸣裂谷 / 余烬圣所 ===
  // 追加在末尾，保持已有方块索引不变（旧存档兼容）
  storm_scorch: {
    id: 'storm_scorch', name: '雷击焦土', category: 'shallow',
    hardness: 0.8, toolLevel: 0,
    paletteId: 'iron05', variants: ['iron04', 'iron05', 'bone05'],
    drops: [{ blockId: 'storm_scorch', chance: 1.0 }],
  },
  charged_rock: {
    id: 'charged_rock', name: '导电岩', category: 'mid',
    hardness: 20, toolLevel: 1,
    paletteId: 'iron04', variants: ['iron04', 'cold03', 'iron03'],
    emitsLight: 2,
    drops: [{ blockId: 'charged_rock', chance: 1.0 }],
  },
  thunder_crystal: {
    id: 'thunder_crystal', name: '雷晶', category: 'ore',
    hardness: 34, toolLevel: 2,
    paletteId: 'cold01', variants: ['cold01', 'cold02', 'cold03'],
    emitsLight: 10,
    drops: [{ blockId: 'thunder_crystal', chance: 1.0 }],
  },
  storm_spire: {
    id: 'storm_spire', name: '导电尖峰', category: 'special',
    hardness: 40, toolLevel: 2,
    paletteId: 'cold03', variants: ['cold02', 'cold03', 'iron03'],
    emitsLight: 5,
    drops: [{ blockId: 'thunder_crystal', chance: 0.6 }],
  },

  sanctum_tile: {
    id: 'sanctum_tile', name: '圣所地砖', category: 'shallow',
    hardness: 1.4, toolLevel: 0,
    paletteId: 'bone02', variants: ['bone01', 'bone02', 'bone03'],
    drops: [{ blockId: 'sanctum_tile', chance: 1.0 }],
  },
  sanctum_bronze: {
    id: 'sanctum_bronze', name: '青铜墙', category: 'mid',
    hardness: 30, toolLevel: 2,
    paletteId: 'rust03', variants: ['rust02', 'rust03', 'ember04'],
    drops: [{ blockId: 'sanctum_bronze', chance: 1.0 }],
  },
  sanctum_stone: {
    id: 'sanctum_stone', name: '祭坛石', category: 'deep',
    hardness: 54, toolLevel: 3,
    paletteId: 'iron05', variants: ['iron05', 'void04', 'bone05'],
    drops: [{ blockId: 'sanctum_stone', chance: 1.0 }],
  },
  sanctum_flame: {
    id: 'sanctum_flame', name: '长明圣火', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'ember01', variants: ['ember01', 'ember02'],
    emitsLight: 14,
    drops: [],
  },

  // === 大框架: 晶簇高原 / 黑雾边陲 ===
  // 追加在末尾，保持已有方块索引不变（旧存档兼容）
  crystal_crust: {
    id: 'crystal_crust', name: '晶簇地壳', category: 'shallow',
    hardness: 1.6, toolLevel: 1,
    paletteId: 'cold02', variants: ['cold01', 'cold02', 'cold03'],
    drops: [{ blockId: 'crystal_crust', chance: 1.0 }],
  },
  prism_rock: {
    id: 'prism_rock', name: '棱岩', category: 'mid',
    hardness: 20, toolLevel: 1,
    paletteId: 'cold03', variants: ['cold03', 'cold04', 'iron04'],
    drops: [{ blockId: 'prism_rock', chance: 1.0 }],
  },
  geode: {
    id: 'geode', name: '晶洞结核', category: 'ore',
    hardness: 36, toolLevel: 2,
    paletteId: 'cold01', variants: ['cold01', 'cold02', 'void02'],
    emitsLight: 10,
    drops: [{ blockId: 'geode', chance: 1.0 }],
  },
  crystal_shard: {
    id: 'crystal_shard', name: '棱晶簇', category: 'special',
    hardness: 30, toolLevel: 2,
    paletteId: 'cold01', variants: ['cold01', 'cold02'],
    emitsLight: 8,
    drops: [{ blockId: 'geode', chance: 0.5 }],
  },
  void_soil: {
    id: 'void_soil', name: '黑雾土', category: 'shallow',
    hardness: 1, toolLevel: 0,
    paletteId: 'void02', variants: ['void01', 'void02', 'void03'],
    drops: [{ blockId: 'void_soil', chance: 1.0 }],
  },
  void_crust: {
    id: 'void_crust', name: '虚空结壳', category: 'mid',
    hardness: 24, toolLevel: 1,
    paletteId: 'void03', variants: ['void02', 'void03', 'void04'],
    drops: [{ blockId: 'void_crust', chance: 1.0 }],
  },
  void_basalt: {
    id: 'void_basalt', name: '虚空玄武岩', category: 'deep',
    hardness: 56, toolLevel: 3,
    paletteId: 'iron05', variants: ['iron05', 'void04'],
    drops: [{ blockId: 'void_basalt', chance: 1.0 }],
  },
  void_beacon: {
    id: 'void_beacon', name: '暗能信标', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'void03', variants: ['void02', 'void03'],
    emitsLight: 12,
    drops: [],
  },

  // === 大框架: 幽渊海沟 / 星陨平原 ===
  // 追加在末尾，保持已有方块索引不变（旧存档兼容）
  abyss_silt: {
    id: 'abyss_silt', name: '渊底淤泥', category: 'shallow',
    hardness: 1.1, toolLevel: 0,
    paletteId: 'void02', variants: ['void02', 'void03', 'cold04'],
    drops: [{ blockId: 'abyss_silt', chance: 1.0 }],
  },
  abyss_shell: {
    id: 'abyss_shell', name: '贝壳层', category: 'mid',
    hardness: 14, toolLevel: 1,
    paletteId: 'bone03', variants: ['bone03', 'bone04', 'cold03'],
    drops: [{ blockId: 'abyss_shell', chance: 1.0 }],
  },
  abyss_rock: {
    id: 'abyss_rock', name: '渊底岩', category: 'deep',
    hardness: 58, toolLevel: 3,
    paletteId: 'iron05', variants: ['iron05', 'cold04', 'void04'],
    drops: [{ blockId: 'abyss_rock', chance: 1.0 }],
  },
  lumen_coral: {
    id: 'lumen_coral', name: '幽光珊瑚', category: 'ore',
    hardness: 22, toolLevel: 1,
    paletteId: 'cold01', variants: ['cold01', 'cold02', 'void02'],
    emitsLight: 10,
    drops: [{ blockId: 'lumen_coral', chance: 1.0 }],
  },
  abyss_water: {
    id: 'abyss_water', name: '渊水', category: 'liquid',
    hardness: 0, toolLevel: 0,
    paletteId: 'void03', variants: ['void02', 'void03', 'cold04'],
    liquid: true,
    emitsLight: 4,
    drops: [],
  },
  abyss_lure: {
    id: 'abyss_lure', name: '渊底诱光体', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'cold01', variants: ['cold01', 'cold02'],
    emitsLight: 12,
    drops: [],
  },
  starfall_soil: {
    id: 'starfall_soil', name: '星陨土', category: 'shallow',
    hardness: 0.9, toolLevel: 0,
    paletteId: 'iron04', variants: ['iron03', 'iron04', 'ember04'],
    drops: [{ blockId: 'starfall_soil', chance: 1.0 }],
  },
  starfall_crust: {
    id: 'starfall_crust', name: '星陨结壳', category: 'mid',
    hardness: 26, toolLevel: 2,
    paletteId: 'ember03', variants: ['ember02', 'ember03', 'iron05'],
    emitsLight: 2,
    drops: [{ blockId: 'starfall_crust', chance: 1.0 }],
  },
  starfall_basalt: {
    id: 'starfall_basalt', name: '陨坑玄武岩', category: 'deep',
    hardness: 60, toolLevel: 3,
    paletteId: 'iron05', variants: ['iron05', 'void04'],
    drops: [{ blockId: 'starfall_basalt', chance: 1.0 }],
  },
  star_metal: {
    id: 'star_metal', name: '星辉金属', category: 'ore',
    hardness: 40, toolLevel: 2,
    paletteId: 'gold01', variants: ['gold01', 'ember02', 'cold01'],
    emitsLight: 6,
    drops: [{ blockId: 'star_metal', chance: 1.0 }],
  },
  star_shard: {
    id: 'star_shard', name: '星辉碎晶', category: 'special',
    hardness: 28, toolLevel: 2,
    paletteId: 'gold01', variants: ['gold01', 'cold01'],
    emitsLight: 9,
    drops: [{ blockId: 'star_metal', chance: 0.5 }],
  },

  // === 大框架: 镜盐盆地 / 血棘林地 ===
  // 追加在末尾，保持已有方块索引不变（旧存档兼容）
  salt_crust: {
    id: 'salt_crust', name: '盐壳', category: 'shallow',
    hardness: 0.8, toolLevel: 0,
    paletteId: 'cold02', variants: ['cold01', 'cold02', 'bone01'],
    drops: [{ blockId: 'salt_crust', chance: 1.0 }],
  },
  salt_layer: {
    id: 'salt_layer', name: '盐岩层', category: 'mid',
    hardness: 10, toolLevel: 1,
    paletteId: 'bone01', variants: ['bone01', 'bone02', 'cold02'],
    drops: [{ blockId: 'salt_layer', chance: 1.0 }],
  },
  salt_glass: {
    id: 'salt_glass', name: '盐玻璃岩', category: 'deep',
    hardness: 50, toolLevel: 3,
    paletteId: 'cold01', variants: ['cold01', 'cold02', 'cold03'],
    drops: [{ blockId: 'salt_glass', chance: 1.0 }],
  },
  mirror_crystal: {
    id: 'mirror_crystal', name: '镜晶', category: 'ore',
    hardness: 34, toolLevel: 2,
    paletteId: 'cold01', variants: ['cold01', 'cold03', 'bone01'],
    emitsLight: 11,
    drops: [{ blockId: 'mirror_crystal', chance: 1.0 }],
  },
  salt_bloom: {
    id: 'salt_bloom', name: '盐花', category: 'special',
    hardness: 0, toolLevel: 0,
    paletteId: 'bone01', variants: ['bone01', 'cold02'],
    emitsLight: 8,
    drops: [],
  },
  thorn_soil: {
    id: 'thorn_soil', name: '荆棘土', category: 'shallow',
    hardness: 1.2, toolLevel: 0,
    paletteId: 'rust04', variants: ['rust03', 'rust04', 'rust05'],
    drops: [{ blockId: 'thorn_soil', chance: 1.0 }],
  },
  thorn_bark: {
    id: 'thorn_bark', name: '血棘枝干', category: 'mid',
    hardness: 18, toolLevel: 1,
    paletteId: 'rust03', variants: ['rust02', 'rust03', 'ember04'],
    drops: [{ blockId: 'thorn_bark', chance: 1.0 }],
  },
  thorn_heart: {
    id: 'thorn_heart', name: '棘心木', category: 'deep',
    hardness: 52, toolLevel: 3,
    paletteId: 'red01', variants: ['red01', 'red02', 'rust05'],
    drops: [{ blockId: 'thorn_heart', chance: 1.0 }],
  },
  blood_amber: {
    id: 'blood_amber', name: '血琥珀', category: 'ore',
    hardness: 30, toolLevel: 2,
    paletteId: 'red02', variants: ['red01', 'red02', 'ember03'],
    emitsLight: 6,
    drops: [{ blockId: 'blood_amber', chance: 1.0 }],
  },
  thorn_bramble: {
    id: 'thorn_bramble', name: '血棘丛', category: 'special',
    hardness: 26, toolLevel: 2,
    paletteId: 'rust02', variants: ['rust02', 'rust03'],
    emitsLight: 4,
    drops: [{ blockId: 'blood_amber', chance: 0.4 }],
  },
};

export const BLOCK_IDS = Object.keys(BLOCKS);

export function isSolid(id: string): boolean {
  if (id === 'empty') return false;
  const b = BLOCKS[id];
  return b && !b.liquid && b.hardness > 0;
}

/** 是否为液体（游泳判定） */
export function isLiquid(id: string): boolean {
  return BLOCKS[id]?.liquid === true;
}

export function getBlock(id: string): BlockDef {
  return BLOCKS[id] ?? BLOCKS.empty;
}
