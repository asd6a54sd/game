/**
 * 烬海纪元 · NPC 系统
 * ===================
 * 泰拉瑞亚式经济层 — NPC 商人提供买卖循环
 * 金币(gold_coin)作为通用货币
 */

export interface NpcDef {
  id: string;
  name: string;
  paletteId: string;
  shop: ShopItem[];
}

export interface ShopItem {
  blockId: string;      // 出售的物品 id
  buyPrice: number;     // 玩家购买价格（金币）
  sellPrice: number;    // 玩家出售价格（金币）
  stock: number;        // 库存（-1 = 无限）
}

/** 所有物品的出售价格表（玩家卖给商人时按此价）*/
export const SELL_PRICES: Record<string, number> = {
  // 基础材料
  wreck_scrap: 1, wreck_hull: 2, ember_ash: 1, fire_crack: 2,
  ore_copper: 3, ore_iron: 5, ore_gold: 12, ore_silver: 8,
  crystal_glow: 6, bio_glow: 4, void_crystal: 25, dark_filament: 15,
  dark_seed: 8, rust_iron: 4, wind_stone: 3, chitin: 5, bone: 4,
  golem_core: 20,
  // 工具
  copper_pickaxe: 15, iron_pickaxe: 35, ember_gold_pickaxe: 60,
  crystal_pickaxe: 120, void_pickaxe: 200,
  copper_sword: 12, iron_sword: 30, ember_gold_sword: 55, void_sword: 180,
  copper_bow: 15, void_crossbow: 100, void_staff: 150,
  // 弹药
  wooden_arrow: 1, dark_bolt: 3,
  // 饰品
  dash_boots: 40, regen_ring: 35, defense_charm: 45,
  magnet_crystal: 50, speed_glove: 30, wing_charm: 60,
  // M24: 鱼
  rust_scaled_fish: 5, rock_bone_fish: 6, gold_vein_fish: 10,
  glow_worm_fish: 8, shadow_eel: 12,
  liquid_metal_fish: 30, void_koi: 50,
  old_chest: 15,
  // M25: 宠物召唤物
  ember_sprite_summon: 25, glow_wisp_summon: 30, void_whelp_summon: 80,
  // M26: 护甲
  copper_helm: 10, copper_chest: 14, copper_greaves: 10,
  iron_helm: 20, iron_chest: 30, iron_greaves: 24,
  ember_helm: 45, ember_chest: 65, ember_greaves: 50,
  void_helm: 90, void_chest: 130, void_greaves: 100,
};

/** 商人商品列表（玩家可购买）*/
export const MERCHANT_SHOP: ShopItem[] = [
  // 弹药（无限库存，消耗品）
  { blockId: 'wooden_arrow', buyPrice: 2, sellPrice: 1, stock: -1 },
  { blockId: 'dark_bolt', buyPrice: 5, sellPrice: 3, stock: -1 },
  { blockId: 'purify_torch', buyPrice: 8, sellPrice: 4, stock: -1 },
  // 基础工具
  { blockId: 'copper_pickaxe', buyPrice: 25, sellPrice: 15, stock: 1 },
  { blockId: 'copper_sword', buyPrice: 20, sellPrice: 12, stock: 1 },
  { blockId: 'copper_bow', buyPrice: 25, sellPrice: 15, stock: 1 },
  // 稀有材料（高价）
  { blockId: 'ore_gold', buyPrice: 30, sellPrice: 12, stock: 3 },
  { blockId: 'crystal_glow', buyPrice: 15, sellPrice: 6, stock: 5 },
  { blockId: 'dark_seed', buyPrice: 20, sellPrice: 8, stock: 3 },
  // 饰品（偶尔刷新）
  { blockId: 'regen_ring', buyPrice: 80, sellPrice: 35, stock: 1 },
  { blockId: 'magnet_crystal', buyPrice: 100, sellPrice: 50, stock: 1 },
];

export const NPC_DEFS: Record<string, NpcDef> = {
  merchant: {
    id: 'merchant',
    name: '流浪商人',
    paletteId: 'gold01',
    shop: MERCHANT_SHOP,
  },
};
