/**
 * 烬海纪元 · 工具系统
 * 泰拉瑞亚式挖掘速度 — 镐等级 × 硬度
 */

export interface ToolDef {
  id: string;
  name: string;
  pickaxePower: number;   // 等级 0-5（能挖 hardness ≤ power*10 的矿）
  miningSpeed: number;    // 每秒破坏能量（基础 = 8）
  damage: number;         // 近战/远程伤害
  paletteId: string;      // 调色板 id
  category: 'pickaxe' | 'axe' | 'hammer' | 'sword' | 'ranged' | 'fishing';
  // M18: 远程武器专用
  ammoType?: string;      // 弹药方块 id（ranged 必须）
  shootCooldown?: number; // 射击间隔（秒）
  projectileSpeed?: number; // 弹丸速度 px/s
  piercing?: boolean;     // 弹丸是否穿透（暗焰法杖）
  // M24: 钓鱼竿专用
  rodQuality?: number;    // 钓鱼竿品质（1=基础, 2=强化）
}

export const TOOLS: Record<string, ToolDef> = {
  // === 镐 ===
  hand_pickaxe: { id: 'hand_pickaxe', name: '徒手', pickaxePower: 0, miningSpeed: 8, damage: 2, paletteId: 'bone02', category: 'pickaxe' },
  copper_pickaxe: { id: 'copper_pickaxe', name: '铜镐', pickaxePower: 1, miningSpeed: 14, damage: 4, paletteId: 'rust02', category: 'pickaxe' },
  iron_pickaxe: { id: 'iron_pickaxe', name: '铁镐', pickaxePower: 2, miningSpeed: 22, damage: 7, paletteId: 'iron01', category: 'pickaxe' },
  ember_pickaxe: { id: 'ember_pickaxe', name: '余金镐', pickaxePower: 3, miningSpeed: 32, damage: 12, paletteId: 'ember02', category: 'pickaxe' },
  crystal_pickaxe: { id: 'crystal_pickaxe', name: '晶体镐', pickaxePower: 4, miningSpeed: 48, damage: 18, paletteId: 'cold01', category: 'pickaxe' },
  void_pickaxe: { id: 'void_pickaxe', name: '暗能镐', pickaxePower: 5, miningSpeed: 64, damage: 26, paletteId: 'void02', category: 'pickaxe' },

  // === 剑 ===
  copper_sword: { id: 'copper_sword', name: '铜剑', pickaxePower: 0, miningSpeed: 6, damage: 8, paletteId: 'rust02', category: 'sword' },
  iron_sword: { id: 'iron_sword', name: '铁剑', pickaxePower: 0, miningSpeed: 6, damage: 14, paletteId: 'iron01', category: 'sword' },
  ember_sword: { id: 'ember_sword', name: '余金剑', pickaxePower: 0, miningSpeed: 6, damage: 22, paletteId: 'ember02', category: 'sword' },
  void_sword: { id: 'void_sword', name: '暗能剑', pickaxePower: 0, miningSpeed: 6, damage: 34, paletteId: 'void03', category: 'sword' },

  // === M18: 远程武器 ===
  copper_bow: {
    id: 'copper_bow', name: '铜弓',
    pickaxePower: 0, miningSpeed: 4, damage: 10,
    paletteId: 'rust02', category: 'ranged',
    ammoType: 'wooden_arrow', shootCooldown: 0.5, projectileSpeed: 500,
  },
  void_crossbow: {
    id: 'void_crossbow', name: '虚空弩',
    pickaxePower: 0, miningSpeed: 4, damage: 22,
    paletteId: 'void01', category: 'ranged',
    ammoType: 'wooden_arrow', shootCooldown: 0.7, projectileSpeed: 650,
  },
  void_staff: {
    id: 'void_staff', name: '暗焰法杖',
    pickaxePower: 0, miningSpeed: 4, damage: 18,
    paletteId: 'void03', category: 'ranged',
    ammoType: 'dark_bolt', shootCooldown: 0.4, projectileSpeed: 420, piercing: true,
  },

  // === M24: 钓鱼竿 ===
  basic_fishing_rod: {
    id: 'basic_fishing_rod', name: '基础钓鱼竿',
    pickaxePower: 0, miningSpeed: 4, damage: 3,
    paletteId: 'rust02', category: 'fishing',
    rodQuality: 1,
  },
  reinforced_fishing_rod: {
    id: 'reinforced_fishing_rod', name: '强化钓鱼竿',
    pickaxePower: 0, miningSpeed: 4, damage: 5,
    paletteId: 'iron01', category: 'fishing',
    rodQuality: 2,
  },
};

/**
 * 计算实际破坏速度倍率
 * 工具等级不足则无法破坏（返回 -1）
 */
export function calcBreakSpeed(toolId: string, blockToolLevel: number): number {
  const tool = TOOLS[toolId];
  if (!tool) return 0;
  if (tool.pickaxePower < blockToolLevel) return -1; // 挖不动
  return tool.miningSpeed;
}

export function getTool(id: string): ToolDef {
  return TOOLS[id] ?? TOOLS.hand_pickaxe;
}
