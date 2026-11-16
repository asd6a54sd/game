/**
 * 烬海纪元 · 宠物系统
 * ====================
 * 泰拉瑞亚式召唤宠物 — 选中宠物物品按 P 键召唤
 * - 光源宠物：跟随玩家，发出光晕（无战斗能力）
 * - 战斗召唤物：跟随玩家，自动攻击附近敌人
 */
import { Enemy } from './enemies.js';

export interface PetDef {
  id: string;
  name: string;
  emoji: string;
  paletteId: string;
  type: 'light' | 'combat';       // 光源宠物 / 战斗召唤物
  lightRadius?: number;           // 光源半径
  lightColor?: string;            // 光源颜色
  damage?: number;                // 战斗召唤物伤害
  attackRange?: number;           // 攻击距离
  attackCooldown?: number;        // 攻击间隔（秒）
  followSpeed: number;            // 跟随速度
  size: number;                   // 渲染尺寸
}

export const PET_DEFS: Record<string, PetDef> = {
  // 余烬精灵 — 暖光光源宠物
  ember_sprite: {
    id: 'ember_sprite', name: '余烬精灵', emoji: '🔥',
    paletteId: 'ember02', type: 'light',
    lightRadius: 80, lightColor: 'rgba(255, 160, 60, 0.35)',
    followSpeed: 200, size: 10,
  },
  // 幽蓝萤虫 — 冷光光源宠物
  glow_wisp: {
    id: 'glow_wisp', name: '幽蓝萤虫', emoji: '💫',
    paletteId: 'cold01', type: 'light',
    lightRadius: 90, lightColor: 'rgba(100, 200, 255, 0.35)',
    followSpeed: 220, size: 9,
  },
  // 虚空幼龙 — 战斗召唤物
  void_whelp: {
    id: 'void_whelp', name: '虚空幼龙', emoji: '🐲',
    paletteId: 'void02', type: 'combat',
    damage: 12, attackRange: 160, attackCooldown: 1.0,
    followSpeed: 180, size: 14,
  },
};

export interface Pet {
  defId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  attackTimer: number;
  bobPhase: number; // 上下浮动相位
}

/** 创建一只宠物 */
export function createPet(defId: string, x: number, y: number): Pet {
  return { defId, x, y, vx: 0, vy: 0, attackTimer: 0, bobPhase: Math.random() * Math.PI * 2 };
}

/**
 * 更新宠物 AI
 * - 光源宠物：平滑跟随玩家上方，上下浮动
 * - 战斗召唤物：跟随玩家，自动攻击附近敌人
 */
export function updatePet(
  pet: Pet,
  playerX: number,
  playerY: number,
  dt: number,
  enemies: Enemy[],
  onAttack: (targetX: number, targetY: number, damage: number) => void,
) {
  const def = PET_DEFS[pet.defId];
  if (!def) return;

  // 目标位置：玩家头顶上方一点
  const targetX = playerX;
  const targetY = playerY - 40 + Math.sin(pet.bobPhase) * 6;
  pet.bobPhase += dt * 3;

  // 平滑跟随
  const dx = targetX - pet.x;
  const dy = targetY - pet.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 2) {
    const speed = def.followSpeed;
    pet.vx = (dx / dist) * Math.min(speed, dist * 5);
    pet.vy = (dy / dist) * Math.min(speed, dist * 5);
  } else {
    pet.vx *= 0.8;
    pet.vy *= 0.8;
  }
  pet.x += pet.vx * dt;
  pet.y += pet.vy * dt;

  // 战斗召唤物：索敌攻击
  if (def.type === 'combat' && def.damage && def.attackRange && def.attackCooldown) {
    pet.attackTimer -= dt;
    if (pet.attackTimer <= 0) {
      // 找最近敌人
      let nearest: Enemy | null = null;
      let bestD = def.attackRange * def.attackRange;
      for (const e of enemies) {
        if (e.state === 'dead') continue;
        const d2 = (e.x - pet.x) ** 2 + (e.y - pet.y) ** 2;
        if (d2 < bestD) { bestD = d2; nearest = e; }
      }
      if (nearest) {
        onAttack(nearest.x, nearest.y, def.damage);
        pet.attackTimer = def.attackCooldown;
      }
    }
  }
}
