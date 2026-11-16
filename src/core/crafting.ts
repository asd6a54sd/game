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
