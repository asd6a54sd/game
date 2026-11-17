/**
 * 烬海纪元 · 合成系统
 * 简化版：配方列表 + 工作台判定 + 产物直接进背包
 */
import { Inventory } from './inventory.js';

export interface Recipe {
  resultBlockId: string;
  resultCount: number;
  ingredients: { blockId: string; count: number }[];
  requiresWorkbench: boolean;
  requiresFurnace?: boolean;
}

export const RECIPES: Recipe[] = [
  // === 基础工具 ===
  { resultBlockId: 'copper_pickaxe', resultCount: 1, ingredients: [{ blockId: 'ore_copper', count: 8 }, { blockId: 'wreck_scrap', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'copper_sword', resultCount: 1, ingredients: [{ blockId: 'ore_copper', count: 5 }], requiresWorkbench: true },
  { resultBlockId: 'iron_pickaxe', resultCount: 1, ingredients: [{ blockId: 'ore_iron', count: 8 }, { blockId: 'ore_copper', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'iron_sword', resultCount: 1, ingredients: [{ blockId: 'ore_iron', count: 6 }], requiresWorkbench: true },
  { resultBlockId: 'ember_pickaxe', resultCount: 1, ingredients: [{ blockId: 'ore_gold', count: 8 }, { blockId: 'ore_iron', count: 4 }], requiresWorkbench: true },
  { resultBlockId: 'ember_sword', resultCount: 1, ingredients: [{ blockId: 'ore_gold', count: 5 }, { blockId: 'ore_iron', count: 2 }], requiresWorkbench: true },

  // === 黑雾对抗 ===
  { resultBlockId: 'purify_torch', resultCount: 1, ingredients: [{ blockId: 'ore_gold', count: 2 }, { blockId: 'ore_copper', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'purify_torch', resultCount: 3, ingredients: [{ blockId: 'ore_gold', count: 5 }, { blockId: 'ore_copper', count: 5 }], requiresWorkbench: true },

  // === 暗能装备（Boss 前级别） ===
  { resultBlockId: 'void_pickaxe', resultCount: 1, ingredients: [{ blockId: 'dark_filament', count: 6 }, { blockId: 'crystal_glow', count: 4 }], requiresWorkbench: true },
  { resultBlockId: 'void_sword', resultCount: 1, ingredients: [{ blockId: 'dark_seed', count: 5 }, { blockId: 'ore_gold', count: 3 }], requiresWorkbench: true },

  // === 建筑材料 ===
  { resultBlockId: 'rebel_brick', resultCount: 4, ingredients: [{ blockId: 'wind_rock', count: 2 }, { blockId: 'ore_copper', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'wreck_hull', resultCount: 1, ingredients: [{ blockId: 'wreck_scrap', count: 4 }], requiresWorkbench: true },

  // === 饰品（M11）===
  { resultBlockId: 'dash_boots', resultCount: 1, ingredients: [{ blockId: 'ore_gold', count: 3 }, { blockId: 'ore_iron', count: 5 }, { blockId: 'wreck_scrap', count: 4 }], requiresWorkbench: true },
  { resultBlockId: 'regen_ring', resultCount: 1, ingredients: [{ blockId: 'crystal_glow', count: 2 }, { blockId: 'ore_copper', count: 3 }, { blockId: 'ore_gold', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'defense_charm', resultCount: 1, ingredients: [{ blockId: 'ore_iron', count: 6 }, { blockId: 'wreck_hull', count: 2 }, { blockId: 'ore_copper', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'magnet_crystal', resultCount: 1, ingredients: [{ blockId: 'void_crystal', count: 2 }, { blockId: 'crystal_glow', count: 3 }], requiresWorkbench: true },
  { resultBlockId: 'speed_glove', resultCount: 1, ingredients: [{ blockId: 'ore_copper', count: 4 }, { blockId: 'wind_rock', count: 3 }, { blockId: 'wreck_scrap', count: 3 }], requiresWorkbench: true },
  { resultBlockId: 'wing_charm', resultCount: 1, ingredients: [{ blockId: 'crystal_glow', count: 4 }, { blockId: 'bio_glow', count: 2 }, { blockId: 'ore_gold', count: 2 }], requiresWorkbench: true },

  // === M18: 远程武器 + 弹药 ===
  { resultBlockId: 'wooden_arrow', resultCount: 5, ingredients: [{ blockId: 'wreck_scrap', count: 2 }, { blockId: 'ore_copper', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'dark_bolt', resultCount: 3, ingredients: [{ blockId: 'dark_seed', count: 1 }, { blockId: 'crystal_glow', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'copper_bow', resultCount: 1, ingredients: [{ blockId: 'ore_copper', count: 6 }, { blockId: 'wreck_scrap', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'void_crossbow', resultCount: 1, ingredients: [{ blockId: 'dark_filament', count: 4 }, { blockId: 'ore_iron', count: 4 }, { blockId: 'crystal_glow', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'void_staff', resultCount: 1, ingredients: [{ blockId: 'void_crystal', count: 2 }, { blockId: 'dark_seed', count: 3 }, { blockId: 'ore_gold', count: 2 }], requiresWorkbench: true },

  // === M22: 药水 ===
  { resultBlockId: 'health_potion', resultCount: 1, ingredients: [{ blockId: 'crystal_glow', count: 2 }, { blockId: 'bio_glow', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'iron_potion', resultCount: 1, ingredients: [{ blockId: 'ore_iron', count: 2 }, { blockId: 'crystal_glow', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'swift_potion', resultCount: 1, ingredients: [{ blockId: 'wind_stone', count: 2 }, { blockId: 'bio_glow', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'strength_potion', resultCount: 1, ingredients: [{ blockId: 'ore_gold', count: 1 }, { blockId: 'dark_seed', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'night_vision_potion', resultCount: 1, ingredients: [{ blockId: 'bio_glow', count: 2 }, { blockId: 'crystal_glow', count: 1 }], requiresWorkbench: true },

  // === M23: 坐骑 ===
  { resultBlockId: 'wreck_horse_saddle', resultCount: 1, ingredients: [{ blockId: 'ore_iron', count: 6 }, { blockId: 'wreck_scrap', count: 4 }, { blockId: 'ore_copper', count: 3 }], requiresWorkbench: true },
  { resultBlockId: 'slime_saddle', resultCount: 1, ingredients: [{ blockId: 'bio_glow', count: 4 }, { blockId: 'chitin', count: 3 }, { blockId: 'ore_iron', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'void_drake_saddle', resultCount: 1, ingredients: [{ blockId: 'void_crystal', count: 3 }, { blockId: 'dark_filament', count: 4 }, { blockId: 'ore_gold', count: 3 }], requiresWorkbench: true },

  // === M24: 钓鱼竿 ===
  { resultBlockId: 'basic_fishing_rod', resultCount: 1, ingredients: [{ blockId: 'ore_copper', count: 4 }, { blockId: 'wreck_scrap', count: 3 }], requiresWorkbench: true },
  { resultBlockId: 'reinforced_fishing_rod', resultCount: 1, ingredients: [{ blockId: 'ore_iron', count: 4 }, { blockId: 'crystal_glow', count: 2 }, { blockId: 'wreck_scrap', count: 3 }], requiresWorkbench: true },

  // === M24: 鱼做药水（鱼+基础材料）===
  { resultBlockId: 'health_potion', resultCount: 1, ingredients: [{ blockId: 'liquid_metal_fish', count: 1 }, { blockId: 'crystal_glow', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'iron_potion', resultCount: 1, ingredients: [{ blockId: 'rock_bone_fish', count: 1 }, { blockId: 'ore_iron', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'swift_potion', resultCount: 1, ingredients: [{ blockId: 'gold_vein_fish', count: 1 }, { blockId: 'wind_stone', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'strength_potion', resultCount: 1, ingredients: [{ blockId: 'rust_scaled_fish', count: 1 }, { blockId: 'ore_gold', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'night_vision_potion', resultCount: 1, ingredients: [{ blockId: 'glow_worm_fish', count: 1 }, { blockId: 'bio_glow', count: 1 }], requiresWorkbench: true },

  // === M25: 宠物召唤物 ===
  { resultBlockId: 'ember_sprite_summon', resultCount: 1, ingredients: [{ blockId: 'ember_ash', count: 8 }, { blockId: 'crystal_glow', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'glow_wisp_summon', resultCount: 1, ingredients: [{ blockId: 'bio_glow', count: 4 }, { blockId: 'crystal_glow', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'void_whelp_summon', resultCount: 1, ingredients: [{ blockId: 'void_crystal', count: 3 }, { blockId: 'dark_seed', count: 3 }, { blockId: 'chitin', count: 4 }], requiresWorkbench: true },

  // === M26: 护甲（4套装 × 3部位）===
  // 铜套
  { resultBlockId: 'copper_helm', resultCount: 1, ingredients: [{ blockId: 'ore_copper', count: 5 }], requiresWorkbench: true },
  { resultBlockId: 'copper_chest', resultCount: 1, ingredients: [{ blockId: 'ore_copper', count: 8 }], requiresWorkbench: true },
  { resultBlockId: 'copper_greaves', resultCount: 1, ingredients: [{ blockId: 'ore_copper', count: 6 }], requiresWorkbench: true },
  // 铁套
  { resultBlockId: 'iron_helm', resultCount: 1, ingredients: [{ blockId: 'ore_iron', count: 6 }, { blockId: 'ore_copper', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'iron_chest', resultCount: 1, ingredients: [{ blockId: 'ore_iron', count: 10 }, { blockId: 'ore_copper', count: 3 }], requiresWorkbench: true },
  { resultBlockId: 'iron_greaves', resultCount: 1, ingredients: [{ blockId: 'ore_iron', count: 8 }, { blockId: 'ore_copper', count: 2 }], requiresWorkbench: true },
  // 余金套
  { resultBlockId: 'ember_helm', resultCount: 1, ingredients: [{ blockId: 'ore_gold', count: 6 }, { blockId: 'ore_iron', count: 3 }], requiresWorkbench: true },
  { resultBlockId: 'ember_chest', resultCount: 1, ingredients: [{ blockId: 'ore_gold', count: 10 }, { blockId: 'ore_iron', count: 5 }], requiresWorkbench: true },
  { resultBlockId: 'ember_greaves', resultCount: 1, ingredients: [{ blockId: 'ore_gold', count: 8 }, { blockId: 'ore_iron', count: 3 }], requiresWorkbench: true },
  // 虚空套
  { resultBlockId: 'void_helm', resultCount: 1, ingredients: [{ blockId: 'void_crystal', count: 3 }, { blockId: 'dark_filament', count: 4 }], requiresWorkbench: true },
  { resultBlockId: 'void_chest', resultCount: 1, ingredients: [{ blockId: 'void_crystal', count: 5 }, { blockId: 'dark_filament', count: 7 }, { blockId: 'ore_gold', count: 4 }], requiresWorkbench: true },
  { resultBlockId: 'void_greaves', resultCount: 1, ingredients: [{ blockId: 'void_crystal', count: 4 }, { blockId: 'dark_filament', count: 5 }, { blockId: 'ore_gold', count: 3 }], requiresWorkbench: true },

  // === M27: 宝箱 ===
  { resultBlockId: 'chest', resultCount: 1, ingredients: [{ blockId: 'wreck_scrap', count: 6 }, { blockId: 'ore_iron', count: 1 }], requiresWorkbench: true },

  // === M28: 熔炉 + 锭锻造 ===
  { resultBlockId: 'furnace', resultCount: 1, ingredients: [{ blockId: 'wreck_hull', count: 4 }, { blockId: 'ore_copper', count: 5 }, { blockId: 'ember_ash', count: 3 }], requiresWorkbench: true },
  // 用锭锻造护甲（替代路径，与矿石配方并存）
  { resultBlockId: 'ember_helm', resultCount: 1, ingredients: [{ blockId: 'gold_bar', count: 4 }, { blockId: 'iron_bar', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'void_chest', resultCount: 1, ingredients: [{ blockId: 'void_bar', count: 5 }, { blockId: 'iron_bar', count: 4 }], requiresWorkbench: true },

  // === M30: 生命 / 魔力水晶 ===
  { resultBlockId: 'life_crystal', resultCount: 1, ingredients: [{ blockId: 'crystal_glow', count: 3 }, { blockId: 'bio_glow', count: 2 }, { blockId: 'ore_gold', count: 2 }], requiresWorkbench: true },
  { resultBlockId: 'mana_crystal', resultCount: 1, ingredients: [{ blockId: 'crystal_glow', count: 3 }, { blockId: 'bio_glow', count: 2 }, { blockId: 'void_crystal', count: 1 }], requiresWorkbench: true },

  // === M31: 种植 ===
  { resultBlockId: 'wheat_seed', resultCount: 3, ingredients: [{ blockId: 'ember_ash', count: 2 }, { blockId: 'bio_glow', count: 1 }], requiresWorkbench: true },
  { resultBlockId: 'health_potion', resultCount: 1, ingredients: [{ blockId: 'ember_wheat', count: 2 }, { blockId: 'crystal_glow', count: 1 }], requiresWorkbench: true },

  // === M32: 定居旗 ===
  { resultBlockId: 'settlement_flag', resultCount: 1, ingredients: [{ blockId: 'wreck_hull', count: 4 }, { blockId: 'iron_bar', count: 2 }, { blockId: 'ember_ash', count: 3 }], requiresWorkbench: true },
];

export function canCraft(recipe: Recipe, inv: Inventory, nearWorkbench: boolean): boolean {
  if (recipe.requiresWorkbench && !nearWorkbench) return false;
  for (const ing of recipe.ingredients) {
    if (inv.count(ing.blockId) < ing.count) return false;
  }
  return true;
}

export function craft(recipe: Recipe, inv: Inventory): boolean {
  for (const ing of recipe.ingredients) {
    let need = ing.count;
    for (const slot of [...inv.hotbar, ...inv.slots]) {
      if (need <= 0) break;
      if (slot.blockId === ing.blockId && slot.count > 0) {
        const take = Math.min(slot.count, need);
        slot.count -= take;
        need -= take;
        if (slot.count === 0) slot.blockId = '';
      }
    }
    if (need > 0) return false;
  }
  inv.add(recipe.resultBlockId, recipe.resultCount);
  return true;
}
