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
};

export const BLOCK_IDS = Object.keys(BLOCKS);

export function isSolid(id: string): boolean {
  if (id === 'empty') return false;
  const b = BLOCKS[id];
  return b && !b.liquid && b.hardness > 0;
}

export function getBlock(id: string): BlockDef {
  return BLOCKS[id] ?? BLOCKS.empty;
}
