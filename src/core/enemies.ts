/**
 * 烬海纪元 · 敌人系统
 * Entity + System 分离
 */
import { PALETTE_MAP } from './palette.js';
import { TILE_SIZE } from './terrain.js';

export type EnemyBehavior = 'hopper' | 'chaser' | 'flyer';

export interface EnemyDef {
  type: string; name: string; paletteId: string; behavior: EnemyBehavior;
  hp: number; damage: number; speed: number; jumpForce: number;
  width: number; height: number;
  cooldownAttack: number; cooldownHurtFlash: number;
  dropTable?: { blockId: string; chance: number; count: number }[];
  spawnAtNight: boolean; spawnAtDay: boolean;
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  alloy_slime: { type: 'alloy_slime', name: '合金史莱姆', paletteId: 'cold02', behavior: 'hopper', hp: 12, damage: 4, speed: 120, jumpForce: 260, width: 20, height: 16, cooldownAttack: 0.8, cooldownHurtFlash: 0.25, dropTable: [{ blockId: 'ore_copper', chance: 0.5, count: 1 }, { blockId: 'wreck_scrap', chance: 0.4, count: 1 }], spawnAtNight: true, spawnAtDay: false },
  wreck_soldier: { type: 'wreck_soldier', name: '残躯兵', paletteId: 'iron03', behavior: 'chaser', hp: 22, damage: 6, speed: 90, jumpForce: 320, width: 12, height: 24, cooldownAttack: 0.6, cooldownHurtFlash: 0.25, dropTable: [{ blockId: 'ore_copper', chance: 0.7, count: 1 }, { blockId: 'wreck_scrap', chance: 0.5, count: 1 }], spawnAtNight: true, spawnAtDay: false },
  void_flyer: { type: 'void_flyer', name: '幽蓝飞虫', paletteId: 'void01', behavior: 'flyer', hp: 8, damage: 5, speed: 110, jumpForce: 0, width: 18, height: 12, cooldownAttack: 0.5, cooldownHurtFlash: 0.2, dropTable: [{ blockId: 'bio_glow', chance: 0.35, count: 1 }], spawnAtNight: true, spawnAtDay: true },
};

export interface Enemy {
  id: number; def: EnemyDef; x: number; y: number; vx: number; vy: number;
  hp: number; onGround: boolean; facing: 1 | -1;
  state: 'patrol' | 'chase' | 'attack' | 'dead';
  stateTimer: number; attackCooldown: number; hurtCooldown: number;
  flyPhase: number; deathProgress: number;
}

let enemyIdCounter = 1;

export function createEnemy(defType: string, x: number, y: number): Enemy {
  const def = ENEMY_DEFS[defType];
  return { id: enemyIdCounter++, def, x, y, vx: 0, vy: 0, hp: def.hp, onGround: false, facing: 1, state: 'patrol', stateTimer: 0, attackCooldown: 0, hurtCooldown: 0, flyPhase: Math.random() * Math.PI * 2, deathProgress: 0 };
}

export function enemyHalfW(e: Enemy): number { return e.def.width / 2; }
export function enemyHalfH(e: Enemy): number { return e.def.height / 2; }

export function enemySpriteColors(e: Enemy) {
  const main = PALETTE_MAP.get(e.def.paletteId) ?? '#888';
  let dark = main, eye = '#ff7a3a';
  if (e.def.paletteId.startsWith('cold')) dark = PALETTE_MAP.get('cold03') ?? '#3a94a8';
  else if (e.def.paletteId.startsWith('iron')) dark = PALETTE_MAP.get('iron04') ?? '#3a3f44';
  else if (e.def.paletteId.startsWith('void')) dark = PALETTE_MAP.get('void04') ?? '#2a0858';
  return { main, dark, eye };
}

export interface SpawnParams { timeOfDay: number; mapWidth: number; mapHeight: number; cameraX: number; cameraY: number; cameraW: number; cameraH: number; getBlock: (tx: number, ty: number) => string; isSolid: (tx: number, ty: number) => boolean; }

function findSpawnTile(px: number, py: number, mapW: number, mapH: number, isSolid: (x: number, y: number) => boolean): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 40; attempt++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const dist = 12 + Math.floor(Math.random() * 10);
    const tx = Math.max(2, Math.min(mapW - 2, Math.floor(px / TILE_SIZE) + side * dist));
    const ty = Math.max(2, Math.min(mapH - 2, Math.floor(py / TILE_SIZE) + (Math.random() - 0.5) * 8));
    if (!isSolid(tx, ty) && isSolid(tx, ty + 1)) return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  }
  return null;
}

export function trySpawnEnemy(existing: Enemy[], _count: number, player: { x: number; y: number }, params: SpawnParams): Enemy[] {
  if (existing.length >= 8) return [];
  const isNight = params.timeOfDay > 0.55 || params.timeOfDay < 0.1;
  let type: string;
  if (isNight) {
    const r = Math.random();
    type = r < 0.5 ? 'alloy_slime' : r < 0.8 ? 'wreck_soldier' : 'void_flyer';
  } else {
    type = 'void_flyer';
  }
  const pos = findSpawnTile(player.x, player.y, params.mapWidth, params.mapHeight, params.isSolid);
  if (!pos) return [];
  return [createEnemy(type, pos.x, pos.y - TILE_SIZE)];
}

export interface AIUpdateParams { dt: number; player: { x: number; y: number; width: number; height: number; onGround: boolean }; isSolid: (tx: number, ty: number) => boolean; onHitPlayer: (damage: number, dir: number, enemyId: number) => void; }

export function updateEnemy(e: Enemy, params: AIUpdateParams) {
  const { dt, player, isSolid } = params;
  if (e.state === 'dead') { e.deathProgress += dt * 3; return; }
  e.hurtCooldown = Math.max(0, e.hurtCooldown - dt);
  e.attackCooldown = Math.max(0, e.attackCooldown - dt);
  e.stateTimer += dt;
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 180) { if (e.state === 'patrol') { e.state = 'chase'; e.stateTimer = 0; } }
  else if (dist > 320) { if (e.state === 'chase') { e.state = 'patrol'; e.stateTimer = 0; } }
  if (dist < (enemyHalfW(e) + player.width / 2 + 4)) {
    if (e.attackCooldown <= 0) {
      params.onHitPlayer(e.def.damage, Math.sign(dx) || 1, e.id);
      e.attackCooldown = e.def.cooldownAttack; e.state = 'attack'; e.stateTimer = 0;
    }
  } else if (e.state === 'attack' && e.stateTimer > 0.2) { e.state = 'chase'; e.stateTimer = 0; }

  if (e.def.behavior === 'hopper') {
    if (e.stateTimer < 0.3) { e.vx *= 0.85; }
    else if (e.stateTimer < 0.32 && e.onGround) { e.vx = Math.sign(dx) * e.def.speed; e.vy = -e.def.jumpForce; e.onGround = false; }
    if (e.stateTimer > 1.2) e.stateTimer = 0;
  } else if (e.def.behavior === 'chaser') {
    e.vx = Math.sign(dx) * e.def.speed;
    if (e.onGround) {
      const ahead = Math.sign(e.vx || 1);
      const tx = Math.floor((e.x + ahead * (enemyHalfW(e) + 2)) / TILE_SIZE);
      const tyFoot = Math.floor(e.y / TILE_SIZE), tyHead = Math.floor((e.y - enemyHalfH(e)) / TILE_SIZE), tyAir = Math.floor((e.y - enemyHalfH(e) - TILE_SIZE) / TILE_SIZE);
      if (isSolid(tx, tyFoot) && isSolid(tx, tyHead) && !isSolid(tx, tyAir)) { e.vy = -e.def.jumpForce; e.onGround = false; }
    }
  } else if (e.def.behavior === 'flyer') {
    e.flyPhase += dt * 4;
    e.vx = Math.sign(dx) * e.def.speed * 0.7 + Math.sin(e.flyPhase) * 30;
    e.vy = Math.sign(dy) * e.def.speed * 0.5 + Math.cos(e.flyPhase * 0.7) * 40;
    if (Math.abs(dx) > 200) e.vx = Math.sign(dx) * e.def.speed;
  }

  if (e.def.behavior !== 'flyer') {
    e.vy += 1400 * dt; e.vy = Math.min(e.vy, 900);
    e.x += e.vx * dt; e.vx = 0;
    e.y += e.vy * dt; e.onGround = false; e.vy = 0;
  } else {
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.y < 20 * TILE_SIZE) e.y = 20 * TILE_SIZE;
  }
  e.facing = e.vx >= 0 ? 1 : -1;
}

export function hitEnemy(e: Enemy, damage: number, knockback: number, dir: 1 | -1): boolean {
  if (e.state === 'dead') return false;
  e.hp -= damage; e.hurtCooldown = e.def.cooldownHurtFlash;
  e.vx = dir * knockback; e.vy = -knockback * 0.6; e.stateTimer = 0;
  if (e.hp <= 0) { e.state = 'dead'; e.hp = 0; return true; }
  return false;
}
