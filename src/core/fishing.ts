/**
 * 烬海纪元 · 钓鱼系统
 * ====================
 * 泰拉瑞亚式休闲钓鱼 — 靠近液态方块抛竿，等待上钩后收竿
 * 按 F 键抛竿/收竿
 */

export interface FishDef {
  id: string;
  name: string;
  emoji: string;
  paletteId: string;
  region: string;        // 可钓区域
  rarity: number;        // 稀有度权重（越大越常见）
  isRare?: boolean;      // 是否稀有鱼
  potionIngredient?: string; // 可做的药水 id
}

export const FISH_DEFS: Record<string, FishDef> = {
  // 残骸带 — 锈鳞鱼
  rust_scaled_fish: {
    id: 'rust_scaled_fish', name: '锈鳞鱼', emoji: '🐟',
    paletteId: 'rust02', region: 'wreck_zone', rarity: 10,
    potionIngredient: 'strength_potion',
  },
  // 龟裂荒原 — 岩骨鱼
  rock_bone_fish: {
    id: 'rock_bone_fish', name: '岩骨鱼', emoji: '🐠',
    paletteId: 'bone02', region: 'crack_waste', rarity: 10,
    potionIngredient: 'iron_potion',
  },
  // 戈壁矿脉 — 金矿鱼
  gold_vein_fish: {
    id: 'gold_vein_fish', name: '金矿鱼', emoji: '🐡',
    paletteId: 'gold01', region: 'gobi_mine', rarity: 8,
    potionIngredient: 'swift_potion',
  },
  // 无声海 — 液态金属鱼（稀有）
  liquid_metal_fish: {
    id: 'liquid_metal_fish', name: '液态金属鱼', emoji: '🐉',
    paletteId: 'cold02', region: 'silent_sea', rarity: 4, isRare: true,
    potionIngredient: 'health_potion',
  },
  // 异兽巢穴 — 荧光虫鱼
  glow_worm_fish: {
    id: 'glow_worm_fish', name: '荧光虫鱼', emoji: '✨',
    paletteId: 'void02', region: 'beast_hive', rarity: 8,
    potionIngredient: 'night_vision_potion',
  },
  // 地底幽谷 — 暗影鳗鱼
  shadow_eel: {
    id: 'shadow_eel', name: '暗影鳗鱼', emoji: '🐍',
    paletteId: 'void01', region: 'underground_valley', rarity: 7,
    potionIngredient: 'strength_potion',
  },
  // 全区域稀有 — 虚空锦鲤
  void_koi: {
    id: 'void_koi', name: '虚空锦鲤', emoji: '🎏',
    paletteId: 'void03', region: 'all', rarity: 1, isRare: true,
    potionIngredient: 'health_potion',
  },
};

/**
 * 根据区域和钓鱼竿品质决定钓到什么
 * @param region 玩家所在区域 id
 * @param rodQuality 钓鱼竿品质（1=基础, 2=强化）
 * @returns 钓到的物品 id（鱼或旧宝箱）
 */
export function rollCatch(region: string, rodQuality: number): string {
  // 5% 概率钓到旧宝箱（强化竿 10%）
  const chestChance = rodQuality >= 2 ? 0.10 : 0.05;
  if (Math.random() < chestChance) return 'old_chest';

  // 收集当前区域可钓的鱼
  const pool: FishDef[] = [];
  for (const f of Object.values(FISH_DEFS)) {
    if (f.region === region || f.region === 'all') {
      // 稀有鱼在强化竿下概率提升
      const w = f.isRare ? f.rarity * (rodQuality >= 2 ? 2 : 1) : f.rarity;
      for (let i = 0; i < w; i++) pool.push(f);
    }
  }
  if (pool.length === 0) return 'rust_scaled_fish';
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/** 旧宝箱随机掉落 */
export function rollChestLoot(): { blockId: string; count: number }[] {
  const loot: { blockId: string; count: number }[] = [];
  const rolls = [
    { blockId: 'ore_copper', count: 3 + Math.floor(Math.random() * 5), chance: 0.8 },
    { blockId: 'ore_iron', count: 2 + Math.floor(Math.random() * 4), chance: 0.5 },
    { blockId: 'ore_gold', count: 1 + Math.floor(Math.random() * 3), chance: 0.3 },
    { blockId: 'crystal_glow', count: 1 + Math.floor(Math.random() * 2), chance: 0.4 },
    { blockId: 'gold_coin', count: 2 + Math.floor(Math.random() * 8), chance: 0.6 },
    { blockId: 'wreck_scrap', count: 2 + Math.floor(Math.random() * 4), chance: 0.7 },
  ];
  for (const r of rolls) {
    if (Math.random() < r.chance) loot.push({ blockId: r.blockId, count: r.count });
  }
  // 极小概率掉虚空晶
  if (Math.random() < 0.08) loot.push({ blockId: 'void_crystal', count: 1 });
  return loot;
}
