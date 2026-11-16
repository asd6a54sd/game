/**
 * 烬海纪元 · 黑雾同化系统
 * ====================
 * 核心创新（区别泰拉瑞亚腐化/猩红）：
 * - 不是静态污染区域，是**动态同化进程**
 * - 同化有进度（0 → 100%），不是瞬间完成
 * - 夜晚加速同化（×3），白天减速（×0.3）
 * - 净化火炬可减速周围同化
 * - 同化产物：暗能晶种 + 暗能丝（高级合成材料）
 */
import { MAP_WIDTH, MAP_HEIGHT, biToBlock } from './terrain.js';
import { BLOCKS } from './blocks.js';

export interface VoidParticle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  alpha: number;
  life: number; maxLife: number;
}

export class VoidEngine {
  /** 每个方块的同化进度 0-255（255=完全同化） */
  progress: Uint8Array;
  /** 黑雾粒子云 */
  particles: VoidParticle[] = [];
  /** 同化源头（void_barrier 附近的源点列） */
  sources: { x: number; y: number }[] = [];
  /** 上次扩散计时 */
  private spreadTimer = 0;
  /** 粒子生成计时 */
  private particleTimer = 0;
  /** 附近的净化火炬坐标 */
  purifyTorches: { x: number; y: number }[] = [];

  constructor() {
    this.progress = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  }

  /** 从 void_barrier 扫描初始化源头 */
  initFromTerrain(tiles: Uint8Array) {
    this.sources = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (biToBlock(tiles[y * MAP_WIDTH + x]) === 'void_barrier') {
          this.sources.push({ x, y });
          // 源头附近初始污染
          for (let dx = -3; dx <= 3; dx++) {
            for (let dy = -3; dy <= 3; dy++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
              if (Math.abs(dx) + Math.abs(dy) <= 3) {
                this.progress[ny * MAP_WIDTH + nx] = Math.min(255, 128 + Math.random() * 80);
              }
            }
          }
        }
      }
    }
  }

  /** 注册/注销净化火炬 */
  updatePurifyTorches(tiles: Uint8Array) {
    this.purifyTorches = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (biToBlock(tiles[y * MAP_WIDTH + x]) === 'purify_torch') {
          this.purifyTorches.push({ x, y });
        }
      }
    }
  }

  /** 主更新 */
  update(dt: number, timeOfDay: number, tiles: Uint8Array, setBlock: (tx: number, ty: number, id: string) => void) {
    const isNight = timeOfDay > 0.55 || timeOfDay < 0.1;
    // 夜晚 ×3，白天 ×0.3
    const dayFactor = isNight ? 3 : 0.3;

    // 扩散：每 0.8 秒尝试一次
    this.spreadTimer += dt;
    if (this.spreadTimer >= 0.8) {
      this.spreadTimer = 0;
      this.spreadOnce(tiles, dayFactor);
    }

    // 进度增长：每帧给被污染方块加一点
    this.growProgress(dt, dayFactor, tiles, setBlock);

    // 粒子生成
    this.particleTimer += dt;
    if (this.particleTimer >= (isNight ? 0.05 : 0.2)) {
      this.particleTimer = 0;
      this.spawnParticles(tiles);
    }
    this.updateParticles(dt);
  }

  /** 从已同化方块向 4 邻格扩散 */
  private spreadOnce(tiles: Uint8Array, dayFactor: number) {
    const toSpread: number[] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const idx = y * MAP_WIDTH + x;
        if (this.progress[idx] > 30 && Math.random() < 0.3 * dayFactor) {
          toSpread.push(idx);
        }
      }
    }
    for (const idx of toSpread) {
      const x = idx % MAP_WIDTH;
      const y = Math.floor(idx / MAP_WIDTH);
      const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
        const nIdx = ny * MAP_WIDTH + nx;
        const nBlock = biToBlock(tiles[nIdx]);
        // 只能同化"普通"方块，不能同化 liquid/empty/void 系列
        if (!this.canVoidify(nBlock)) continue;
        if (this.progress[nIdx] > 0) continue;
        // 净化火炬附近减速
        if (this.isNearPurify(nx, ny, 10)) continue;
        if (Math.random() < 0.5 * dayFactor) {
          this.progress[nIdx] = 1;
        }
      }
    }
  }

  /** 判断方块能否被同化 */
  private canVoidify(id: string): boolean {
    if (id === 'empty' || id === 'liquid_metal') return false;
    if (id === 'void_barrier' || id === 'dark_seed' || id === 'dark_filament') return false;
    if (id === 'purify_torch') return false;
    const b = BLOCKS[id];
    if (!b) return false;
    return b.category === 'shallow' || b.category === 'mid' || b.category === 'deep' ||
           b.category === 'ore' || (b.category === 'special' && b.id !== 'bio_glow' && b.id !== 'chitin_hive');
  }

  private isNearPurify(x: number, y: number, radius: number): boolean {
    for (const t of this.purifyTorches) {
      const dx = x - t.x, dy = y - t.y;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  }

  /** 进度增长，满了就替换方块 */
  private growProgress(dt: number, dayFactor: number, tiles: Uint8Array, setBlock: (tx: number, ty: number, id: string) => void) {
    const step = 255 * dt * 0.4 * dayFactor; // ~2.5 秒全同化（夜晚）
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const idx = y * MAP_WIDTH + x;
        const p = this.progress[idx];
        if (p === 0) continue;
        if (this.isNearPurify(x, y, 12)) {
          // 净化火炬附近：进度回退
          this.progress[idx] = Math.max(0, p - step * 2);
          continue;
        }
        const np = p + step;
        if (np >= 255) {
          // 同化完成！替换方块
          const oldBlock = biToBlock(tiles[idx]);
          if (this.canVoidify(oldBlock)) {
            // 深层方块 → dark_filament，浅层 → dark_seed
            const oldDef = BLOCKS[oldBlock];
            const newId = (oldDef && oldDef.category === 'deep') ? 'dark_filament' : 'dark_seed';
            setBlock(x, y, newId);
          }
          this.progress[idx] = 0; // 重置，不再继续增长
        } else {
          this.progress[idx] = np;
        }
      }
    }
  }

  /** 生成黑雾粒子 */
  private spawnParticles(_tiles: Uint8Array) {
    const count = 3;
    for (let i = 0; i < count; i++) {
      // 从源头或已同化方块附近生成
      let sx: number, sy: number;
      if (this.sources.length > 0 && Math.random() < 0.6) {
        const s = this.sources[Math.floor(Math.random() * this.sources.length)];
        sx = s.x + (Math.random() - 0.5) * 8;
        sy = s.y + (Math.random() - 0.5) * 4;
      } else {
        // 找一个有进度的方块
        let tries = 0;
        do {
          sx = Math.floor(Math.random() * MAP_WIDTH);
          sy = Math.floor(60 + Math.random() * 80);
          tries++;
        } while (this.progress[sy * MAP_WIDTH + sx] === 0 && tries < 20);
      }
      const p: VoidParticle = {
        x: sx * 16 + (Math.random() - 0.5) * 16,
        y: sy * 16 + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 15,
        size: 6 + Math.random() * 10,
        alpha: 0.15 + Math.random() * 0.25,
        life: 0,
        maxLife: 3 + Math.random() * 4,
      };
      this.particles.push(p);
    }
    // 上限
    if (this.particles.length > 200) {
      this.particles.splice(0, this.particles.length - 200);
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 5 * dt; // 微微飘落后下沉
      p.alpha = Math.max(0, (1 - p.life / p.maxLife) * 0.35);
      if (p.life >= p.maxLife || p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /** 清除指定坐标的同化进度（被净化） */
  purge(x: number, y: number) {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return;
    this.progress[y * MAP_WIDTH + x] = 0;
  }

  /** 获取指定坐标同化度 0-1 */
  getProgress(x: number, y: number): number {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return 0;
    return this.progress[y * MAP_WIDTH + x] / 255;
  }
}
