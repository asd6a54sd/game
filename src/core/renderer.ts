/**
 * 烬海纪元 · Canvas 渲染器
 * 像素锁定渲染 —— 每 tile 16×16，直接用调色板色填充 + 简单噪声纹理
 */
import { PALETTE_MAP } from './palette.js';
import { BLOCKS } from './blocks.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from './terrain.js';
import { biToBlock } from './terrain.js';
import { Camera } from './camera.js';
import { Player } from './player.js';
import { BreakState } from './break.js';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private starField: { x: number; y: number; b: number }[] = [];

  constructor(public canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.generateStars();
  }

  private generateStars() {
    for (let i = 0; i < 80; i++) {
      this.starField.push({
        x: Math.random() * MAP_WIDTH * TILE_SIZE,
        y: Math.random() * 40 * TILE_SIZE,
        b: 0.3 + Math.random() * 0.7,
      });
    }
  }

  resize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    // 背景渐变（深空 → 暗红色地平线）
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, '#0a0608');
    grad.addColorStop(0.5, '#1a0e10');
    grad.addColorStop(1, '#2a1410');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBackground(cam: Camera) {
    const ctx = this.ctx;
    // 星星（视差）
    for (const s of this.starField) {
      const sx = s.x - cam.x * 0.2;
      const sy = s.y - cam.y * 0.2;
      ctx.fillStyle = `rgba(232, 197, 71, ${s.b * 0.5})`;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
    }

    // 远处山脉（视差剪影）
    ctx.fillStyle = '#1a0a08';
    const mountainBaseY = 55 * TILE_SIZE - cam.y * 0.4;
    for (let x = -50; x < this.canvas.width + 50; x += 40) {
      const h = 20 + ((Math.sin(x * 0.03) + 1) * 15);
      ctx.beginPath();
      ctx.moveTo(x, mountainBaseY);
      ctx.lineTo(x + 20, mountainBaseY - h);
      ctx.lineTo(x + 40, mountainBaseY);
      ctx.fill();
    }
  }

  drawWorld(
    tiles: Uint8Array,
    cam: Camera,
    breaking: BreakState | null,
  ) {
    const ctx = this.ctx;
    const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE) - 1);
    const endX = Math.min(MAP_WIDTH, Math.ceil((cam.x + cam.width) / TILE_SIZE) + 1);
    const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE) - 1);
    const endY = Math.min(MAP_HEIGHT, Math.ceil((cam.y + cam.height) / TILE_SIZE) + 1);

    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const idx = ty * MAP_WIDTH + tx;
        const blockIdx = tiles[idx];
        const id = biToBlock(blockIdx);
        if (id === 'empty') continue;

        const def = BLOCKS[id];
        if (!def) continue;

        const px = Math.floor(tx * TILE_SIZE - cam.x);
        const py = Math.floor(ty * TILE_SIZE - cam.y);

        this.drawTile(ctx, px, py, def, tx, ty);
      }
    }

    // 破坏进度
    if (breaking && breaking.targetTile && breaking.progress > 0) {
      const { x, y } = breaking.targetTile;
      const id = biToBlock(tiles[y * MAP_WIDTH + x]);
      const def = BLOCKS[id];
      if (def) {
        const px = Math.floor(x * TILE_SIZE - cam.x);
        const py = Math.floor(y * TILE_SIZE - cam.y);
        const frac = Math.min(1, breaking.progress / breaking.required);
        this.drawBreakOverlay(ctx, px, py, frac, x, y);
      }
    }

    // 掉落物
    if (breaking) {
      for (const d of breaking.drops) {
        const id = d.blockId;
        const def = BLOCKS[id];
        if (!def) continue;
        const px = Math.floor(d.x - cam.x - 4);
        const py = Math.floor(d.y - cam.y - 4);
        ctx.fillStyle = PALETTE_MAP.get(def.paletteId) ?? '#888';
        ctx.fillRect(px, py, 8, 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeRect(px + 0.5, py + 0.5, 7, 7);
      }
    }

    // 粒子
    if (breaking) {
      for (const p of breaking.particles) {
        const px = Math.floor(p.x - cam.x);
        const py = Math.floor(p.y - cam.y);
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = PALETTE_MAP.get(p.color) ?? '#fff';
        ctx.fillRect(px, py, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawTile(
    ctx: CanvasRenderingContext2D, px: number, py: number,
    def: typeof BLOCKS[string], tx: number, ty: number
  ) {
    const baseColor = PALETTE_MAP.get(def.paletteId) ?? '#888';
    ctx.fillStyle = baseColor;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // 变体（微小像素噪声）
    const seed = (tx * 374761393 + ty * 668265263) >>> 0;
    for (let i = 0; i < 8; i++) {
      const s = (seed + i * 12345) >>> 0;
      const v = s & 0xff;
      const vx = (s >> 8) % TILE_SIZE;
      const vy = (s >> 16) % TILE_SIZE;
      if (v < 60 && def.variants.length > 0) {
        const vId = def.variants[v % def.variants.length];
        const vc = PALETTE_MAP.get(vId);
        if (vc) {
          ctx.fillStyle = vc;
          ctx.fillRect(px + vx, py + vy, 1, 1);
        }
      }
    }

    // 边框（轻微暗边让 tile 可区分）
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px, py, TILE_SIZE, 1);
    ctx.fillRect(px, py, 1, TILE_SIZE);

    // 发光
    if (def.emitsLight && def.emitsLight > 0) {
      const intensity = def.emitsLight / 15;
      ctx.fillStyle = `rgba(${intensity * 200 + 55}, ${intensity * 150 + 50}, ${intensity * 100 + 55}, ${intensity * 0.25})`;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  private drawBreakOverlay(ctx: CanvasRenderingContext2D, px: number, py: number, frac: number, tx: number, ty: number) {
    // 基于 frac 绘制裂纹覆盖
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 1;
    const r = tx * 13 + ty * 7;
    const lines = Math.ceil(frac * 6);
    for (let i = 0; i < lines; i++) {
      const r1 = ((r + i * 91) % 100) / 100;
      const r2 = ((r + i * 157) % 100) / 100;
      ctx.beginPath();
      ctx.moveTo(px + r1 * TILE_SIZE, py + r2 * TILE_SIZE);
      ctx.lineTo(px + ((r1 + 0.3) % 1) * TILE_SIZE, py + ((r2 + 0.2) % 1) * TILE_SIZE);
      ctx.stroke();
    }

    // 破坏完成前最后几帧：覆盖更深
    if (frac > 0.9) {
      ctx.fillStyle = `rgba(0,0,0,${(frac - 0.9) * 3})`;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  drawPlayer(p: Player, cam: Camera) {
    const ctx = this.ctx;
    const px = Math.floor(p.x - cam.x - p.width / 2);
    const py = Math.floor(p.y - cam.y - p.height / 2);

    // 剪影（方案要求：最左侧留角色剪影做比例锚点）
    // 身体 = 铁灰 iron02
    ctx.fillStyle = PALETTE_MAP.get('iron02') ?? '#888';
    ctx.fillRect(px, py + TILE_SIZE, p.width, p.height - TILE_SIZE);
    // 头 = 骨白 bone02
    ctx.fillStyle = PALETTE_MAP.get('bone02') ?? '#e8dcc0';
    ctx.fillRect(px + 2, py + 2, p.width - 4, TILE_SIZE - 4);
    // 眼睛 = 余烬 ember02
    ctx.fillStyle = PALETTE_MAP.get('ember02') ?? '#ffc85a';
    const eyeX = p.facing === 1 ? px + p.width - 6 : px + 4;
    ctx.fillRect(eyeX, py + 6, 2, 2);
    // 手脚细节
    ctx.fillStyle = PALETTE_MAP.get('iron04') ?? '#333';
    ctx.fillRect(px - 1, py + TILE_SIZE + 4, 2, TILE_SIZE * 0.5);   // 左臂
    ctx.fillRect(px + p.width - 1, py + TILE_SIZE + 4, 2, TILE_SIZE * 0.5); // 右臂

    // HP bar
    const barW = p.width + 4, barH = 3;
    const barX = px - 2, barY = py - 6;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX, barY, barW, barH);
    const hpFrac = p.hp / p.maxHp;
    ctx.fillStyle = hpFrac > 0.5 ? '#7ad4e8' : hpFrac > 0.25 ? '#e89430' : '#ff4a3a';
    ctx.fillRect(barX, barY, barW * hpFrac, barH);
  }

  drawCrosshair(screenX: number, screenY: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = PALETTE_MAP.get('ui01') ?? '#e8c547';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(screenX - 8, screenY); ctx.lineTo(screenX - 2, screenY);
    ctx.moveTo(screenX + 2, screenY); ctx.lineTo(screenX + 8, screenY);
    ctx.moveTo(screenX, screenY - 8); ctx.lineTo(screenX, screenY - 2);
    ctx.moveTo(screenX, screenY + 2); ctx.lineTo(screenX, screenY + 8);
    ctx.stroke();
  }
}
