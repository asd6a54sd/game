/**
 * 烬海纪元 · AI 队友系统
 * ====================
 * 区别泰拉瑞亚：不是静态商人 NPC，是可招募的**战斗伙伴**
 * - civilian：可招募的 NPC，站在固定位置待机（地底幽谷入口）
 * - companion：已招募的 AI 队友，跟随 + 自动索敌攻击
 * - 复用躯壳调色板渲染，同一套 sprite 逻辑
 */
import { MAP_WIDTH, TILE_SIZE } from './terrain.js';
import { ShellPalette, SHELL_COLORS } from './shells.js';

export type CompanionState = 'civilian' | 'follow' | 'attack' | 'stuck';
export type CompanionWeapon = 'melee' | 'ranged';

export interface CompanionDef {
  id: string;
  name: string;
  palette: ShellPalette; // 复用躯壳调色板
  weapon: CompanionWeapon;
  hp: number;
  speed: number;
  damage: number;
  attackRange: number;  // 攻击距离
  attackCooldown: number; // 秒
  recruitCost?: { blockId: string; count: number }; // 招募消耗
  desc: string;
}

export const COMPANION_DEFS: Record<string, CompanionDef> = {
  iron_guard: {
    id: 'iron_guard', name: '铁卫·烬', palette: 'iron',
    weapon: 'melee', hp: 60, speed: 140, damage: 10,
    attackRange: 28, attackCooldown: 0.8,
    recruitCost: { blockId: 'ore_iron', count: 5 },
    desc: '前叛军士兵，擅长近战格杀',
  },
  ember_mage: {
    id: 'ember_mage', name: '金焰·萤', palette: 'ember',
    weapon: 'ranged', hp: 35, speed: 160, damage: 7,
    attackRange: 180, attackCooldown: 1.0,
    recruitCost: { blockId: 'ore_gold', count: 3 },
    desc: '携带余金晶体，可远程射击',
  },
};

export interface Companion {
  id: number;
  def: CompanionDef;
  x: number; y: number;
  vx: number; vy: number;
  facing: 1 | -1;
  hp: number;
  state: CompanionState;
  onGround: boolean;
  attackTimer: number;
  hurtCooldown: number;
  // 攻击目标
  targetEnemyId: number | null;
  // 传送冷却（被卡住时）
  teleportCooldown: number;
  // 远程弹
  projCooldown: number;
}

let compIdCounter = 1;

export function createCivilian(defId: string, x: number, y: number): Companion {
  const def = COMPANION_DEFS[defId];
  return {
    id: compIdCounter++,
    def, x, y, vx: 0, vy: 0, facing: 1,
    hp: def.hp, state: 'civilian', onGround: false,
    attackTimer: 0, hurtCooldown: 0, targetEnemyId: null,
    teleportCooldown: 0, projCooldown: 0,
  };
}

export function recruitCompanion(c: Companion): Companion {
  c.state = 'follow';
  c.hp = c.def.hp;
  return c;
}

export function compHalfW(_c: Companion) { return TILE_SIZE * 0.75 / 2; }
export function compHalfH(_c: Companion) { return TILE_SIZE * 1.75 / 2; }

export interface CompAIParams {
  dt: number;
  player: { x: number; y: number };
  enemies: { id: number; x: number; y: number; hp: number }[];
  isSolid: (tx: number, ty: number) => boolean;
  onProj: (x: number, y: number, vx: number, vy: number, damage: number, fromCompanionId: number) => void;
}

export function updateCompanion(c: Companion, params: CompAIParams) {
  const { dt, player, enemies, isSolid, onProj } = params;

  c.hurtCooldown = Math.max(0, c.hurtCooldown - dt);
  c.attackTimer -= dt;
  c.projCooldown -= dt;
  c.teleportCooldown -= dt;

  if (c.hp <= 0) {
    // 死亡掉材料
    c.state = 'stuck'; // 标记为死，main 会清
    return;
  }

  if (c.state === 'civilian') {
    // 站在原地，偶尔转向
    if (Math.random() < 0.005) c.facing = c.facing === 1 ? -1 : 1;
    c.vy += 1200 * dt; c.vy = Math.min(c.vy, 600);
    c.y += c.vy * dt;
    // 落地
    const footTy = Math.floor((c.y + TILE_SIZE * 1.75 / 2) / TILE_SIZE);
    const tx = Math.floor(c.x / TILE_SIZE);
    if (isSolid(tx, footTy)) {
      c.y = footTy * TILE_SIZE - TILE_SIZE * 1.75 / 2;
      c.vy = 0; c.onGround = true;
    }
    return;
  }

  // ======== follow/attack ========
  const dx = player.x - c.x, dy = player.y - c.y;
  const distPlayer = Math.sqrt(dx * dx + dy * dy);

  // 寻找最近敌人
  let nearestEnemy: { id: number; x: number; y: number; hp: number; dist2: number } | null = null;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const d2 = (e.x - c.x) ** 2 + (e.y - c.y) ** 2;
    const sightRange = 250 * 250;
    if (d2 < sightRange && (!nearestEnemy || d2 < nearestEnemy.dist2)) {
      nearestEnemy = { ...e, dist2: d2 };
    }
  }

  if (nearestEnemy) {
    c.state = 'attack';
    c.facing = nearestEnemy.x >= c.x ? 1 : -1;
    const eDist = Math.sqrt(nearestEnemy.dist2);

    if (c.def.weapon === 'ranged') {
      // 远程：保持距离 + 射击
      if (eDist < 100) {
        c.vx = -Math.sign(nearestEnemy.x - c.x) * c.def.speed * 0.8;
      } else if (eDist > 180) {
        c.vx = Math.sign(nearestEnemy.x - c.x) * c.def.speed;
      } else {
        c.vx *= 0.8;
      }
      if (c.attackTimer <= 0 && eDist < c.def.attackRange) {
        c.attackTimer = c.def.attackCooldown;
        const angle = Math.atan2(nearestEnemy.y - c.y, nearestEnemy.x - c.x);
        onProj(c.x, c.y - 10, Math.cos(angle) * 250, Math.sin(angle) * 250, c.def.damage, c.id);
      }
    } else {
      // 近战：冲上去砍
      if (eDist > c.def.attackRange) {
        c.vx = Math.sign(nearestEnemy.x - c.x) * c.def.speed;
      } else {
        c.vx *= 0.7;
        if (c.attackTimer <= 0) {
          c.attackTimer = c.def.attackCooldown;
          // 近战命中由 main 处理（返回信号）
          // 简化：直接回调 onProj 但标记 melee
        }
      }
    }
  } else {
    c.state = 'follow';
    // 跟随玩家（保持 80 tile 左右距离）
    if (distPlayer > 150) {
      c.vx = Math.sign(dx) * c.def.speed;
      c.facing = dx >= 0 ? 1 : -1;
    } else if (distPlayer < 60) {
      c.vx = -Math.sign(dx) * c.def.speed * 0.6;
    } else {
      c.vx *= 0.6;
    }
    // 跳跃障碍
    const tx = Math.floor(c.x / TILE_SIZE);
    const headTy = Math.floor((c.y - TILE_SIZE) / TILE_SIZE);
    if (c.onGround && isSolid(tx + Math.sign(c.vx || 1), Math.floor(c.y / TILE_SIZE)) &&
        !isSolid(tx + Math.sign(c.vx || 1), headTy)) {
      c.vy = -350; c.onGround = false;
    }
  }

  // 被卡住传送
  if (distPlayer > 400 && c.teleportCooldown <= 0) {
    c.teleportCooldown = 5;
    c.x = player.x + (Math.random() - 0.5) * 40;
    c.y = player.y - 20 - Math.random() * 30;
    c.vx = 0; c.vy = 0;
    return;
  }

  // 重力
  c.vy += 1200 * dt; c.vy = Math.min(c.vy, 600);

  // 水平移动
  c.x += c.vx * dt;
  const halfW = compHalfW(c);
  const headTy2 = Math.floor((c.y - TILE_SIZE) / TILE_SIZE);
  const leftTx = Math.floor((c.x - halfW) / TILE_SIZE);
  const rightTx = Math.floor((c.x + halfW) / TILE_SIZE);
  for (const tx of [leftTx, rightTx]) {
    if (isSolid(tx, Math.floor(c.y / TILE_SIZE))) {
      if (c.vx > 0) c.x = tx * TILE_SIZE - halfW - 0.01;
      else if (c.vx < 0) c.x = (tx + 1) * TILE_SIZE + halfW + 0.01;
      c.vx = 0;
    }
  }

  // 垂直移动
  c.y += c.vy * dt;
  c.onGround = false;
  const footTy2 = Math.floor((c.y + TILE_SIZE * 1.75 / 2) / TILE_SIZE);
  for (let ty = headTy2; ty <= footTy2; ty++) {
    for (const tx of [leftTx, rightTx]) {
      if (isSolid(tx, ty)) {
        if (c.vy > 0) {
          c.y = ty * TILE_SIZE - TILE_SIZE * 1.75 / 2 - 0.01;
          c.onGround = true;
        } else if (c.vy < 0) {
          c.y = (ty + 1) * TILE_SIZE + TILE_SIZE * 1.75 / 2 + 0.01;
        }
        c.vy = 0;
      }
    }
  }

  c.x = Math.max(20, Math.min(MAP_WIDTH * TILE_SIZE - 20, c.x));
}

export function companionSpriteColors(c: Companion) {
  return SHELL_COLORS[c.def.palette];
}
