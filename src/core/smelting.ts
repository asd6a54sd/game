/**
 * 烬海纪元 · 熔炉冶炼系统
 * ====================
 * 泰拉瑞亚式熔炉流水线：矿石 + 燃料 → 冶炼 → 金属锭
 * 放置熔炉方块，按 L 键打开熔炉界面，点击配方开始冶炼（有进度条）
 * 一次只能冶炼一炉，完成后产物自动入背包
 */
import { Inventory } from './inventory.js';

export interface SmeltRecipe {
  id: string;
  name: string;
  inputBlockId: string;
  inputCount: number;
  outputBlockId: string;
  outputCount: number;
  fuelBlockId: string;
  fuelCount: number;
  duration: number; // 冶炼耗时（秒）
}

export const SMELT_RECIPES: SmeltRecipe[] = [
  {
    id: 'smelt_copper', name: '铜锭冶炼',
    inputBlockId: 'ore_copper', inputCount: 2,
    outputBlockId: 'copper_bar', outputCount: 1,
    fuelBlockId: 'ember_ash', fuelCount: 1, duration: 2,
  },
  {
    id: 'smelt_iron', name: '铁锭冶炼',
    inputBlockId: 'ore_iron', inputCount: 2,
    outputBlockId: 'iron_bar', outputCount: 1,
    fuelBlockId: 'ember_ash', fuelCount: 1, duration: 2.5,
  },
  {
    id: 'smelt_gold', name: '金锭冶炼',
    inputBlockId: 'ore_gold', inputCount: 2,
    outputBlockId: 'gold_bar', outputCount: 1,
    fuelBlockId: 'ember_ash', fuelCount: 1, duration: 3,
  },
  {
    id: 'smelt_void', name: '虚空锭冶炼',
    inputBlockId: 'void_crystal', inputCount: 2,
    outputBlockId: 'void_bar', outputCount: 1,
    fuelBlockId: 'ember_ash', fuelCount: 2, duration: 4,
  },
];

export interface SmeltJob {
  recipeId: string;
  progress: number;  // 已冶炼秒数
  duration: number;
}

/** 判断是否满足冶炼条件（材料 + 燃料） */
export function canSmelt(recipe: SmeltRecipe, inv: Inventory): boolean {
  return inv.count(recipe.inputBlockId) >= recipe.inputCount
    && inv.count(recipe.fuelBlockId) >= recipe.fuelCount;
}

export class SmeltManager {
  job: SmeltJob | null = null;

  /** 开始冶炼（消耗材料与燃料），已在冶炼中或材料不足返回 false */
  start(recipeId: string, inv: Inventory): boolean {
    if (this.job) return false;
    const recipe = SMELT_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;
    if (!canSmelt(recipe, inv)) return false;
    inv.consume(recipe.inputBlockId, recipe.inputCount);
    inv.consume(recipe.fuelBlockId, recipe.fuelCount);
    this.job = { recipeId, progress: 0, duration: recipe.duration };
    return true;
  }

  /**
   * 推进冶炼。完成时返回产物 { blockId, count }，否则返回 null
   */
  update(dt: number): { blockId: string; count: number } | null {
    if (!this.job) return null;
    this.job.progress += dt;
    if (this.job.progress >= this.job.duration) {
      const recipe = SMELT_RECIPES.find(r => r.id === this.job!.recipeId);
      this.job = null;
      if (!recipe) return null;
      return { blockId: recipe.outputBlockId, count: recipe.outputCount };
    }
    return null;
  }

  /** 当前进度比例 0-1 */
  get progressRatio(): number {
    if (!this.job) return 0;
    return Math.min(1, this.job.progress / this.job.duration);
  }

  cancel() {
    // 取消时材料不返还（防止刷材料漏洞）
    this.job = null;
  }
}
