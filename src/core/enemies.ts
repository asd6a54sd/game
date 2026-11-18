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
  accessoryDropChance?: number; // 精英敌人掉普通饰品的概率（0-1）
  spawnAtNight: boolean; spawnAtDay: boolean;
  isElite?: boolean; // 精英标记（血更厚、发光描边）
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  // === wreck_zone 残骸带 ===
  alloy_slime: { type: 'alloy_slime', name: '合金史莱姆', paletteId: 'cold02', behavior: 'hopper', hp: 12, damage: 4, speed: 120, jumpForce: 260, width: 20, height: 16, cooldownAttack: 0.8, cooldownHurtFlash: 0.25, dropTable: [{ blockId: 'ore_copper', chance: 0.5, count: 1 }, { blockId: 'wreck_scrap', chance: 0.4, count: 1 }], spawnAtNight: true, spawnAtDay: false },
  wreck_soldier: { type: 'wreck_soldier', name: '残躯兵', paletteId: 'iron03', behavior: 'chaser', hp: 22, damage: 6, speed: 90, jumpForce: 320, width: 12, height: 24, cooldownAttack: 0.6, cooldownHurtFlash: 0.25, dropTable: [{ blockId: 'ore_copper', chance: 0.7, count: 1 }, { blockId: 'wreck_scrap', chance: 0.5, count: 1 }], spawnAtNight: true, spawnAtDay: false },
  wreck_drone: { type: 'wreck_drone', name: '残骸无人机', paletteId: 'iron02', behavior: 'flyer', hp: 14, damage: 5, speed: 140, jumpForce: 0, width: 16, height: 12, cooldownAttack: 0.5, cooldownHurtFlash: 0.2, dropTable: [{ blockId: 'wreck_scrap', chance: 0.8, count: 1 }, { blockId: 'ore_copper', chance: 0.3, count: 1 }], spawnAtNight: true, spawnAtDay: true },

  // === crack_waste 龟裂荒原 ===
  wind_scorpion: { type: 'wind_scorpion', name: '风蝎', paletteId: 'rust04', behavior: 'hopper', hp: 18, damage: 7, speed: 160, jumpForce: 300, width: 22, height: 14, cooldownAttack: 0.7, cooldownHurtFlash: 0.25, dropTable: [{ blockId: 'wind_rock', chance: 0.9, count: 1 }, { blockId: 'ore_copper', chance: 0.25, count: 1 }], spawnAtNight: true, spawnAtDay: false },
  dust_wraith: { type: 'dust_wraith', name: '尘影', paletteId: 'bone04', behavior: 'chaser', hp: 30, damage: 8, speed: 70, jumpForce: 380, width: 14, height: 26, cooldownAttack: 0.9, cooldownHurtFlash: 0.3, dropTable: [{ blockId: 'wind_rock', chance: 0.7, count: 2 }, { blockId: 'cracked_ground', chance: 0.5, count: 1 }], spawnAtNight: true, spawnAtDay: false },

  // === gobi_mine 戈壁矿脉 ===
  rock_golem: { type: 'rock_golem', name: '岩石傀儡', paletteId: 'bone05', behavior: 'chaser', hp: 50, damage: 14, speed: 55, jumpForce: 280, width: 20, height: 28, cooldownAttack: 1.2, cooldownHurtFlash: 0.4, dropTable: [{ blockId: 'ore_rock', chance: 1.0, count: 2 }, { blockId: 'ore_iron', chance: 0.5, count: 1 }], spawnAtNight: true, spawnAtDay: true },
  gem_eye: { type: 'gem_eye', name: '晶眼', paletteId: 'cold02', behavior: 'flyer', hp: 10, damage: 6, speed: 130, jumpForce: 0, width: 18, height: 14, cooldownAttack: 0.6, cooldownHurtFlash: 0.2, dropTable: [{ blockId: 'crystal_glow', chance: 0.5, count: 1 }, { blockId: 'ore_gold', chance: 0.2, count: 1 }], spawnAtNight: true, spawnAtDay: true },

  // === silent_sea 无声海 ===
  metal_serpent: { type: 'metal_serpent', name: '金属游蛇', paletteId: 'cold01', behavior: 'flyer', hp: 16, damage: 9, speed: 180, jumpForce: 0, width: 24, height: 10, cooldownAttack: 0.4, cooldownHurtFlash: 0.2, dropTable: [{ blockId: 'metal_float', chance: 0.7, count: 1 }, { blockId: 'ore_iron', chance: 0.4, count: 1 }], spawnAtNight: true, spawnAtDay: true },
  cold_hunter: { type: 'cold_hunter', name: '冷海猎手', paletteId: 'cold03', behavior: 'chaser', hp: 35, damage: 11, speed: 100, jumpForce: 340, width: 14, height: 26, cooldownAttack: 0.7, cooldownHurtFlash: 0.3, dropTable: [{ blockId: 'liquid_metal', chance: 0.5, count: 1 }, { blockId: 'crystal_glow', chance: 0.3, count: 1 }], spawnAtNight: true, spawnAtDay: false },

  // === beast_hive 异兽巢穴 ===
  chitin_beetle: { type: 'chitin_beetle', name: '甲壳甲虫', paletteId: 'bone01', behavior: 'hopper', hp: 28, damage: 8, speed: 130, jumpForce: 280, width: 22, height: 18, cooldownAttack: 0.8, cooldownHurtFlash: 0.3, dropTable: [{ blockId: 'chitin_hive', chance: 0.8, count: 1 }, { blockId: 'bio_glow', chance: 0.25, count: 1 }], spawnAtNight: true, spawnAtDay: false },
  hive_stalker: { type: 'hive_stalker', name: '巢穴潜伏者', paletteId: 'void02', behavior: 'chaser', hp: 40, damage: 12, speed: 110, jumpForce: 400, width: 12, height: 28, cooldownAttack: 0.6, cooldownHurtFlash: 0.3, dropTable: [{ blockId: 'chitin_hive', chance: 0.6, count: 2 }, { blockId: 'bio_glow', chance: 0.5, count: 1 }], spawnAtNight: true, spawnAtDay: true },

  // === underground_valley 地底幽谷 ===
  void_flyer: { type: 'void_flyer', name: '幽蓝飞虫', paletteId: 'void01', behavior: 'flyer', hp: 8, damage: 5, speed: 110, jumpForce: 0, width: 18, height: 12, cooldownAttack: 0.5, cooldownHurtFlash: 0.2, dropTable: [{ blockId: 'bio_glow', chance: 0.35, count: 1 }], spawnAtNight: true, spawnAtDay: true },
  void_wraith: { type: 'void_wraith', name: '暗能游魂', paletteId: 'void04', behavior: 'flyer', hp: 26, damage: 13, speed: 170, jumpForce: 0, width: 22, height: 16, cooldownAttack: 0.7, cooldownHurtFlash: 0.3, dropTable: [{ blockId: 'dark_seed', chance: 0.6, count: 1 }, { blockId: 'void_crystal', chance: 0.2, count: 1 }], spawnAtNight: true, spawnAtDay: true },
  rebel_ghost: { type: 'rebel_ghost', name: '叛影', paletteId: 'iron05', behavior: 'chaser', hp: 45, damage: 15, speed: 95, jumpForce: 360, width: 14, height: 28, cooldownAttack: 0.8, cooldownHurtFlash: 0.35, dropTable: [{ blockId: 'rebel_brick', chance: 0.8, count: 1 }, { blockId: 'ore_iron', chance: 0.5, count: 1 }], spawnAtNight: true, spawnAtDay: false },

  // === M13: 精英敌人（夜间专属） ===
  elite_iron_tyrant: { type: 'elite_iron_tyrant', name: '钢铁暴君', paletteId: 'iron01', behavior: 'chaser', hp: 120, damage: 22, speed: 110, jumpForce: 400, width: 24, height: 36, cooldownAttack: 0.6, cooldownHurtFlash: 0.4, dropTable: [{ blockId: 'ore_iron', chance: 1.0, count: 2 }, { blockId: 'ore_gold', chance: 0.5, count: 1 }, { blockId: 'wreck_scrap', chance: 1.0, count: 3 }], accessoryDropChance: 0.08, spawnAtNight: true, spawnAtDay: false, isElite: true },
  elite_void_ravager: { type: 'elite_void_ravager', name: '虚空屠戮者', paletteId: 'void04', behavior: 'flyer', hp: 90, damage: 18, speed: 200, jumpForce: 0, width: 28, height: 20, cooldownAttack: 0.5, cooldownHurtFlash: 0.35, dropTable: [{ blockId: 'dark_seed', chance: 1.0, count: 2 }, { blockId: 'void_crystal', chance: 0.4, count: 1 }], accessoryDropChance: 0.12, spawnAtNight: true, spawnAtDay: false, isElite: true },
  elite_chitin_queen: { type: 'elite_chitin_queen', name: '蜂巢女王', paletteId: 'bone01', behavior: 'hopper', hp: 140, damage: 20, speed: 180, jumpForce: 360, width: 30, height: 24, cooldownAttack: 0.7, cooldownHurtFlash: 0.4, dropTable: [{ blockId: 'chitin_hive', chance: 1.0, count: 3 }, { blockId: 'bio_glow', chance: 0.8, count: 2 }], accessoryDropChance: 0.10, spawnAtNight: true, spawnAtDay: false, isElite: true },

  // === 大框架: 地牢守卫（未击败骷髅王闯入地牢时生成，几乎不可击杀）===
  dungeon_guardian: { type: 'dungeon_guardian', name: '地牢守卫', paletteId: 'void04', behavior: 'chaser', hp: 99999, damage: 9999, speed: 300, jumpForce: 520, width: 40, height: 56, cooldownAttack: 0.5, cooldownHurtFlash: 0.1, spawnAtNight: true, spawnAtDay: true, isElite: true },
};

export interface Enemy {
  id: number; def: EnemyDef; x: number; y: number; vx: number; vy: number;
  hp: number; onGround: boolean; facing: 1 | -1;
  state: 'patrol' | 'chase' | 'attack' | 'dead';
  stateTimer: number; attackCooldown: number; hurtCooldown: number;
  flyPhase: number; deathProgress: number;
  isElite: boolean; // M13: 精英敌人（发光描边）
  // M16: 持续伤害 DoT（毒刺护符等触发）
  dotDps: number;
  dotDuration: number;
  dotTick: number; // 上次 tick 计时
  dotTotalDmg: number; // 累计已掉血（用于 HUD 显示）
}

let enemyIdCounter = 1;

export function createEnemy(defType: string, x: number, y: number): Enemy {
  const def = ENEMY_DEFS[defType];
  return {
    id: enemyIdCounter++, def, x, y, vx: 0, vy: 0,
    hp: def.hp, onGround: false, facing: 1,
    state: 'patrol', stateTimer: 0, attackCooldown: 0, hurtCooldown: 0,
    flyPhase: Math.random() * Math.PI * 2, deathProgress: 0,
    isElite: !!def.isElite,
    dotDps: 0, dotDuration: 0, dotTick: 0, dotTotalDmg: 0,
  };
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

// 区块 → 敌人类型池（白天/夜间权重 + 精英池）
const REGION_ENEMY_POOL: Record<string, { day: string[]; night: string[]; elite: string[] }> = {
  wreck_zone: { day: ['wreck_drone'], night: ['alloy_slime', 'wreck_soldier', 'wreck_drone'], elite: ['elite_iron_tyrant'] },
  crack_waste: { day: [], night: ['wind_scorpion', 'dust_wraith'], elite: ['elite_iron_tyrant'] },
  gobi_mine: { day: ['rock_golem', 'gem_eye'], night: ['rock_golem', 'gem_eye', 'dust_wraith'], elite: ['elite_iron_tyrant'] },
  silent_sea: { day: ['metal_serpent', 'cold_hunter'], night: ['metal_serpent', 'cold_hunter'], elite: ['elite_void_ravager'] },
  beast_hive: { day: ['hive_stalker'], night: ['chitin_beetle', 'hive_stalker'], elite: ['elite_chitin_queen'] },
  underground_valley: { day: ['void_flyer'], night: ['void_flyer', 'void_wraith', 'rebel_ghost'], elite: ['elite_void_ravager'] },
  frozen_waste: { day: ['cold_hunter'], night: ['cold_hunter', 'metal_serpent'], elite: ['elite_iron_tyrant'] },
  ash_volcano: { day: ['rock_golem', 'gem_eye'], night: ['rock_golem', 'gem_eye'], elite: ['elite_iron_tyrant'] },
  rot_mire: { day: ['chitin_beetle'], night: ['hive_stalker', 'chitin_beetle', 'dust_wraith'], elite: ['elite_chitin_queen'] },
  ashen_court: { day: ['wreck_soldier'], night: ['wreck_soldier', 'dust_wraith', 'rebel_ghost'], elite: ['elite_iron_tyrant'] },
};

function regionColToRegion(pxCol: number): string {
  // REGIONS startCol / endCol 对应区块
  if (pxCol < 60) return 'wreck_zone';
  if (pxCol < 120) return 'crack_waste';
  if (pxCol < 180) return 'gobi_mine';
  if (pxCol < 240) return 'silent_sea';
  if (pxCol < 300) return 'beast_hive';
  if (pxCol < 360) return 'underground_valley';
  if (pxCol < 420) return 'frozen_waste';
  if (pxCol < 480) return 'ash_volcano';
  if (pxCol < 540) return 'rot_mire';
  return 'ashen_court';
}

export function trySpawnEnemy(existing: Enemy[], _count: number, player: { x: number; y: number }, params: SpawnParams): Enemy[] {
  if (existing.length >= 10) return [];

  const isNight = params.timeOfDay > 0.55 || params.timeOfDay < 0.1;
  const playerCol = Math.floor(player.x / TILE_SIZE);
  const region = regionColToRegion(playerCol);

  // 选敌人类型
  const pool = REGION_ENEMY_POOL[region] ?? { day: [], night: ['void_flyer'], elite: [] };
  let candidates = isNight ? pool.night : pool.day;
  if (candidates.length === 0) candidates = pool.night;
  if (candidates.length === 0) candidates = ['void_flyer', 'alloy_slime'];

  // M13: 夜间有 15% 几率刷精英（存在精英时降低几率到 5%）
  const existingElites = existing.filter(e => e.isElite).length;
  if (isNight && pool.elite.length > 0 && Math.random() < (existingElites > 0 ? 0.05 : 0.15)) {
    candidates = pool.elite;
  }

  const type = candidates[Math.floor(Math.random() * candidates.length)];
  const def = ENEMY_DEFS[type];
  if (!def) return [];
  if (isNight && !def.spawnAtNight) return [];
  if (!isNight && !def.spawnAtDay) return [];

  const pos = findSpawnTile(player.x, player.y, params.mapWidth, params.mapHeight, params.isSolid);
  if (!pos) return [];
  return [createEnemy(type, pos.x, pos.y - TILE_SIZE)];
}

export interface AIUpdateParams { dt: number; player: { x: number; y: number; width: number; height: number; onGround: boolean }; isSolid: (tx: number, ty: number) => boolean; onHitPlayer: (damage: number, dir: number, enemyId: number) => void; }

export function updateEnemy(e: Enemy, params: AIUpdateParams) {
  const { dt, player, isSolid } = params;
  if (e.state === 'dead') { e.deathProgress += dt * 3; return; }

  // M16: DoT tick（每秒一次，dotDuration 倒计时）
  if (e.dotDps > 0 && e.dotDuration > 0) {
    e.dotTick += dt;
    if (e.dotTick >= 1) {
      e.dotTick -= 1;
      const dmg = e.dotDps;
      e.hp -= dmg;
      e.dotTotalDmg += dmg;
      if (e.hp <= 0) { e.state = 'dead'; e.hp = 0; return; }
    }
    e.dotDuration -= dt;
    if (e.dotDuration <= 0) { e.dotDps = 0; e.dotDuration = 0; }
  }

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
