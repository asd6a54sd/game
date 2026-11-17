/**
 * 烬海纪元 · 一格破坏系统
 * - 支持工具等级：低等级工具挖不动高硬度方块
 * - 工具挖掘速度倍率
 * - 破坏进度条（基于硬度 / 挖掘速度）
 * - 粒子飞溅 + 掉落物理
 */
import { BLOCKS, BlockDef } from './blocks.js';
import { TILE_SIZE } from './terrain.js';
import { TOOLS } from './tools.js';

export interface BreakState {
  targetTile: { x: number; y: number } | null;
  progress: number;
  required: number;
  canBreak: boolean;
  particles: Particle[];
  drops: DropItem[];
  removedThisFrame: number;
  removedBlocks: string[]; // M17: 本帧被破坏的方块 id 列表（任务系统用）
  removedChests: { tx: number; ty: number }[]; // M27: 本帧被破坏的宝箱坐标
  miningSpeedMult: number; // M19: 挖矿速度倍率（成就 buff）
}

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

export interface DropItem {
  x: number; y: number;
  vx: number; vy: number;
  blockId: string;
  life: number;
}

export function createBreakState(): BreakState {
  return {
    targetTile: null,
    progress: 0,
    required: 0,
    canBreak: true,
    particles: [],
    drops: [],
    removedThisFrame: 0,
    removedBlocks: [],
    removedChests: [],
    miningSpeedMult: 1,
  };
}

export function startBreaking(state: BreakState, tx: number, ty: number, getBlock: (x: number, y: number) => string, toolId: string): boolean {
  const id = getBlock(tx, ty);
  if (id === 'empty') return false;
  const def = BLOCKS[id];
  if (!def || def.hardness <= 0) return false;

  if (state.targetTile && state.targetTile.x === tx && state.targetTile.y === ty) {
    // 同一块，只在工具切换时重置
  } else {
    state.targetTile = { x: tx, y: ty };
    state.progress = 0;
    state.required = def.hardness;
    const tool = TOOLS[toolId] ?? TOOLS.hand_pickaxe;
    state.canBreak = tool.pickaxePower >= def.toolLevel;
  }
  return true;
}

export function stopBreaking(state: BreakState) {
  state.targetTile = null;
  state.progress = 0;
  state.required = 0;
  state.canBreak = true;
}

export function updateBreaking(
  state: BreakState, dt: number, toolId: string,
  getBlock: (x: number, y: number) => string,
  setBlock: (x: number, y: number, id: string) => void,
): boolean {
  if (!state.targetTile) return false;

  const { x: tx, y: ty } = state.targetTile;
  const id = getBlock(tx, ty);
  if (id === 'empty') { stopBreaking(state); return false; }

  const def = BLOCKS[id];
  const tool = TOOLS[toolId] ?? TOOLS.hand_pickaxe;

  // 工具等级不足 → 挖不动（仅产生 1 秒 1 能量，非常慢）
  const effectiveSpeed = (tool.pickaxePower >= def.toolLevel ? tool.miningSpeed : 1) * state.miningSpeedMult;
  state.progress += effectiveSpeed * dt;

  // 周期性产生破坏粒子
  if (state.progress < state.required && tool.pickaxePower >= def.toolLevel) {
    for (let i = 0; i < 2; i++) {
      state.particles.push(makeBreakParticle(tx, ty, def.paletteId));
    }
  }

  if (state.progress >= state.required) {
    breakBlock(state, tx, ty, id, setBlock);
    stopBreaking(state);
    state.removedThisFrame++;
    state.removedBlocks.push(id); // M17: 记录被破坏的方块
    return true;
  }
  return false;
}

function breakBlock(state: BreakState, tx: number, ty: number, id: string, setBlock: (x: number, y: number, id: string) => void) {
  const def = BLOCKS[id];
  // M27: 记录宝箱破坏坐标（main 中负责掉落内容物）
  if (id === 'chest') state.removedChests.push({ tx, ty });
  for (let i = 0; i < 14; i++) {
    state.particles.push(makeBreakParticle(tx, ty, def.paletteId, true));
  }
  if (def.drops) {
    for (const drop of def.drops) {
      if (Math.random() < drop.chance) {
        state.drops.push(makeDrop(tx, ty, drop.blockId));
      }
    }
  }
  setBlock(tx, ty, 'empty');
}

function makeBreakParticle(tx: number, ty: number, paletteId: string, big = false): Particle {
  return {
    x: tx * TILE_SIZE + Math.random() * TILE_SIZE,
    y: ty * TILE_SIZE + Math.random() * TILE_SIZE,
    vx: (Math.random() - 0.5) * (big ? 160 : 80),
    vy: (Math.random() - 0.8) * (big ? 160 : 80),
    life: big ? 0.8 : 0.4,
    maxLife: big ? 0.8 : 0.4,
    color: paletteId,
    size: big ? 3 + Math.random() * 3 : 2 + Math.random() * 2,
    gravity: 500,
  };
}

function makeDrop(tx: number, ty: number, blockId: string): DropItem {
  return {
    x: tx * TILE_SIZE + TILE_SIZE / 2,
    y: ty * TILE_SIZE + TILE_SIZE / 2,
    vx: (Math.random() - 0.5) * 100,
    vy: -80 - Math.random() * 80,
    blockId,
    life: 30,
  };
}

export function updateParticles(state: BreakState, dt: number, isSolid: (x: number, y: number) => boolean) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) { state.particles.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const tx = Math.floor(p.x / TILE_SIZE);
    const ty = Math.floor(p.y / TILE_SIZE);
    if (isSolid(tx, ty)) {
      p.vy *= -0.3;
      p.vx *= 0.5;
      p.y = ty * TILE_SIZE - 1;
    }
  }
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const d = state.drops[i];
    d.life -= dt;
    if (d.life <= 0) { state.drops.splice(i, 1); continue; }
    d.vy += 1400 * dt;
    d.vx *= 0.98;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    const tx = Math.floor(d.x / TILE_SIZE);
    const ty = Math.floor(d.y / TILE_SIZE);
    if (isSolid(tx, ty)) {
      d.vy *= -0.3;
      d.vx *= 0.6;
      d.y = ty * TILE_SIZE - 1;
      if (Math.abs(d.vy) < 20) d.vy = 0;
    }
  }
}

export function findDropAt(drops: DropItem[], px: number, py: number, r = 24): DropItem | null {
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    const dx = d.x - px, dy = d.y - py;
    if (dx * dx + dy * dy < r * r) return d;
  }
  return null;
}

export const _BLOCKS_REF = BLOCKS as Record<string, BlockDef>;
