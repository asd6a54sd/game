/**
 * 烬海纪元 · Boss 系统
 * ====================
 * 区别泰拉瑞亚：
 * - 召唤需要消耗材料（不是直接道具）
 * - 三阶段 AI，每阶段行为模式完全不同
 * - 击败后永久"净化"一个 void_barrier（让玩家的行动改变世界）
 */
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from './terrain.js';

export type BossPhase = 'phase1' | 'phase2' | 'phase3';

export interface BossDef {
  id: string;
  name: string;
  paletteId: string;
  width: number;
  height: number;
  hp: number;
  speed: number;
  damage: number;
  desc: string;
}

export const BOSS_DEFS: Record<string, BossDef> = {
  void_assimilator: {
    id: 'void_assimilator',
    name: '黑雾同化体',
    paletteId: 'void03',
    width: 48, height: 56,
    hp: 300, speed: 60, damage: 12,
    desc: '从暗能量结界中诞生的终极虚空生物',
  },
  crystal_warden: {
    id: 'crystal_warden',
    name: '幽紫晶体守卫',
    paletteId: 'void01',
    width: 40, height: 64,
    hp: 220, speed: 80, damage: 10,
    desc: '守护地底祭坛的远古晶体构造',
  },
  rock_titan: {
    id: 'rock_titan',
    name: '岩石泰坦',
    paletteId: 'iron04',
    width: 64, height: 80,
    hp: 420, speed: 55, damage: 18,
    desc: '戈壁矿脉最深处的远古岩石巨人',
  },
};

export interface BossProjectile {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  damage: number;
  life: number; maxLife: number;
  color: string;
  phase: BossPhase;
}

export interface Boss {
  id: number;
  def: BossDef;
  x: number; y: number;
  vx: number; vy: number;
  hp: number;
  facing: 1 | -1;
  phase: BossPhase;
  phaseTransitioned: boolean;
  attackTimer: number;
  isDead: boolean;
  deathProgress: number;
  hurtCooldown: number;
  // 瞬移冷却 (phase3 void_assimilator)
  teleportCooldown: number;
  // 冲击波 (phase2 void_assimilator / rock_titan 撞击)
  shockwaveTimer: number;
  // 弹幕角度 (phase3 void_assimilator)
  barrageAngle: number;
  // 召唤小怪计数
  minionsSummoned: number;
  // rock_titan 专属
  titanSmashCooldown: number;   // 地面撞击冷却
  titanIsSmasching: boolean;   // 是否正在下落撞击
  titanSmashY: number;         // 撞击目标高度
  titanMeteorTimer: number;    // 陨石雨计时
  titanStompTimer: number;     // 连续跺脚
}

let bossIdCounter = 1;
let projIdCounter = 1;

export function createBoss(defId: string, x: number, y: number): Boss {
  const def = BOSS_DEFS[defId];
  return {
    id: bossIdCounter++,
    def, x, y,
    vx: 0, vy: 0,
    hp: def.hp,
    facing: 1,
    phase: 'phase1',
    phaseTransitioned: false,
    attackTimer: 0,
    isDead: false,
    deathProgress: 0,
    hurtCooldown: 0,
    teleportCooldown: 0,
    shockwaveTimer: 0,
    barrageAngle: 0,
    minionsSummoned: 0,
    // rock_titan 专属
    titanSmashCooldown: 3,
    titanIsSmasching: false,
    titanSmashY: 0,
    titanMeteorTimer: 0,
    titanStompTimer: 0,
  };
}

export function bossCenterX(b: Boss) { return b.x; }
export function bossCenterY(b: Boss) { return b.y; }
export function bossHalfW(b: Boss) { return b.def.width / 2; }
export function bossHalfH(b: Boss) { return b.def.height / 2; }

export function hitBoss(b: Boss, damage: number, knockback: number, dir: 1 | -1): boolean {
  if (b.isDead) return false;
  b.hp -= damage;
  b.hurtCooldown = 0.2;
  b.vx = dir * knockback;
  if (b.hp <= 0) {
    b.hp = 0;
    b.isDead = true;
    return true;
  }
  return false;
}

export interface BossAIParams {
  dt: number;
  player: { x: number; y: number; width: number; height: number; onGround: boolean };
  isSolid: (tx: number, ty: number) => boolean;
  spawnEnemy: (type: string, x: number, y: number) => void;
  onHitPlayer: (damage: number, dir: number) => void;
  // rock_titan 震屏回调（主入口实现）
  onShakePlayer?: (intensity: number) => void;
}

export function updateBoss(b: Boss, params: BossAIParams): BossProjectile[] {
  const { dt, player, isSolid, spawnEnemy, onHitPlayer, onShakePlayer } = params;
  const projectiles: BossProjectile[] = [];

  if (b.isDead) {
    b.deathProgress += dt * 1.5;
    return projectiles;
  }

  b.hurtCooldown = Math.max(0, b.hurtCooldown - dt);
  b.attackTimer -= dt;

  // 阶段转换
  const hpFrac = b.hp / b.def.hp;
  if (hpFrac < 0.33 && b.phase === 'phase2') {
    b.phase = 'phase3'; b.phaseTransitioned = false;
    if (!b.phaseTransitioned && b.def.id === 'void_assimilator') {
      b.teleportCooldown = 0;
    }
  } else if (hpFrac < 0.66 && b.phase === 'phase1') {
    b.phase = 'phase2'; b.minionsSummoned = 0;
    if (b.def.id === 'rock_titan') b.titanSmashCooldown = 2;
  }

  const dx = player.x - b.x;
  const dy = player.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  b.facing = dx >= 0 ? 1 : -1;

  // ========== rock_titan 三阶段 AI ==========
  if (b.def.id === 'rock_titan') {
    // --- 阶段 1: 追击 + 岩块投掷 ---
    if (b.phase === 'phase1') {
      if (dist > 100) {
        b.vx = Math.sign(dx) * b.def.speed;
      } else {
        b.vx *= 0.85;
      }
      // 跳跃障碍
      if (isSolid(Math.floor(b.x / TILE_SIZE), Math.floor((b.y + b.def.height / 2) / TILE_SIZE) + 1) &&
          !isSolid(Math.floor(b.x / TILE_SIZE), Math.floor((b.y - b.def.height / 2) / TILE_SIZE) - 1)) {
        b.vy = -450;
      }
      if (b.attackTimer <= 0 && dist < 500) {
        b.attackTimer = 1.6;
        // 斜抛投岩块：向上一点 + 朝向玩家水平
        const ang = Math.atan2(dy - 60, dx); // 略微朝上
        projectiles.push({ ...makeProj(b.x, b.y - 20, Math.cos(ang) * 260, Math.sin(ang) * 260, 'phase1'), color: '#8a6040' });
        projectiles.push({ ...makeProj(b.x + 10, b.y - 20, Math.cos(ang + 0.15) * 240, Math.sin(ang + 0.15) * 240, 'phase1'), color: '#a0744a' });
      }
    }

    // --- 阶段 2: 地面撞击 + 召唤 rock_golem ---
    if (b.phase === 'phase2') {
      b.titanSmashCooldown -= dt;
      b.shockwaveTimer -= dt;
      // 撞击触发
      if (b.titanSmashCooldown <= 0 && !b.titanIsSmasching && dist < 260 && player.onGround) {
        b.titanIsSmasching = true;
        b.titanSmashY = player.y + 10; // 落到玩家脚底下
        b.vy = -550;                    // 先跳起来
        b.vx = Math.sign(dx) * 80;
      }
      if (b.titanIsSmasching) {
        // 达到最高点后开始下砸
        if (b.vy <= 0) {
          b.vy = 900; // 极速下落
          b.vx = Math.sign(dx) * 20;
        }
        // 落地检测（简化：y 超过 titanSmashY 或落地 solid tile）
        if (b.y >= b.titanSmashY - 5 ||
            isSolid(Math.floor(b.x / TILE_SIZE), Math.floor((b.y + b.def.height / 2) / TILE_SIZE) + 1)) {
          b.titanIsSmasching = false;
          b.vy = 0; b.vx = 0;
          b.titanSmashCooldown = 3.2;
          // 震屏回调
          onShakePlayer?.(8);
          // 震波（10 方向）
          for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            projectiles.push({ ...makeProj(b.x, b.y, Math.cos(angle) * 180, Math.sin(angle) * 180, 'phase2'), color: '#c09060', size: 8 });
          }
          // 近身伤害
          if (dist < 140) onHitPlayer(b.def.damage, Math.sign(dx) || 1);
        }
      } else {
        // 正常追击
        b.vx *= 0.6;
      }
      // 召唤 rock_golem（每次 1 个，最多 4 次）
      if (b.attackTimer <= 0 && b.minionsSummoned < 4) {
        b.attackTimer = 5;
        b.minionsSummoned += 1;
        spawnEnemy('rock_golem', b.x - 60 + Math.random() * 120, b.y - 40);
      }
      // 近身
      if (dist < b.def.width / 2 + player.width / 2 + 4) {
        onHitPlayer(b.def.damage * 0.6, Math.sign(dx) || 1);
      }
    }

    // --- 阶段 3: 陨石雨 + 地震 ---
    if (b.phase === 'phase3') {
      b.titanMeteorTimer -= dt;
      b.titanStompTimer -= dt;
      b.barrageAngle += dt * 5; // 复用角度做时间

      // 陨石雨（从玩家头顶天空落下）
      if (b.titanMeteorTimer <= 0) {
        b.titanMeteorTimer = 0.45;
        // 从玩家上方随机位置投下
        const offsetX = (Math.random() - 0.5) * 300;
        const mx = player.x + offsetX;
        const my = player.y - 400;
        // 瞄准玩家脚下
        const ang = Math.atan2(player.y - my, player.x - mx);
        projectiles.push({
          ...makeProj(mx, my, Math.cos(ang) * 320, Math.sin(ang) * 320, 'phase3'),
          size: 12,
          damage: 14,
          maxLife: 3,
          color: '#e04020',
        });
      }
      // 连续跺脚 + 震屏
      if (b.titanStompTimer <= 0 && !b.titanIsSmasching) {
        b.titanStompTimer = 1.5;
        b.titanIsSmasching = true;
        b.titanSmashY = player.y;
        b.vy = -450;
      }
      if (b.titanIsSmasching) {
        if (b.vy <= 0) b.vy = 800;
        b.vx = 0;
        if (b.y >= b.titanSmashY ||
            isSolid(Math.floor(b.x / TILE_SIZE), Math.floor((b.y + b.def.height / 2) / TILE_SIZE) + 1)) {
          b.titanIsSmasching = false;
          b.vy = 0;
          onShakePlayer?.(12);
          for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2;
            projectiles.push({ ...makeProj(b.x, b.y, Math.cos(angle) * 220, Math.sin(angle) * 220, 'phase3'), color: '#e04020', size: 9 });
          }
          if (dist < 200) onHitPlayer(b.def.damage * 1.2, Math.sign(dx) || 1);
        }
      }
    }

    // rock_titan 全程受重力（phase3 略微减轻下落）
    if (b.phase === 'phase3') b.vy += 900 * dt; else b.vy += 1400 * dt;
    b.vy = Math.min(b.vy, 900);
  }

  // ========== void_assimilator / crystal_warden 三阶段 AI ==========
  else {
    // ===== Phase 1 (>66% HP): 追击 + 远程紫弹 =====
    if (b.phase === 'phase1') {
      // 移动（慢速追击）
      if (dist > 80) {
        b.vx = Math.sign(dx) * b.def.speed;
      } else {
        b.vx *= 0.85;
      }
      // 跳跃障碍
      if (isSolid(Math.floor(b.x / TILE_SIZE), Math.floor((b.y + b.def.height / 2) / TILE_SIZE) + 1) &&
          !isSolid(Math.floor(b.x / TILE_SIZE), Math.floor((b.y - b.def.height / 2) / TILE_SIZE) - 1)) {
        b.vy = -400;
      }
      // 射击
      if (b.attackTimer <= 0 && dist < 400) {
        b.attackTimer = 1.2;
        for (let i = -1; i <= 1; i++) {
          const angle = Math.atan2(dy, dx) + i * 0.15;
          projectiles.push(makeProj(b.x, b.y, Math.cos(angle) * 200, Math.sin(angle) * 200, 'phase1'));
        }
      }
    }

    // ===== Phase 2 (33-66% HP): 召唤小怪 + 冲击波 =====
    if (b.phase === 'phase2') {
      // 慢慢飘（不追击那么紧）
      b.vx *= 0.9;
      // 召唤小怪（每次召唤 2 个 void_flyer）
      if (b.attackTimer <= 0 && b.minionsSummoned < 6) {
        b.attackTimer = 4;
        b.minionsSummoned += 2;
        spawnEnemy('void_flyer', b.x - 40 + Math.random() * 80, b.y - 20);
        spawnEnemy('void_flyer', b.x - 40 + Math.random() * 80, b.y - 20);
      }
      // 冲击波（近身判定）
      b.shockwaveTimer -= dt;
      if (b.shockwaveTimer <= 0 && dist < 120) {
        b.shockwaveTimer = 2.5;
        // 环绕发射 8 颗慢弹
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          projectiles.push(makeProj(b.x, b.y, Math.cos(angle) * 140, Math.sin(angle) * 140, 'phase2'));
        }
      }
      // 近身伤害
      if (dist < b.def.width / 2 + player.width / 2 + 4) {
        onHitPlayer(b.def.damage * 0.6, Math.sign(dx) || 1);
      }
    }

    // ===== Phase 3 (<33% HP): 狂暴瞬移 + 全屏弹幕 =====
    if (b.phase === 'phase3') {
      b.vx *= 0.7;
      // 瞬移
      b.teleportCooldown -= dt;
      if (b.teleportCooldown <= 0) {
        b.teleportCooldown = 3 + Math.random() * 2;
        const tdx = (Math.random() - 0.5) * 200;
        const tdy = (Math.random() - 0.5) * 80;
        b.x = Math.max(40, Math.min(MAP_WIDTH * TILE_SIZE - 40, player.x + tdx));
        b.y = Math.max(50 * TILE_SIZE, Math.min(MAP_HEIGHT * TILE_SIZE - 50, player.y + tdy));
        b.vx = 0; b.vy = 0;
      }
      // 弹幕（螺旋）
      b.barrageAngle += dt * 4;
      if (b.attackTimer <= 0) {
        b.attackTimer = 0.08;
        const spread = 5 + Math.floor(Math.sin(b.barrageAngle) * 3);
        for (let i = 0; i < spread; i++) {
          const angle = b.barrageAngle + (i - spread / 2) * 0.12;
          projectiles.push(makeProj(b.x, b.y, Math.cos(angle) * 180, Math.sin(angle) * 180, 'phase3'));
        }
      }
    }

    // 重力（phase1/2 重 / phase3 轻）
    if (b.phase !== 'phase3') {
      b.vy += 1200 * dt;
      b.vy = Math.min(b.vy, 800);
    } else {
      b.vy += 300 * dt;
      b.vy = Math.min(b.vy, 400);
    }
  }

  // 基础重力兜底（非 rock_titan phase3 已处理）
  // （rock_titan 重力已在其分支内独立处理）

  // 移动
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // 基础碰撞
  b.x = Math.max(20, Math.min(MAP_WIDTH * TILE_SIZE - 20, b.x));
  if (b.y > MAP_HEIGHT * TILE_SIZE - 40) {
    b.y = MAP_HEIGHT * TILE_SIZE - 40;
    b.vy = 0;
  }

  return projectiles;
}

function makeProj(x: number, y: number, vx: number, vy: number, phase: BossPhase): BossProjectile {
  const colors: Record<BossPhase, string> = {
    phase1: '#a860e8',
    phase2: '#c080ff',
    phase3: '#ff40c0',
  };
  return {
    id: projIdCounter++,
    x, y, vx, vy,
    size: phase === 'phase3' ? 8 : 6,
    damage: phase === 'phase2' ? 8 : phase === 'phase3' ? 10 : 6,
    life: 0,
    maxLife: phase === 'phase3' ? 4 : 3,
    color: colors[phase],
    phase,
  };
}

export function updateProjectiles(projs: BossProjectile[], dt: number, player: { x: number; y: number; width: number; height: number }, onHit: (dmg: number) => void): BossProjectile[] {
  const alive: BossProjectile[] = [];
  for (const p of projs) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // 仅 phase1 小弹（紫弹/岩块）加轻重力；phase2 震波和 phase3 陨石不加
    if (p.phase === 'phase1' && p.size <= 6) p.vy += 100 * dt;
    if (p.life >= p.maxLife) continue;
    if (p.x < 0 || p.x > MAP_WIDTH * TILE_SIZE || p.y < 0 || p.y > MAP_HEIGHT * TILE_SIZE) continue;
    // AABB 命中玩家
    if (Math.abs(p.x - player.x) < player.width / 2 + p.size &&
        Math.abs(p.y - player.y) < player.height / 2 + p.size) {
      onHit(p.damage);
      continue;
    }
    alive.push(p);
  }
  return alive;
}

/** 寻找最近的 void_barrier 作为 Boss 召唤点 */
export function findNearestVoidBarrier(tiles: Uint8Array, playerX: number, playerY: number): { x: number; y: number } | null {
  // void_barrier 在 BLOCKS 中的 index = 21（按 blocks.ts 定义顺序）
  const blockIds = [
    'empty', 'wreck_scrap', 'wreck_hull', 'ember_ash', 'fire_crack',
    'wind_rock', 'cracked_ground', 'surface_dust', 'desert_ground',
    'ore_rock', 'ore_copper', 'ore_iron', 'ore_gold',
    'deep_rock', 'crystal_glow', 'void_crystal',
    'liquid_metal', 'metal_float',
    'chitin_hive', 'bio_glow',
    'rebel_brick', 'void_barrier',
    'dark_seed', 'dark_filament', 'purify_torch',
  ];
  const vbIdx = blockIds.indexOf('void_barrier');
  if (vbIdx < 0) return null;
  let best: { x: number; y: number; dist: number } | null = null;
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (tiles[y * MAP_WIDTH + x] === vbIdx) {
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        const d2 = (cx - playerX) ** 2 + (cy - playerY) ** 2;
        if (!best || d2 < best.dist) best = { x: cx, y: cy, dist: d2 };
      }
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}
