/**
 * 烬海纪元 · 玩家角色
 * 泰拉瑞亚式比例：1.25 tile 宽 × 2.6 tile 高（约 20×42 px）
 * —— 有清晰的头部 / 躯干 / 四肢分区，站在地表时约占 2.5 格高
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
  mana: number;        // M30: 当前魔力
  maxMana: number;     // M30: 魔力上限
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
  const w = TILE_SIZE * 1.25;
  const h = TILE_SIZE * 2.6;
  return {
    x: 16 * TILE_SIZE,
    y: 0,
    vx: 0, vy: 0,
    width: w, height: h,
    onGround: false,
    facing: 1,
    hp: 100, maxHp: 100,
    mana: 100, maxMana: 100,
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
  moveSpeed: 320,
  jumpSpeed: 450,
  airControl: 0.7,
  friction: 0.85,
};

export function updatePlayer(
  p: Player, dt: number, input: { left: boolean; right: boolean; jump: boolean; sprint: boolean },
  getTileSolid: (x: number, y: number) => boolean
) {
  // 卡进方块时先脱困 —— 避免被碰撞推挤到错误方向（按左反而向右弹飞）
  unstickPlayer(p, getTileSolid);

  // 水平
  const control = p.onGround ? 1 : PHYSICS.airControl;
  if (input.left) { p.vx -= p.moveSpeed * 8 * dt * control; p.facing = -1; }
  if (input.right) { p.vx += p.moveSpeed * 8 * dt * control; p.facing = 1; }

  p.vx = Math.max(-p.moveSpeed, Math.min(p.moveSpeed, p.vx));

  // 跳跃
  if (input.jump && p.onGround) {
    p.vy = -p.jumpSpeed;
    p.onGround = false;
  }

  // 重力（M13: 支持 gravityMult，rock_titan_crown 减轻 40%）
  p.vy += PHYSICS.gravity * (p.gravityMult ?? 1) * dt;
  p.vy = Math.min(p.vy, 900);

  // 碰撞检测（分轴 + 分段推进）
  // 低帧率下高速移动可能一帧跨过 1 格薄墙，这里按半格步长拆分，杜绝穿墙/卡墙
  const maxStep = TILE_SIZE * 0.5;
  let remainX = p.vx * dt;
  while (Math.abs(remainX) > 0.0001) {
    const step = Math.max(-maxStep, Math.min(maxStep, remainX));
    moveAndCollide(p, step, 0, getTileSolid);
    remainX -= step;
    if (p.vx === 0) break;
  }
  p.onGround = false;
  let remainY = p.vy * dt;
  while (Math.abs(remainY) > 0.0001) {
    const step = Math.max(-maxStep, Math.min(maxStep, remainY));
    moveAndCollide(p, 0, step, getTileSolid);
    remainY -= step;
    if (p.vy === 0) break;
  }

  // 出界复活
  if (p.y > MAP_HEIGHT * TILE_SIZE + 200) {
    p.x = 16 * TILE_SIZE;
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

/** 玩家 AABB 与某格是否有实际重叠（内缩 1px，避免贴边误判） */
export function playerOverlapsTile(p: Player, tx: number, ty: number): boolean {
  const halfW = p.width / 2, halfH = p.height / 2;
  const eps = 1;
  return p.x + halfW - eps > tx * TILE_SIZE
    && p.x - halfW + eps < (tx + 1) * TILE_SIZE
    && p.y + halfH - eps > ty * TILE_SIZE
    && p.y - halfH + eps < (ty + 1) * TILE_SIZE;
}

/** 判断玩家当前位置是否卡在实体方块里 */
function overlapsSolid(
  p: Player, isSolid: (x: number, y: number) => boolean,
): boolean {
  const halfW = p.width / 2, halfH = p.height / 2;
  const left = Math.floor((p.x - halfW) / TILE_SIZE);
  const right = Math.floor((p.x + halfW - 0.01) / TILE_SIZE);
  const top = Math.floor((p.y - halfH) / TILE_SIZE);
  const bottom = Math.floor((p.y + halfH - 0.01) / TILE_SIZE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, ty)) return true;
    }
  }
  return false;
}

/**
 * 脱困：若玩家被卡进方块，向最近的可站立空位弹出
 * 优先向上（多数情况是脚下/头部被埋），其次左右，最后向下
 */
export function unstickPlayer(
  p: Player, isSolid: (x: number, y: number) => boolean,
): boolean {
  if (!overlapsSolid(p, isSolid)) return false;
  const ox = p.x, oy = p.y;
  const step = 2;
  for (let r = step; r <= 192; r += step) {
    const candidates: [number, number][] = [[0, -r], [-r, 0], [r, 0], [0, r]];
    for (const [dx, dy] of candidates) {
      p.x = ox + dx;
      p.y = oy + dy;
      if (!overlapsSolid(p, isSolid)) {
        p.vx = 0;
        p.vy = 0;
        p.onGround = false;
        return true;
      }
    }
  }
  p.x = ox;
  p.y = oy;
  return false;
}

export { biToBlock };
