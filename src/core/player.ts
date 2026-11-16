/**
 * 烬海纪元 · 玩家角色
 * 最左侧留角色剪影做比例锚点 —— 本玩家尺寸: 0.75 tile 宽 × 1.75 tile 高
 */
import { TILE_SIZE } from './terrain.js';
import { isSolid } from './blocks.js';
import { biToBlock, MAP_WIDTH, MAP_HEIGHT } from './terrain.js';
import { ActiveBuff } from './potions.js';

export interface Player {
  x: number;          // pixel center
  y: number;          // pixel center (feet at bottom)
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  jumpSpeed: number;
  gravityMult: number;     // M13: 重力倍率（rock_titan_crown 减轻重力）
  breakProgress: number;     // 当前破坏进度 0-1
  breakingTile: { x: number; y: number } | null;
  breakCooldown: number;    // 破坏间隔
  activeBuffs: ActiveBuff[]; // M22: 临时药水 buff
  mounted: boolean;          // M23: 是否骑乘
  mountId: string | null;    // M23: 当前坐骑 id
}

export function createPlayer(): Player {
  const w = TILE_SIZE * 0.75;
  const h = TILE_SIZE * 1.75;
  return {
    x: 3 * TILE_SIZE,
    y: 0,
    vx: 0, vy: 0,
    width: w, height: h,
    onGround: false,
    facing: 1,
    hp: 100, maxHp: 100,
    moveSpeed: PHYSICS.moveSpeed,
    jumpSpeed: PHYSICS.jumpSpeed,
    gravityMult: 1,
    breakProgress: 0,
    breakingTile: null,
    breakCooldown: 0,
    activeBuffs: [],
    mounted: false,
    mountId: null,
  };
}

export function placePlayerOnGround(p: Player, heightMap: Uint8Array) {
  const col = Math.floor(p.x / TILE_SIZE);
  const sy = heightMap[Math.max(0, Math.min(MAP_WIDTH - 1, col))];
  p.y = sy * TILE_SIZE - p.height / 2;
}

export const PHYSICS = {
  gravity: 1400,
  moveSpeed: 180,
  jumpSpeed: 380,
  airControl: 0.6,
  friction: 0.85,
};

export function updatePlayer(
  p: Player, dt: number, input: { left: boolean; right: boolean; jump: boolean; brake: boolean },
  getTileSolid: (x: number, y: number) => boolean
) {
  // 水平
  const control = p.onGround ? 1 : PHYSICS.airControl;
  if (input.left) { p.vx -= p.moveSpeed * 8 * dt * control; p.facing = -1; }
  if (input.right) { p.vx += p.moveSpeed * 8 * dt * control; p.facing = 1; }
  if (input.brake && p.onGround) p.vx *= PHYSICS.friction;

  p.vx = Math.max(-p.moveSpeed, Math.min(p.moveSpeed, p.vx));

  // 跳跃
  if (input.jump && p.onGround) {
    p.vy = -p.jumpSpeed;
    p.onGround = false;
  }

  // 重力（M13: 支持 gravityMult，rock_titan_crown 减轻 40%）
  p.vy += PHYSICS.gravity * (p.gravityMult ?? 1) * dt;
  p.vy = Math.min(p.vy, 900);

  // 碰撞检测（分轴）
  moveAndCollide(p, p.vx * dt, 0, getTileSolid);
  p.onGround = false;
  moveAndCollide(p, 0, p.vy * dt, getTileSolid);

  // 出界复活
  if (p.y > MAP_HEIGHT * TILE_SIZE + 200) {
    p.x = 3 * TILE_SIZE;
    p.y = 50 * TILE_SIZE;
    p.vx = p.vy = 0;
  }

  if (p.breakCooldown > 0) p.breakCooldown -= dt;
}

function moveAndCollide(p: Player, dx: number, dy: number, isSolid: (x: number, y: number) => boolean) {
  p.x += dx;
  p.y += dy;

  // AABB
  const halfW = p.width / 2, halfH = p.height / 2;
  const left = Math.floor((p.x - halfW) / TILE_SIZE);
  const right = Math.floor((p.x + halfW - 0.01) / TILE_SIZE);
  const top = Math.floor((p.y - halfH) / TILE_SIZE);
  const bottom = Math.floor((p.y + halfH - 0.01) / TILE_SIZE);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, ty)) {
        // 回推
        if (dx > 0) p.x = tx * TILE_SIZE - halfW - 0.01;
        else if (dx < 0) p.x = (tx + 1) * TILE_SIZE + halfW + 0.01;
        p.vx = 0;
      }
    }
  }

  const left2 = Math.floor((p.x - halfW) / TILE_SIZE);
  const right2 = Math.floor((p.x + halfW - 0.01) / TILE_SIZE);
  const top2 = Math.floor((p.y - halfH) / TILE_SIZE);
  const bottom2 = Math.floor((p.y + halfH - 0.01) / TILE_SIZE);

  for (let ty = top2; ty <= bottom2; ty++) {
    for (let tx = left2; tx <= right2; tx++) {
      if (isSolid(tx, ty)) {
        if (dy > 0) {
          p.y = ty * TILE_SIZE - halfH - 0.01;
          p.onGround = true;
        } else if (dy < 0) {
          p.y = (ty + 1) * TILE_SIZE + halfH + 0.01;
        }
        p.vy = 0;
      }
    }
  }
}

export function blockAABB(id: string, tx: number, ty: number, px: number, py: number): boolean {
  if (!isSolid(id)) return false;
  const bx = tx * TILE_SIZE, by = ty * TILE_SIZE;
  const bw = TILE_SIZE, bh = TILE_SIZE;
  return px < bx + bw && px + 1 > bx && py < by + bh && py + 1 > by;
}

export { biToBlock };
