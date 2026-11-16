/**
 * 烬海纪元 · 一格破坏系统（M0 核心验证）
 * - 破坏进度条（基于硬度）
 * - 破坏动画（碎块飞溅 + 淡出）
 * - 掉落物（物理 + 自动拾取）
 */
import { BLOCKS, BlockDef } from './blocks.js';
import { TILE_SIZE } from './terrain.js';

export interface BreakState {
  targetTile: { x: number; y: number } | null;
  progress: number;     // 0–1+
  required: number;     // 破坏所需的总"能量"
  particles: Particle[];
  drops: DropItem[];
  removedThisFrame: number;
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
    particles: [],
    drops: [],
    removedThisFrame: 0,
  };
}

const BREAK_ENERGY_PER_SECOND = 8; // 徒手破坏能量

export function startBreaking(state: BreakState, tx: number, ty: number, getBlock: (x: number, y: number) => string): boolean {
  const id = getBlock(tx, ty);
  if (id === 'empty') return false;
  const def = BLOCKS[id];
  if (!def || def.hardness <= 0) return false;

  if (state.targetTile && state.targetTile.x === tx && state.targetTile.y === ty) {
    // 同一块，继续
  } else {
    state.targetTile = { x: tx, y: ty };
    state.progress = 0;
    state.required = def.hardness;
  }
  return true;
}

export function stopBreaking(state: BreakState) {
  state.targetTile = null;
  state.progress = 0;
  state.required = 0;
}

export function updateBreaking(
  state: BreakState, dt: number,
  getBlock: (x: number, y: number) => string,
  setBlock: (x: number, y: number, id: string) => void,
): boolean {
  if (!state.targetTile) return false;

  const { x: tx, y: ty } = state.targetTile;
  const id = getBlock(tx, ty);
  if (id === 'empty') { stopBreaking(state); return false; }

  state.progress += BREAK_ENERGY_PER_SECOND * dt;

  // 周期性产生破坏粒子
  if (state.progress < state.required) {
    const particleCount = 3;
    for (let i = 0; i < particleCount; i++) {
      const def = BLOCKS[id];
      state.particles.push(makeBreakParticle(tx, ty, def.paletteId));
    }
  }

  if (state.progress >= state.required) {
    // 破坏完成
    breakBlock(state, tx, ty, id, getBlock, setBlock);
    stopBreaking(state);
    state.removedThisFrame++;
    return true;
  }
  return false;
}

function breakBlock(
  state: BreakState, tx: number, ty: number, id: string,
  _getBlock: (x: number, y: number) => string,
  setBlock: (x: number, y: number, id: string) => void,
) {
  const def = BLOCKS[id];

  // 大量碎块飞溅
  for (let i = 0; i < 14; i++) {
    state.particles.push(makeBreakParticle(tx, ty, def.paletteId, true));
  }

  // 掉落
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
  const colors = paletteIdToColors(paletteId);
  const color = colors[Math.floor(Math.random() * colors.length)];
  return {
    x: tx * TILE_SIZE + Math.random() * TILE_SIZE,
    y: ty * TILE_SIZE + Math.random() * TILE_SIZE,
    vx: (Math.random() - 0.5) * (big ? 160 : 80),
    vy: (Math.random() - 0.8) * (big ? 160 : 80),
    life: big ? 0.8 : 0.4,
    maxLife: big ? 0.8 : 0.4,
    color,
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

function paletteIdToColors(id: string): string[] {
  // 简化：直接返回 id 对应的 hex
  return [id];
}

export function updateParticles(state: BreakState, dt: number, isSolid: (x: number, y: number) => boolean) {
  // 粒子
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) { state.particles.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // 简单地面对撞
    const tx = Math.floor(p.x / TILE_SIZE);
    const ty = Math.floor(p.y / TILE_SIZE);
    if (isSolid(tx, ty)) {
      p.vy *= -0.3;
      p.vx *= 0.5;
      p.y = ty * TILE_SIZE - 1;
    }
  }

  // 掉落物
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

export function findDropAt(drops: DropItem[], px: number, py: number, r = 20): DropItem | null {
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    const dx = d.x - px, dy = d.y - py;
    if (dx * dx + dy * dy < r * r) return d;
  }
  return null;
}

// 空引用修正
export const _BLOCKS_REF = BLOCKS as Record<string, BlockDef>;
