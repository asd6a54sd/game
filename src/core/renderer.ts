/**
 * 烬海纪元 · Canvas 渲染器
 * 像素锁定渲染 —— 每 tile 16×16，调色板色填充 + 简单噪声纹理
 * 含：世界渲染 / 玩家 / 破坏覆盖 / 快捷栏 UI / 放置预览 / 日夜效果
 */
import { PALETTE_MAP } from './palette.js';
import { BLOCKS } from './blocks.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from './terrain.js';
import { biToBlock } from './terrain.js';
import { Camera } from './camera.js';
import { Player } from './player.js';
import { BreakState } from './break.js';
import { Inventory } from './inventory.js';
import { TOOLS } from './tools.js';
import { ShellDef, SHELL_COLORS } from './shells.js';
import { Enemy, enemySpriteColors, enemyHalfW, enemyHalfH } from './enemies.js';
import { VoidEngine } from './voiding.js';
import { TILE_SIZE as TS, MAP_WIDTH as MW, MAP_HEIGHT as MH } from './terrain.js';
import { Boss, BossProjectile, bossHalfW, bossHalfH } from './bosses.js';
import { Companion, companionSpriteColors, compHalfW, compHalfH } from './companions.js';
import { AccessoryManager, ACCESSORY_DEFS } from './accessories.js';
import { WorldEvent } from './events.js';
import { QuestState } from './tasks.js';
import { AchievementState } from './achievements.js';
import { ShopItem } from './npcs.js';
import { TrialManager } from './trial.js';
import { ActiveBuff } from './potions.js';
import { MOUNT_DEFS } from './mounts.js';
import { PET_DEFS, Pet } from './pets.js';
import { drawCharacter, makeModel, NPC_MODELS, CharKind } from './sprites.js';
import type { CharAnim } from './sprites.js';

/** 不生长地表植被的方块（液态金属 / 废墟结构 / 结界 / 雪原与火山） */
const saltSurfaces = new Set([
  'liquid_metal', 'metal_float', 'rebel_brick', 'void_barrier',
  'frost_snow', 'ice_layer', 'permafrost', 'frost_rock',
  'ash_ground', 'basalt', 'obsidian', 'magma_lava',
  'swamp_mud', 'murk_water', 'rot_peat', 'rot_bone', 'fen_rock', 'spore_glow',
  'court_tile', 'court_rubble', 'court_brick', 'court_deep', 'court_column', 'court_brazier',
]);


export class Renderer {
  // public 以便 main.ts 震屏偏移（save/translate/restore）
  ctx: CanvasRenderingContext2D;
  private starField: { x: number; y: number; b: number }[] = [];
  // 视差云层（构造时生成，随相机水平循环）
  private clouds: { x: number; y: number; w: number; h: number; layer: number }[] = [];
  // 日夜循环 0..1 (0 = 黎明, 0.5 = 正午, 0.9 = 深夜)
  timeOfDay = 0.3;
  // 光照遮罩（离屏画布）：地下黑暗 + 光源挖洞
  private maskCanvas = document.createElement('canvas');
  private maskCtx: CanvasRenderingContext2D;

  constructor(public canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    const mctx = this.maskCanvas.getContext('2d');
    if (!mctx) throw new Error('Cannot get 2D context');
    this.maskCtx = mctx;
    this.generateStars();
    this.generateClouds();
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

  private generateClouds() {
    for (let i = 0; i < 30; i++) {
      this.clouds.push({
        x: Math.random() * 2400,
        y: 5 + Math.random() * 30,
        w: 56 + Math.random() * 96,
        h: 14 + Math.random() * 18,
        layer: i % 2,
      });
    }
  }

  /** 确定性 0..1 哈希 —— 装饰物位置随世界坐标稳定，不随相机漂移 */
  private hash01(n: number): number {
    let t = (n | 0) >>> 0;
    t = Math.imul(t ^ (t >>> 16), 2246822507) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 3266489909) >>> 0;
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  }

  resize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    const ctx = this.ctx;
    // 根据 timeOfDay 调整背景色
    const t = this.timeOfDay;
    let topC: string, midC: string, botC: string;
    if (t < 0.25) { // 黎明
      topC = '#2a1830'; midC = '#5a2a38'; botC = '#a05a38';
    } else if (t < 0.55) { // 白天
      topC = '#31506b'; midC = '#4d7188'; botC = '#93b0b6';
    } else if (t < 0.75) { // 黄昏
      topC = '#241a34'; midC = '#4a1e36'; botC = '#7a2c0e';
    } else { // 深夜
      topC = '#06060e'; midC = '#0c0a16'; botC = '#181014';
    }
    const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, topC);
    grad.addColorStop(0.5, midC);
    grad.addColorStop(1, botC);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBackground(cam: Camera, heightMap?: Uint8Array) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const t = this.timeOfDay;

    // 视野内地表平均高度 → 地平线屏幕 Y（远景、云层据此对齐地面）
    let surfPx = 62 * TILE_SIZE;
    if (heightMap) {
      const c0 = Math.max(0, Math.floor(cam.x / TILE_SIZE));
      const c1 = Math.min(MAP_WIDTH - 1, Math.ceil((cam.x + W) / TILE_SIZE));
      let sum = 0, n = 0;
      for (let x = c0; x <= c1; x++) { sum += heightMap[x]; n++; }
      if (n > 0) surfPx = (sum / n) * TILE_SIZE;
    }
    const horizonY = Math.round(surfPx - cam.y);
    if (horizonY < -240) return;   // 身在地下：天空层不参与绘制

    // 星空（夜间）
    if (t > 0.55 || t < 0.1) {
      const alpha = t > 0.55 ? Math.min(1, (t - 0.55) * 2.2) : Math.min(1, (0.1 - t) * 4);
      for (const s of this.starField) {
        const sy = Math.floor(s.y - cam.y * 0.2);
        if (sy < -4 || sy > horizonY - 60) continue;
        ctx.fillStyle = `rgba(232, 197, 71, ${s.b * alpha * 0.5})`;
        ctx.fillRect(Math.floor(s.x - cam.x * 0.2), sy, 2, 2);
      }
    }

    this.drawClouds(cam, horizonY);
    this.drawMountains(cam, horizonY);
    this.drawFarForest(cam, horizonY);

    // 日月天体（仅地表视野内）
    if (t >= 0.06 && t < 0.6) {
      const sx = W * (0.2 + t * 1.0);
      const sy = horizonY - 150;
      const sunGrad = ctx.createRadialGradient(sx, sy, 4, sx, sy, 44);
      sunGrad.addColorStop(0, 'rgba(255, 196, 110, 0.85)');
      sunGrad.addColorStop(0.35, 'rgba(235, 130, 70, 0.25)');
      sunGrad.addColorStop(1, 'rgba(235, 130, 70, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath(); ctx.arc(sx, sy, 44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4ad68';
      ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
    } else if (t >= 0.75 || t < 0.06) {
      const sx = W * 0.72;
      const sy = horizonY - 170;
      ctx.fillStyle = 'rgba(230,230,240,0.12)';
      ctx.beginPath(); ctx.arc(sx, sy, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(238,238,248,0.94)';
      ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** 视差云层 — 边缘天空的主要体积感来源 */
  private drawClouds(cam: Camera, horizonY: number) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const t = this.timeOfDay;
    const night = t > 0.55 || t < 0.1;
    const main = night ? 'rgba(150, 162, 188, 0.20)' : 'rgba(255, 250, 240, 0.92)';
    const under = night ? 'rgba(74, 84, 112, 0.26)' : 'rgba(196, 202, 214, 0.82)';
    const span = Math.max(W + 300, 900);
    for (const c of this.clouds) {
      const par = c.layer === 0 ? 0.10 : 0.18;
      const sx = ((c.x - cam.x * par) % span + span) % span - 150;
      const sy = horizonY - c.y * TILE_SIZE + cam.y * (1 - par) * 0.5;
      if (sy > horizonY - 12 || sy < -c.h - 80) continue;
      const cw = c.w, ch = c.h;
      const bottom = sy + ch;
      ctx.fillStyle = under;
      ctx.fillRect(sx + 6, bottom - ch * 0.30, cw - 12, ch * 0.30);
      ctx.fillStyle = main;
      ctx.beginPath();
      ctx.arc(sx + cw * 0.24, bottom - ch * 0.46, ch * 0.50, 0, Math.PI * 2);
      ctx.arc(sx + cw * 0.48, bottom - ch * 0.74, ch * 0.80, 0, Math.PI * 2);
      ctx.arc(sx + cw * 0.74, bottom - ch * 0.50, ch * 0.56, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 远处山脉剪影（双层） */
  private drawMountains(cam: Camera, horizonY: number) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const base = horizonY + 12;
    if (base < -80) return;

    const off1 = cam.x * 0.12;
    ctx.fillStyle = '#3a4a52';
    for (let sx = -110; sx < W + 110; sx += 96) {
      const wx = sx + off1;
      const h = 74 + Math.sin(wx * 0.011) * 38 + Math.sin(wx * 0.031 + 2) * 18;
      const peak = sx + Math.sin(wx * 0.017 + 1) * 22;
      ctx.beginPath();
      ctx.moveTo(sx - 64, base);
      ctx.lineTo(peak, base - h);
      ctx.lineTo(sx + 64, base);
      ctx.closePath();
      ctx.fill();
    }

    const off2 = cam.x * 0.2;
    ctx.fillStyle = '#2b3a42';
    for (let sx = -80; sx < W + 80; sx += 62) {
      const wx = sx + off2;
      const h = 44 + Math.sin(wx * 0.02 + 1.1) * 24 + Math.sin(wx * 0.052) * 12;
      const peak = sx + Math.sin(wx * 0.026 + 3) * 14;
      ctx.beginPath();
      ctx.moveTo(sx - 40, base);
      ctx.lineTo(peak, base - h);
      ctx.lineTo(sx + 40, base);
      ctx.closePath();
      ctx.fill();
    }

    // 地平线雾气 — 让远山与地面自然衔接
    const fog = ctx.createLinearGradient(0, base - 90, 0, base + 22);
    fog.addColorStop(0, 'rgba(120, 110, 105, 0)');
    fog.addColorStop(0.7, 'rgba(120, 110, 105, 0.14)');
    fog.addColorStop(1, 'rgba(135, 120, 105, 0.24)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, base - 90, W, 114);
  }

  /** 远景森林剪影带 — 让地平线不再是空旷的分割线 */
  private drawFarForest(cam: Camera, horizonY: number) {
    if (horizonY < -50) return;
    const ctx = this.ctx;
    const W = this.canvas.width;

    // 远层：连绵树线
    const off = cam.x * 0.45;
    ctx.fillStyle = '#1d2b1d';
    ctx.beginPath();
    ctx.moveTo(-40, horizonY + 40);
    for (let sx = -40; sx <= W + 40; sx += 8) {
      const wx = sx + off;
      const n = Math.sin(wx * 0.009) * 0.5 + Math.sin(wx * 0.026 + 1.3) * 0.25 + Math.sin(wx * 0.061 + 4) * 0.12;
      ctx.lineTo(sx, horizonY + 10 - (32 + n * 30));
    }
    ctx.lineTo(W + 40, horizonY + 40);
    ctx.closePath();
    ctx.fill();

    // 近层：圆冠树剪影
    ctx.fillStyle = '#141f16';
    const off2 = cam.x * 0.62;
    for (let sx = -30; sx <= W + 30; sx += 34) {
      const wx = sx + off2;
      const hh = 34 + (Math.sin(wx * 0.02) * 0.5 + Math.sin(wx * 0.047 + 2) * 0.5) * 18;
      const cx = sx + Math.sin(wx * 0.013) * 6;
      ctx.fillRect(cx - 1, horizonY - hh + 10, 2, hh);
      ctx.beginPath();
      ctx.arc(cx, horizonY - hh + 4, 9 + Math.sin(wx * 0.05) * 3, 0, Math.PI * 2);
      ctx.arc(cx - 7, horizonY - hh + 11, 6, 0, Math.PI * 2);
      ctx.arc(cx + 7, horizonY - hh + 11, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(0, horizonY, W, 40);
  }

  /** 地表装饰：草丛、石子、断裂残片、水面波光（纯视觉，不影响碰撞） */
  drawDecor(cam: Camera, tiles: Uint8Array, heightMap: Uint8Array, time: number) {
    const ctx = this.ctx;
    const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE) - 1);
    const endX = Math.min(MAP_WIDTH, Math.ceil((cam.x + cam.width) / TILE_SIZE) + 1);
    for (let x = startX; x < endX; x++) {
      const sy = heightMap[x];
      if (sy <= 0 || sy >= MAP_HEIGHT) continue;
      const surf = biToBlock(tiles[sy * MAP_WIDTH + x]);
      const sx = Math.floor(x * TILE_SIZE - cam.x);
      const gy = Math.floor(sy * TILE_SIZE - cam.y);

      // 水面波光
      if (BLOCKS[surf]?.liquid) {
        const above = sy - 1 >= 0 ? biToBlock(tiles[(sy - 1) * MAP_WIDTH + x]) : 'empty';
        if (!BLOCKS[above]?.liquid) {
          const wave = Math.sin(time * 2 + x * 0.7) * 1.5;
          // 波光颜色跟随液体：液态金属冷青、岩浆橙金、毒沼浑黄
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = surf === 'magma_lava' ? '#ffc85a'
            : surf === 'murk_water' ? '#b8a888'
            : '#cfefff';
          ctx.fillRect(sx, gy - 2 + wave, TILE_SIZE, 1);
          if (this.decorRand(x, 3) > 0.6) {
            ctx.globalAlpha = 0.85;
            const sp = (time * 20 + x * 7) % TILE_SIZE;
            ctx.fillRect(sx + sp, gy + 3, 2, 1);
          }
          ctx.globalAlpha = 1;
        }
        continue; // 水面上不放草
      }
      if (!BLOCKS[surf] || /door|altar|npc|crystal|chest/.test(surf)) continue;
      // 雪原 / 火山地表不长草，避免绿色植被出现在冷色与灰烬地貌上
      if (saltSurfaces.has(surf)) continue;

      // 草丛（约 45% 的列）
      if (this.decorRand(x, 1) > 0.55) {
        const blades = 2 + Math.floor(this.decorRand(x, 2) * 3);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = this.decorRand(x, 5) > 0.7 ? '#8a9a4f' : '#6d7c3d';
        for (let b = 0; b < blades; b++) {
          const bx = sx + 3 + Math.floor(this.decorRand(x * 7 + b, 4) * 10);
          const bh = 3 + Math.floor(this.decorRand(x * 13 + b, 5) * 5);
          const lean = Math.sin(time * 1.5 + x + b) > 0 ? 1 : 0;
          ctx.fillRect(bx, gy - bh, 1, bh);
          ctx.fillRect(bx + lean, gy - bh - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // 小石子
      if (this.decorRand(x, 6) > 0.82) {
        const px = sx + 4 + Math.floor(this.decorRand(x, 7) * 8);
        ctx.fillStyle = '#5d5560';
        ctx.fillRect(px, gy - 2, 3, 2);
        ctx.fillStyle = '#7a7280';
        ctx.fillRect(px, gy - 2, 2, 1);
      }

      // 残骸带：断裂钢筋/残片剪影
      if (this.decorRand(x, 8) > 0.94) {
        const h = 8 + Math.floor(this.decorRand(x, 9) * 14);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#3a3138';
        ctx.fillRect(sx + 8, gy - h, 2, h);
        ctx.fillRect(sx + 8, gy - h, 5, 2);
        ctx.globalAlpha = 1;
      }

      // 霜蚀冻原：雪面反光
      if (surf === 'frost_snow' && this.decorRand(x, 21) > 0.6) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 1.6 + x * 0.9);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + 3 + Math.floor(this.decorRand(x, 22) * 10), gy - 2, 2, 1);
        ctx.globalAlpha = 1;
      }
      // 熔渣火山：灰面余火
      if (surf === 'ash_ground' && this.decorRand(x, 23) > 0.88) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 3 + x);
        ctx.fillStyle = '#e89430';
        ctx.fillRect(sx + 6, gy - 2, 2, 2);
        ctx.globalAlpha = 1;
      }
      // 腐蚀沼泽：泥沼气泡
      if (surf === 'swamp_mud' && this.decorRand(x, 24) > 0.75) {
        const bub = (time * 8 + x) % 10;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#706050';
        ctx.fillRect(sx + 5, gy - 2 - bub, 2, 2);
        ctx.globalAlpha = 1;
      }
      // 灰烬王庭：地砖反光
      if (surf === 'court_tile' && this.decorRand(x, 25) > 0.7) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#fff8e8';
        ctx.fillRect(sx + 2, gy - 1, 5, 1);
        ctx.globalAlpha = 1;
      }
    }

    // 洞穴氛围：发光尘埃 + 钟乳石剪影（仅地下空腔）
    const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE) - 1);
    const endY = Math.min(MAP_HEIGHT, Math.ceil((cam.y + cam.height) / TILE_SIZE) + 1);
    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const idx = ty * MAP_WIDTH + tx;
        if (biToBlock(tiles[idx]) !== 'empty') continue;
        if (ty <= heightMap[tx] + 8) continue; // 只在地表以下
        const dx = Math.floor(tx * TILE_SIZE - cam.x);
        const dy = Math.floor(ty * TILE_SIZE - cam.y);

        // 发光尘埃
        if (this.decorRand(tx * 131 + ty, 11) > 0.988) {
          const pulse = Math.max(0.1, 0.35 + 0.3 * Math.sin(time * 2 + tx * 0.7 + ty * 0.3));
          ctx.globalAlpha = pulse;
          ctx.fillStyle = '#7fd6c8';
          ctx.fillRect(dx + 6, dy + 6, 2, 2);
          ctx.globalAlpha = 1;
        }
        // 钟乳石：上方实心、当前空气
        if (ty > 0 && biToBlock(tiles[(ty - 1) * MAP_WIDTH + tx]) !== 'empty'
          && this.decorRand(tx * 977 + ty, 12) > 0.9) {
          const len = 3 + Math.floor(this.decorRand(tx + ty * 31, 13) * 5);
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#2a2430';
          ctx.fillRect(dx + 3 + Math.floor(this.decorRand(tx, 14) * 9), dy, 2, len);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  /** 每列确定性随机（0..1），用于稳定的装饰分布 */
  private decorRand(x: number, salt: number): number {
    let h = Math.imul(x ^ (salt * 374761393), 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  drawWorld(tiles: Uint8Array, cam: Camera, breaking: BreakState | null, heightMap?: Uint8Array) {
    const ctx = this.ctx;
    const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE) - 1);
    const endX = Math.min(MAP_WIDTH, Math.ceil((cam.x + cam.width) / TILE_SIZE) + 1);
    const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE) - 1);
    const endY = Math.min(MAP_HEIGHT, Math.ceil((cam.y + cam.height) / TILE_SIZE) + 1);

    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const idx = ty * MAP_WIDTH + tx;
        const id = biToBlock(tiles[idx]);
        if (id === 'empty') {
          // M1: 地下空腔绘制洞穴背景墙（纵深），地表以上的空保持天空
          if (heightMap && ty > heightMap[tx]) {
            this.drawCaveWall(
              ctx,
              Math.floor(tx * TILE_SIZE - cam.x),
              Math.floor(ty * TILE_SIZE - cam.y),
              tx, ty,
              tiles,
            );
          }
          continue;
        }
        // NPC 角色模型（站立方块 → 像素人形，脚底对齐格底）
        const npcModel = NPC_MODELS[id];
        if (npcModel) {
          drawCharacter(
            ctx,
            npcModel,
            Math.floor(tx * TILE_SIZE - cam.x),
            Math.floor(ty * TILE_SIZE - cam.y - TILE_SIZE),
            TILE_SIZE, TILE_SIZE * 2, 1, performance.now() / 1000,
          );
          continue;
        }
        const def = BLOCKS[id];
        if (!def) continue;
        const px = Math.floor(tx * TILE_SIZE - cam.x);
        const py = Math.floor(ty * TILE_SIZE - cam.y);
        // 边缘融合掩码：上右下左是否同类方块
        const sameId = (nx: number, ny: number): boolean => {
          if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return false;
          return biToBlock(tiles[ny * MAP_WIDTH + nx]) === id;
        };
        let mask = 0;
        if (sameId(tx, ty - 1)) mask |= 1;
        if (sameId(tx + 1, ty)) mask |= 2;
        if (sameId(tx, ty + 1)) mask |= 4;
        if (sameId(tx - 1, ty)) mask |= 8;
        const exposedTop = ty === 0 || biToBlock(tiles[idx - MAP_WIDTH]) === 'empty';
        const naturalTop = !!heightMap && Math.abs(ty - heightMap[tx]) <= 1;
        this.drawTile(ctx, px, py, def, tx, ty, mask, exposedTop, naturalTop);
        // 深层冷色偏移，区分浅层/深层
        if (ty > 100) {
          const a = Math.min(0.12, (ty - 100) * 0.0025);
          ctx.fillStyle = `rgba(40, 70, 110, ${a})`;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
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

    // 夜晚与地下黑暗统一由 drawLighting 处理
  }

  /**
   * 光照层 —— 泰拉瑞亚观感的核心：地表明亮，地下漆黑，靠玩家/光源挖出可见区域
   * 做法：离屏画布铺黑 → 用 destination-out 在每个光源处挖出径向渐变
   */
  drawLighting(cam: Camera, tiles: Uint8Array, heightMap: Uint8Array, playerX: number, playerY: number) {
    const W = this.canvas.width, H = this.canvas.height;
    if (this.maskCanvas.width !== W || this.maskCanvas.height !== H) {
      this.maskCanvas.width = W;
      this.maskCanvas.height = H;
    }
    const m = this.maskCtx;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, W, H);

    // 视野内列范围
    const v0 = Math.max(0, Math.floor(cam.x / TILE_SIZE));
    const v1 = Math.min(MAP_WIDTH - 1, Math.ceil((cam.x + W) / TILE_SIZE));

    // 夜晚压暗整屏
    const t = this.timeOfDay;
    const night = (t > 0.55 || t < 0.1)
      ? (t > 0.55 ? Math.min(0.66, (t - 0.55) * 2.0) : Math.min(0.5, (0.1 - t) * 3))
      : 0;
    if (night > 0) {
      m.fillStyle = `rgba(0,0,0,${night})`;
      m.fillRect(0, 0, W, H);
    }

    // 地下：按列带铺竖直渐变 —— 暗区边界贴合地形轮廓，约 9 格后接近全黑
    // 分带（6 格）减少每帧渐变对象数量，避免掉帧
    const DARK = 0.88;
    const BAND = 6;
    for (let x = v0; x <= v1; x += BAND) {
      let hSum = 0, cnt = 0;
      for (let i = 0; i < BAND && x + i <= v1; i++) { hSum += heightMap[x + i]; cnt++; }
      const top = Math.round((hSum / cnt) * TILE_SIZE - cam.y) + 4;
      if (top >= H) continue;
      const sx = Math.round(x * TILE_SIZE - cam.x);
      const g = m.createLinearGradient(0, top, 0, top + 150);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.22, `rgba(0,0,0,${DARK * 0.34})`);
      g.addColorStop(0.6, `rgba(0,0,0,${DARK * 0.78})`);
      g.addColorStop(1, `rgba(0,0,0,${DARK})`);
      m.fillStyle = g;
      m.fillRect(sx, top, TILE_SIZE * BAND + 1, H - top);
    }

    // 挖光
    m.globalCompositeOperation = 'destination-out';
    const punch = (x: number, y: number, r: number, strength: number) => {
      if (x + r < 0 || x - r > W || y + r < 0 || y - r > H) return;
      const rg = m.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(0,0,0,${strength})`);
      rg.addColorStop(0.55, `rgba(0,0,0,${strength * 0.6})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = rg;
      m.beginPath();
      m.arc(x, y, r, 0, Math.PI * 2);
      m.fill();
    };

    // 玩家自带照明
    punch(Math.round(playerX - cam.x), Math.round(playerY - cam.y), 130, 0.95);

    // 发光方块（火焰 / 晶体 / 液金 / 火炬 / 金矿）
    const sx0 = Math.max(0, Math.floor(cam.x / TILE_SIZE));
    const sx1 = Math.min(MAP_WIDTH - 1, Math.ceil((cam.x + W) / TILE_SIZE));
    const sy0 = Math.max(0, Math.floor(cam.y / TILE_SIZE));
    const sy1 = Math.min(MAP_HEIGHT - 1, Math.ceil((cam.y + H) / TILE_SIZE));
    for (let ty = sy0; ty <= sy1; ty++) {
      for (let tx = sx0; tx <= sx1; tx++) {
        const id = biToBlock(tiles[ty * MAP_WIDTH + tx]);
        if (id === 'empty') continue;
        const light = BLOCKS[id]?.emitsLight ?? 0;
        if (light <= 0) continue;
        punch(
          Math.round(tx * TILE_SIZE + TILE_SIZE / 2 - cam.x),
          Math.round(ty * TILE_SIZE + TILE_SIZE / 2 - cam.y),
          light * 5 + 14,
          0.85,
        );
      }
    }

    m.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.maskCanvas, 0, 0);
  }

  /** M1: 洞穴背景墙 — 地下空腔的暗色岩壁 + 四面 AO 阴影，增加纵深 */
  private drawCaveWall(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    tx: number,
    ty: number,
    tiles: Uint8Array,
  ) {
    const seed = (tx * 2246822519 + ty * 3266489917) >>> 0;
    const depth = Math.max(0, Math.min(1, (ty - 70) / 130));
    const r = Math.round(34 - depth * 14);
    const g = Math.round(27 - depth * 12);
    const b = Math.round(26 + depth * 10);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    for (let i = 0; i < 8; i++) {
      const s = (seed + i * 2654435761) >>> 0;
      const vx = (s & 0xf) % (TILE_SIZE - 2);
      const vy = ((s >> 4) & 0xf) % (TILE_SIZE - 2);
      ctx.fillStyle = ((s >> 8) & 1) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.22)';
      ctx.fillRect(px + vx, py + vy, 2, 2);
    }

    // AO：与实心方块相邻的边加深，形成洞穴阴影
    const solid = (nx: number, ny: number): boolean => {
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return false;
      return biToBlock(tiles[ny * MAP_WIDTH + nx]) !== 'empty';
    };
    if (solid(tx, ty - 1)) {
      ctx.fillStyle = 'rgba(0,0,0,0.50)';
      ctx.fillRect(px, py, TILE_SIZE, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.fillRect(px, py + 2, TILE_SIZE, 3);
    }
    if (solid(tx, ty + 1)) {
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(px, py + TILE_SIZE - 5, TILE_SIZE, 3);
    }
    if (solid(tx - 1, ty)) {
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(px, py, 2, TILE_SIZE);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(px + 2, py, 3, TILE_SIZE);
    }
    if (solid(tx + 1, ty)) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(px + TILE_SIZE - 2, py, 2, TILE_SIZE);
    }
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    def: typeof BLOCKS[string],
    tx: number,
    ty: number,
    mask = 0,
    exposedTop = false,
    naturalTop = false,
  ) {
    // mask 位：1=上同类 2=右同类 4=下同类 8=左同类
    const baseColor = PALETTE_MAP.get(def.paletteId) ?? '#888';
    const grp = def.paletteId.slice(0, 4);
    const seed = (tx * 374761393 + ty * 668265263) >>> 0;

    ctx.fillStyle = baseColor;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // === 公共颗粒纹理（少量，避免逐格噪点让地下变成马赛克）===
    for (let i = 0; i < 6; i++) {
      const s = (seed + i * 2654435761) >>> 0;
      const vx = (s & 0xf) % (TILE_SIZE - 2);
      const vy = ((s >> 4) & 0xf) % (TILE_SIZE - 2);
      ctx.fillStyle = ((s >> 8) & 1) ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(px + vx, py + vy, 2, 2);
    }

    // === 材质专属图案 ===
    switch (grp) {
      case 'rust': {
        // 岩石/锈土：短裂纹
        const n = 2 + (seed % 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.36)';
        ctx.lineWidth = 1;
        for (let i = 0; i < n; i++) {
          const s = (seed + i * 7919) >>> 0;
          const x0 = 2 + (s % 9);
          const y0 = 2 + ((s >> 4) % 9);
          ctx.beginPath();
          ctx.moveTo(px + x0 + 0.5, py + y0 + 0.5);
          ctx.lineTo(px + x0 + 3 + ((s >> 8) % 4) + 0.5, py + y0 + 2 + ((s >> 12) % 3) + 0.5);
          ctx.stroke();
        }
        break;
      }
      case 'iron': {
        // 金属：铆钉点阵
        const pts: [number, number][] = [[3, 3], [11, 4], [5, 11], [12, 12]];
        for (const [dx, dy] of pts) {
          ctx.fillStyle = 'rgba(0,0,0,0.32)';
          ctx.fillRect(px + dx, py + dy, 2, 2);
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.fillRect(px + dx, py + dy, 1, 1);
        }
        break;
      }
      case 'embe': {
        // 余烬：火星亮点
        const n = 2 + (seed % 3);
        for (let i = 0; i < n; i++) {
          const s = (seed + i * 104729) >>> 0;
          ctx.fillStyle = 'rgba(255, 214, 130, 0.75)';
          ctx.fillRect(px + 2 + (s % 12), py + 2 + ((s >> 6) % 12), 1, 1);
        }
        break;
      }
      case 'bone': {
        // 骨白：暗斑
        const s = seed >>> 3;
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(px + 3 + (s % 6), py + 4 + ((s >> 3) % 6), 3, 2);
        break;
      }
      case 'cold': {
        // 液态金属：横向波光
        ctx.fillStyle = 'rgba(255,255,255,0.26)';
        ctx.fillRect(px + 2, py + 5 + (seed % 3), 12, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(px + 3, py + 9 + ((seed >> 4) % 3), 9, 1);
        break;
      }
      case 'void': {
        // 虚空：紫色星点
        const s = seed >>> 2;
        ctx.fillStyle = 'rgba(248, 212, 255, 0.70)';
        ctx.fillRect(px + 3 + (s % 10), py + 3 + ((s >> 4) % 10), 1, 1);
        ctx.fillRect(px + 4 + ((s >> 8) % 9), py + 5 + ((s >> 12) % 8), 1, 1);
        break;
      }
    }

    // === 边缘融合：只在朝向空气的一侧画明暗，内部不做逐格分隔（避免瓦片网格感）===
    if (!(mask & 1) && exposedTop) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(px, py, TILE_SIZE, 2);
    }
    if (!(mask & 4)) {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
    }
    if (!(mask & 8)) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(px, py, 1, TILE_SIZE);
    }
    if (!(mask & 2)) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
    }

    // === 露天顶面：草皮 / 矿物壳层 ===
    if (exposedTop) {
      this.drawSurfaceCrust(ctx, px, py, def, seed, naturalTop);
    }

    // === 矿石：中心亮斑 + 十字星光 ===
    if (def.id.includes('ore') || def.id === 'crystal_glow' || def.id === 'void_crystal' || def.id === 'bio_glow') {
      ctx.fillStyle = 'rgba(255,255,255,0.80)';
      ctx.fillRect(px + 6, py + 6, 4, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(px + 4, py + 7, 2, 2);
      ctx.fillRect(px + 10, py + 7, 2, 2);
      ctx.fillRect(px + 7, py + 4, 2, 2);
      ctx.fillRect(px + 7, py + 10, 2, 2);
    }

    if (def.emitsLight && def.emitsLight > 0) {
      const intensity = def.emitsLight / 15;
      ctx.fillStyle = `rgba(${intensity * 200 + 55}, ${intensity * 150 + 50}, ${intensity * 100 + 55}, ${intensity * 0.25})`;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  /** 地表壳层 —— 草皮盖住方块顶面，让地表读起来是"地面"而不是积木 */
  private drawSurfaceCrust(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    def: typeof BLOCKS[string],
    seed: number,
    natural: boolean,
  ) {
    const grp = def.paletteId.slice(0, 4);
    const noPlant = grp === 'cold' || def.id === 'metal_float' || def.id === 'rebel_brick';
    if (!natural || noPlant) {
      ctx.fillStyle = 'rgba(255, 232, 180, 0.26)';
      ctx.fillRect(px, py, TILE_SIZE, 2);
      return;
    }

    const moss = grp === 'void'
      ? { dark: '#3a2a52', mid: '#4c3a68', light: '#6a5488' }
      : grp === 'iron'
        ? { dark: '#3c4a2a', mid: '#51603a', light: '#6e8048' }
        : { dark: '#3f6b26', mid: '#55913a', light: '#79b84c' };

    // 草皮 4~5px：暗底 + 中间调 + 顶部高光
    ctx.fillStyle = moss.dark;
    ctx.fillRect(px, py, TILE_SIZE, 5);
    ctx.fillStyle = moss.mid;
    ctx.fillRect(px, py, TILE_SIZE, 3);
    ctx.fillStyle = moss.light;
    ctx.fillRect(px, py, TILE_SIZE, 1);

    // 下沿垂坠（草土交界的有机边缘）
    const n = 2 + (seed % 3);
    for (let i = 0; i < n; i++) {
      const s = (seed + i * 7349) >>> 0;
      ctx.fillStyle = moss.dark;
      ctx.fillRect(px + (s % TILE_SIZE), py + 5, 1, 2 + ((s >> 6) % 3));
    }
    // 向上草叶
    for (let i = 0; i < 4; i++) {
      const s = (seed + i * 31337) >>> 0;
      const bh = 2 + ((s >> 5) % 4);
      ctx.fillStyle = i % 2 === 0 ? moss.mid : moss.light;
      ctx.fillRect(px + 1 + (s % (TILE_SIZE - 2)), py - bh, 1, bh);
    }
  }

  /**
   * 地表装饰层 —— 树 / 灌木 / 草丛 / 花
   * 纯渲染：不进 tiles、不参与碰撞；位置由世界坐标哈希决定，相机移动不抖动
   */
  drawScenery(cam: Camera, tiles: Uint8Array, heightMap: Uint8Array) {
    const ctx = this.ctx;
    const c0 = Math.max(0, Math.floor(cam.x / TILE_SIZE) - 3);
    const c1 = Math.min(MAP_WIDTH - 1, Math.ceil((cam.x + this.canvas.width) / TILE_SIZE) + 3);
    const spacing = 9;

    for (let x = c0; x <= c1; x++) {
      const sy = heightMap[x];
      if (sy <= 0 || sy >= MAP_HEIGHT) continue;
      const surf = biToBlock(tiles[sy * MAP_WIDTH + x]);
      if (surf === 'empty') continue;          // 地表被挖开
      if (saltSurfaces.has(surf)) continue;    // 液态金属/废墟不长植物
      const sx = Math.round(x * TILE_SIZE + TILE_SIZE / 2 - cam.x);
      const gy = Math.round(sy * TILE_SIZE - cam.y - 1);

      const hg = this.hash01(x * 37 + 11);
      if (hg < 0.60) this.drawGrassTuft(ctx, sx, gy, x);
      if (hg > 0.95) this.drawFlower(ctx, sx, gy, x);

      // 树：按分块抖动定位（纯函数，避免随相机扫描顺序变化而闪烁）
      const blk = Math.floor(x / spacing);
      const treeCol = blk * spacing + Math.floor(this.hash01(blk * 7 + 13) * spacing);
      if (x !== treeCol) continue;
      const th = this.hash01(blk * 131 + 5);
      if (th < 0.26) this.drawBush(ctx, sx, gy, th);
      else this.drawTree(ctx, sx, gy, 4 + Math.floor(th * 6), blk);
    }
  }

  private drawGrassTuft(ctx: CanvasRenderingContext2D, sx: number, gy: number, x: number) {
    const n = 3 + Math.floor(this.hash01(x * 17 + 3) * 3);
    for (let i = 0; i < n; i++) {
      const bx = sx - 7 + Math.floor(this.hash01(x * 91 + i * 53) * 14);
      const bh = 3 + Math.floor(this.hash01(x * 13 + i * 7) * 4);
      ctx.fillStyle = i % 2 === 0 ? '#5b8f3a' : '#3f6f2a';
      ctx.fillRect(bx, gy - bh, 1, bh);
    }
  }

  private drawFlower(ctx: CanvasRenderingContext2D, sx: number, gy: number, x: number) {
    const h = 4 + Math.floor(this.hash01(x * 23) * 3);
    ctx.fillStyle = '#3f6f2a';
    ctx.fillRect(sx, gy - h, 1, h);
    const cols = ['#e8c547', '#e86a5a', '#c8a0e8'];
    ctx.fillStyle = cols[x % cols.length];
    ctx.fillRect(sx - 1, gy - h - 2, 3, 2);
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(sx, gy - h - 1, 1, 1);
  }

  private drawBush(ctx: CanvasRenderingContext2D, sx: number, gy: number, seed: number) {
    const r = 7 + Math.floor(seed * 18);
    ctx.fillStyle = '#2c5426';
    ctx.beginPath();
    ctx.arc(sx, gy - r * 0.7, r, 0, Math.PI * 2);
    ctx.arc(sx - r * 0.7, gy - r * 0.3, r * 0.7, 0, Math.PI * 2);
    ctx.arc(sx + r * 0.7, gy - r * 0.3, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7a30';
    ctx.beginPath();
    ctx.arc(sx - 1, gy - r * 0.9, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTree(
    ctx: CanvasRenderingContext2D, sx: number, gy: number,
    hTiles: number, seed: number,
  ) {
    const trunkH = hTiles * TILE_SIZE;
    const trunkW = 6 + (seed % 3);
    const topY = gy - trunkH;

    // 落影
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx, gy, trunkW * 1.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 枝干（在树干前画，形成分叉）
    ctx.fillStyle = '#33241a';
    const b1 = this.hash01(seed * 29 + 3);
    const b2 = this.hash01(seed * 53 + 9);
    ctx.fillRect(sx - Math.round(trunkW * 1.6), topY + Math.round(trunkH * b1), Math.round(trunkW * 1.6), 3);
    ctx.fillRect(sx + Math.round(trunkW * 0.4), topY + Math.round(trunkH * b2), Math.round(trunkW * 1.6), 3);

    // 树干
    ctx.fillStyle = '#3b2a1b';
    ctx.fillRect(sx - trunkW / 2, topY, trunkW, trunkH);
    ctx.fillStyle = '#5c4128';
    ctx.fillRect(sx - trunkW / 2, topY, 2, trunkH);
    ctx.fillStyle = '#2a1d12';
    ctx.fillRect(sx + trunkW / 2 - 2, topY, 2, trunkH);
    // 树根
    ctx.fillStyle = '#3b2a1b';
    ctx.fillRect(sx - trunkW / 2 - 3, gy - 5, 3, 5);
    ctx.fillRect(sx + trunkW / 2, gy - 5, 3, 5);

    // 树冠：多个叶团叠出不规则轮廓（避免"棒棒糖"式圆球）
    const cr = 15 + (seed % 5) * 3;
    const cy = topY + 4;
    const puff = (i: number): [number, number, number] => {
      const a = this.hash01(seed * 71 + i * 37);
      const b = this.hash01(seed * 43 + i * 19);
      return [
        sx + (a - 0.5) * cr * 1.5,
        cy + 4 + (b - 0.5) * cr * 0.9,
        cr * (0.45 + b * 0.35),
      ];
    };
    ctx.fillStyle = '#2c5426';
    ctx.beginPath();
    ctx.arc(sx + 2, cy + 8, cr * 0.95, 0, Math.PI * 2);
    for (let i = 0; i < 4; i++) {
      const [x1, y1, r1] = puff(i);
      ctx.arc(x1, y1, r1, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#3f7a30';
    ctx.beginPath();
    ctx.arc(sx - 3, cy + 2, cr * 0.72, 0, Math.PI * 2);
    for (let i = 0; i < 2; i++) {
      const [x1, y1, r1] = puff(i + 5);
      ctx.arc(x1, y1 - 3, r1 * 0.8, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#5fa33c';
    ctx.beginPath();
    ctx.arc(sx - cr * 0.30, cy - 4, cr * 0.44, 0, Math.PI * 2);
    ctx.arc(sx + cr * 0.34, cy - 1, cr * 0.32, 0, Math.PI * 2);
    ctx.fill();
    // 叶簇点状高光 —— 压住过于圆润的边缘，保留像素感
    for (let i = 0; i < 10; i++) {
      const h1 = this.hash01(seed * 97 + i * 31);
      const h2 = this.hash01(seed * 61 + i * 17);
      ctx.fillStyle = i % 3 === 0 ? '#7dc45a' : 'rgba(18,48,18,0.38)';
      ctx.fillRect(
        Math.round(sx + (h1 - 0.5) * cr * 1.7),
        Math.round(cy + (h2 - 0.3) * cr * 1.5),
        2, 2,
      );
    }
  }

  private drawBreakOverlay(ctx: CanvasRenderingContext2D, px: number, py: number, frac: number, tx: number, ty: number) {
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
    if (frac > 0.9) {
      ctx.fillStyle = `rgba(0,0,0,${(frac - 0.9) * 3})`;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  // M23: 骑乘渲染 — 在玩家下方画坐骑色块
  drawMount(p: Player, cam: Camera) {
    if (!p.mounted || !p.mountId) return;
    const m = MOUNT_DEFS[p.mountId];
    if (!m) return;
    const ctx = this.ctx;
    const px = Math.floor(p.x - cam.x - p.width / 2);
    const py = Math.floor(p.y - cam.y - p.height / 2);
    const color = PALETTE_MAP.get(m.paletteId) ?? '#888';

    // 坐骑像素模型：史莱姆→blob，其余→四足兽形（飞龙带翼与角）
    const mw = p.width + 12;
    const mh = 20;
    drawCharacter(
      ctx,
      makeModel(color, '#ffffff', {
        kind: p.mountId === 'slime_mount' ? 'blob' : 'beast',
        wings: m.canFly,
        horns: m.canFly,
      }),
      px + p.width / 2 - mw / 2,
      py + p.height - mh + 5,
      mw, mh,
      p.facing,
      performance.now() / 1000,
    );
  }

  // M24: 钓鱼渲染 — 鱼线 + 浮标
  drawFishing(active: boolean, hasBite: boolean, floatX: number, floatY: number, px: number, py: number, cam: Camera) {
    if (!active) return;
    const ctx = this.ctx;
    const fx = Math.floor(floatX - cam.x);
    const fy = Math.floor(floatY - cam.y);
    const hx = Math.floor(px - cam.x);
    const hy = Math.floor(py - cam.y - 8);

    // 鱼线
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(fx, fy);
    ctx.stroke();

    // 浮标（上钩时闪烁红色）
    const blink = hasBite && Math.floor(Date.now() / 120) % 2 === 0;
    ctx.fillStyle = hasBite ? (blink ? '#ff4040' : '#ff8080') : '#f0f0f0';
    ctx.fillRect(fx - 2, fy - 3, 4, 5);
    ctx.fillStyle = '#c04040';
    ctx.fillRect(fx - 1, fy - 1, 2, 2);
  }

  // M25: 宠物渲染 — 色块 + 光源光晕
  drawPet(pet: Pet, cam: Camera) {
    const def = PET_DEFS[pet.defId];
    if (!def) return;
    const ctx = this.ctx;
    const px = Math.floor(pet.x - cam.x);
    const py = Math.floor(pet.y - cam.y);
    const s = def.size;

    // 光源光晕（光源宠物）
    if (def.type === 'light' && def.lightRadius && def.lightColor) {
      const grad = ctx.createRadialGradient(px, py, 2, px, py, def.lightRadius);
      grad.addColorStop(0, def.lightColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, def.lightRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 宠物像素模型：光源精灵→飞行体，战斗召唤物→幼龙兽形
    const color = PALETTE_MAP.get(def.paletteId) ?? '#888';
    drawCharacter(
      ctx,
      makeModel(color, def.type === 'combat' ? '#ff6ad5' : '#ffffff', {
        kind: def.type === 'combat' ? 'beast' : 'flyer',
        wings: def.type === 'combat',
        horns: def.type === 'combat',
      }),
      px - s / 2, py - s / 2, s, s * 1.1, 1, performance.now() / 1000,
    );
  }

  drawPlayer(p: Player, cam: Camera, shell?: ShellDef, alpha = 1, anim?: CharAnim) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    const px = Math.floor(p.x - cam.x - p.width / 2);
    const py = Math.floor(p.y - cam.y - p.height / 2);

    // 躯壳配色
    const shellColors = shell ? SHELL_COLORS[shell.palette] : { head: '#e8dcc0', body: '#8a9096', eye: '#ffc85a' };

    // M1: 角色柔光 — 提升在复杂地形中的可见度
    const glow = ctx.createRadialGradient(
      px + p.width / 2, py + p.height / 2, 2,
      px + p.width / 2, py + p.height / 2, 26,
    );
    glow.addColorStop(0, 'rgba(255, 210, 130, 0.16)');
    glow.addColorStop(1, 'rgba(255, 210, 130, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - 18, py - 18, p.width + 36, p.height + 36);

    // 地面投影 —— 用落影代替方块描边，让人物与地表有接触关系
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(px + p.width / 2, py + p.height + 1, p.width * 0.52, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 像素模型（头 / 躯干 / 四肢 / 武器）
    const toolName = (p as Player & { toolName?: string }).toolName ?? 'hand_pickaxe';
    const tool = TOOLS[toolName] ?? TOOLS.hand_pickaxe;
    // 武器形态：远程按弹药区分弓 / 法杖，钓鱼竿单独绘制
    const weaponKind = tool.category === 'ranged'
      ? (tool.ammoType === 'dark_bolt' ? 'staff' : 'bow')
      : tool.category === 'fishing' ? 'rod' : tool.category;
    const mergedAnim: CharAnim = {
      moving: anim?.moving ?? Math.abs(p.vx) > 25,
      onGround: anim?.onGround ?? p.onGround,
      sprint: anim?.sprint ?? false,
      attack: anim?.attack ?? 0,
      aim: anim?.aim,
      weaponKind,
    };

    // 近战挥砍弧光（跟随攻击进度扫过）
    if (mergedAnim.attack && mergedAnim.attack > 0 && weaponKind === 'sword') {
      const prog = Math.min(1, (1 - mergedAnim.attack) * 1.6);
      ctx.save();
      ctx.translate(px + p.width / 2, py + p.height * 0.55);
      ctx.scale(p.facing, 1);
      ctx.globalAlpha = (1 - prog) * 0.6 + 0.15;
      ctx.strokeStyle = 'rgba(255,244,200,0.9)';
      ctx.lineWidth = Math.max(2, p.width * 0.12);
      ctx.beginPath();
      ctx.arc(0, 0, p.width, -1.15, -1.15 + 2.1 * prog);
      ctx.stroke();
      ctx.restore();
    }

    drawCharacter(
      ctx,
      makeModel(shellColors.body, shellColors.eye, {
        kind: 'humanoid',
        light: shellColors.head,
        accent: shellColors.head,
        weapon: PALETTE_MAP.get(tool.paletteId) ?? '#888',
        skin: '#d8a273',
        headgear: 'helmet',
        visualScale: 1.22,
      }),
      px, py, p.width, p.height, p.facing, performance.now() / 1000, 1, mergedAnim,
    );

    // HP bar
    const barW = p.width + 4, barH = 3;
    const barX = px - 2, barY = py - 6;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX, barY, barW, barH);
    const hpFrac = p.hp / p.maxHp;
    ctx.fillStyle = hpFrac > 0.5 ? '#7ad4e8' : hpFrac > 0.25 ? '#e89430' : '#ff4a3a';
    ctx.fillRect(barX, barY, barW * hpFrac, barH);

    // 躯壳名（头顶，带描边确保任意背景可读）
    if (shell) {
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(shell.name, px + p.width / 2, py - 9);
      ctx.fillStyle = shellColors.head;
      ctx.fillText(shell.name, px + p.width / 2, py - 9);
    }

    ctx.globalAlpha = 1;
  }

  drawGlowAura(p: Player, cam: Camera) {
    const ctx = this.ctx;
    const px = Math.floor(p.x - cam.x);
    const py = Math.floor(p.y - cam.y);
    const grad = ctx.createRadialGradient(px, py, 4, px, py, TILE_SIZE * 15);
    grad.addColorStop(0, 'rgba(255, 200, 90, 0.25)');
    grad.addColorStop(0.5, 'rgba(255, 150, 48, 0.10)');
    grad.addColorStop(1, 'rgba(255, 150, 48, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, TILE_SIZE * 15, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEnemies(enemies: Enemy[], cam: Camera) {
    const ctx = this.ctx;
    for (const e of enemies) {
      if (e.state === 'dead' && e.deathProgress >= 1) continue;
      const epx = Math.floor(e.x - cam.x - enemyHalfW(e));
      const epy = Math.floor(e.y - cam.y - enemyHalfH(e));
      const { main, dark, eye } = enemySpriteColors(e);
      if (e.hurtCooldown > 0 && Math.floor(e.hurtCooldown * 20) % 2 === 0) ctx.globalAlpha = 0.6;
      if (e.state === 'dead') ctx.globalAlpha = Math.max(0, 1 - e.deathProgress);
      const w = e.def.width, h = e.def.height;
      // 像素模型：史莱姆→blob，跳跃型→beast，飞行型→flyer，其余→humanoid
      const kind: CharKind = e.def.type.includes('slime')
        ? 'blob'
        : e.def.behavior === 'hopper'
          ? 'beast'
          : e.def.behavior === 'flyer'
            ? 'flyer'
            : 'humanoid';
      const elite = (e.def as { isElite?: boolean }).isElite === true;
      drawCharacter(
        ctx,
        makeModel(main, eye, {
          kind,
          dark,
          crown: elite,
          horns: e.def.behavior === 'chaser' || e.def.behavior === 'hopper' || elite,
          weapon: e.def.behavior === 'chaser' ? dark : undefined,
        }),
        epx, epy, w, h, e.facing, performance.now() / 1000,
      );
      ctx.globalAlpha = 1;
      if (e.hp < e.def.hp && e.state !== 'dead') {
        const barW = w, barH = 2;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(epx, epy - 5, barW, barH);
        ctx.fillStyle = '#ff4a3a';
        ctx.fillRect(epx, epy - 5, barW * (e.hp / e.def.hp), barH);
      }
    }
  }


  drawPlacementGhost(blockId: string, tx: number, ty: number, cam: Camera, isSolid: boolean) {
    const ctx = this.ctx;
    if (!blockId || blockId === 'empty') return;
    const px = Math.floor(tx * TILE_SIZE - cam.x);
    const py = Math.floor(ty * TILE_SIZE - cam.y);
    const def = BLOCKS[blockId];
    if (!def) return;
    ctx.globalAlpha = isSolid ? 0.15 : 0.5;
    ctx.fillStyle = PALETTE_MAP.get(def.paletteId) ?? '#888';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PALETTE_MAP.get(isSolid ? 'ui02' : 'ui01') ?? '#e8c547';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    ctx.setLineDash([]);
  }

  drawHotbar(inv: Inventory) {
    const ctx = this.ctx;
    const slotSize = 44;
    const gap = 4;
    const totalW = 9 * slotSize + 8 * gap;
    const startX = Math.floor((this.canvas.width - totalW) / 2);
    const startY = this.canvas.height - slotSize - 12;

    for (let i = 0; i < 9; i++) {
      const slot = inv.hotbar[i];
      const sx = startX + i * (slotSize + gap);
      // 背景
      ctx.fillStyle = i === inv.selectedHotbar ? '#3a2a1a' : '#1a1410';
      ctx.fillRect(sx, startY, slotSize, slotSize);
      ctx.strokeStyle = i === inv.selectedHotbar ? '#e8c547' : '#4a3828';
      ctx.lineWidth = i === inv.selectedHotbar ? 2 : 1;
      ctx.strokeRect(sx + 0.5, startY + 0.5, slotSize - 1, slotSize - 1);

      // 物品图标（缩放）
      if (slot.count > 0 && slot.blockId) {
        const def = BLOCKS[slot.blockId];
        if (def) {
          ctx.fillStyle = PALETTE_MAP.get(def.paletteId) ?? '#888';
          const ic = 24;
          ctx.fillRect(sx + (slotSize - ic) / 2, startY + (slotSize - ic) / 2, ic, ic);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(sx + (slotSize - ic) / 2, startY + (slotSize - ic) / 2, ic, 2);
        }
        // 数量
        if (slot.count > 1) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(slot.count), sx + slotSize - 4, startY + slotSize - 2);
        }
      }
      // 序号
      ctx.fillStyle = '#5a4838';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(i + 1), sx + 3, startY + 2);
    }
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

  /** 黑雾粒子云（在世界层之后、玩家之前绘制） */
  drawVoidParticles(cam: Camera, voidEngine: VoidEngine) {
    const ctx = this.ctx;
    for (const p of voidEngine.particles) {
      const px = Math.floor(p.x - cam.x);
      const py = Math.floor(p.y - cam.y);
      if (px < -20 || px > this.canvas.width + 20) continue;
      if (py < -20 || py > this.canvas.height + 20) continue;
      ctx.globalAlpha = p.alpha;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size);
      grad.addColorStop(0, 'rgba(30, 10, 50, 0.9)');
      grad.addColorStop(0.5, 'rgba(40, 20, 70, 0.5)');
      grad.addColorStop(1, 'rgba(40, 20, 70, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 同化进度覆盖层（紫色发光，用于提示哪些方块正在被污染） */
  drawVoidProgressOverlay(cam: Camera, voidEngine: VoidEngine) {
    const ctx = this.ctx;
    const startX = Math.max(0, Math.floor(cam.x / TS) - 1);
    const endX = Math.min(MW, Math.ceil((cam.x + cam.width) / TS) + 1);
    const startY = Math.max(0, Math.floor(cam.y / TS) - 1);
    const endY = Math.min(MH, Math.ceil((cam.y + cam.height) / TS) + 1);
    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const prog = voidEngine.progress[ty * MW + tx];
        if (prog === 0) continue;
        const frac = prog / 255;
        const px = Math.floor(tx * TS - cam.x);
        const py = Math.floor(ty * TS - cam.y);
        // 紫色覆盖，越满越亮
        ctx.globalAlpha = 0.15 + frac * 0.25;
        ctx.fillStyle = `rgba(120, 40, 200, ${0.3 + frac * 0.5})`;
        ctx.fillRect(px, py, TS, TS);
        // 闪烁亮点
        if (Math.random() < 0.02 + frac * 0.05) {
          ctx.fillStyle = 'rgba(200, 150, 255, 0.9)';
          ctx.fillRect(px + Math.floor(Math.random() * TS), py + Math.floor(Math.random() * TS), 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawBoss(boss: Boss, cam: Camera) {
    const ctx = this.ctx;
    const isDead = boss.isDead;
    const alpha = isDead ? Math.max(0, 1 - boss.deathProgress) : 1;
    ctx.globalAlpha = alpha;
    const bpx = Math.floor(boss.x - cam.x - bossHalfW(boss));
    const bpy = Math.floor(boss.y - cam.y - bossHalfH(boss));

    // 受伤闪烁
    if (boss.hurtCooldown > 0 && Math.floor(boss.hurtCooldown * 20) % 2 === 0) {
      ctx.globalAlpha = alpha * 0.6;
    }

    // Phase 颜色变化
    let bodyColor = '#5a1088', darkColor = '#2a0555', eyeColor = '#ff40c0';
    if (boss.phase === 'phase2') { bodyColor = '#8020a0'; darkColor = '#400565'; eyeColor = '#ff60d0'; }
    if (boss.phase === 'phase3') { bodyColor = '#c040e0'; darkColor = '#600590'; eyeColor = '#ff80ff'; }

    // Boss 像素模型（泰坦体型 + 王冠 / 角 / 多眼 / 触须）
    const w = boss.def.width, h = boss.def.height;
    drawCharacter(
      ctx,
      makeModel(bodyColor, eyeColor, {
        kind: 'titan',
        dark: darkColor,
        accent: darkColor,
        crown: true,
        horns: true,
        multiEye: true,
      }),
      bpx, bpy, w, h, boss.facing, performance.now() / 1000,
    );
    // 发光光环（phase3 更强）
    if (!isDead) {
      ctx.globalAlpha = alpha * (boss.phase === 'phase3' ? 0.35 : boss.phase === 'phase2' ? 0.2 : 0.12);
      const glow = ctx.createRadialGradient(boss.x - cam.x, boss.y - cam.y, 10, boss.x - cam.x, boss.y - cam.y, 60);
      glow.addColorStop(0, boss.phase === 'phase3' ? 'rgba(255, 80, 255, 0.5)' : 'rgba(180, 60, 220, 0.4)');
      glow.addColorStop(1, 'rgba(60, 10, 80, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(boss.x - cam.x, boss.y - cam.y, 60, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Boss HP bar（屏幕顶部中央）
    const barW = Math.min(400, this.canvas.width - 100);
    const barH = 14;
    const barX = (this.canvas.width - barW) / 2;
    const barY = 60;
    ctx.fillStyle = '#0a0010';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#a040c0'; ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
    const frac = boss.hp / boss.def.hp;
    const hpGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    hpGrad.addColorStop(0, '#8020a0');
    hpGrad.addColorStop(1, '#ff40c0');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(barX + 2, barY + 2, (barW - 4) * frac, barH - 4);

    // Boss 名
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(boss.def.name, this.canvas.width / 2, barY - 2);

    // 阶段标记
    const phaseText = boss.phase === 'phase1' ? 'Phase 1 · 追击' : boss.phase === 'phase2' ? 'Phase 2 · 召唤' : 'Phase 3 · 狂暴';
    ctx.fillStyle = frac < 0.33 ? '#ff40c0' : frac < 0.66 ? '#e89430' : '#7ad4e8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(phaseText, this.canvas.width / 2, barY + barH + 12);
  }

  drawBossProjectiles(projs: BossProjectile[], cam: Camera) {
    const ctx = this.ctx;
    for (const p of projs) {
      const px = Math.floor(p.x - cam.x);
      const py = Math.floor(p.y - cam.y);
      // 发光效果
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(px, py, p.size + 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, p.size - 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawCompanions(companions: Companion[], cam: Camera) {
    const ctx = this.ctx;
    for (const c of companions) {
      if (c.hp <= 0) continue;
      const cpx = Math.floor(c.x - cam.x - compHalfW(c));
      const cpy = Math.floor(c.y - cam.y - compHalfH(c));
      const sc = companionSpriteColors(c);
      // 队友像素模型（与玩家同一套人形结构）
      const wColor = c.def.weapon === 'melee' ? '#e8c547' : '#ff8040';
      drawCharacter(
        ctx,
        makeModel(sc.body, sc.eye, {
          kind: 'humanoid',
          light: sc.head,
          accent: sc.head,
          weapon: wColor,
          skin: '#d8a273',
          headgear: 'helmet',
          visualScale: 1.15,
        }),
        cpx, cpy, TILE_SIZE * 0.75, TILE_SIZE * 1.75, c.facing, performance.now() / 1000,
      );
      // HP bar
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(cpx - 1, cpy - 5, TILE_SIZE * 0.75 + 2, 2);
      ctx.fillStyle = '#7ad4e8';
      ctx.fillRect(cpx - 1, cpy - 5, (TILE_SIZE * 0.75 + 2) * (c.hp / c.def.hp), 2);
      // 名字
      ctx.fillStyle = '#c8b898';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(c.def.name, cpx + TILE_SIZE * 0.75 / 2, cpy - 8);
      // 招募提示（civilian 状态）
      if (c.state === 'civilian') {
        ctx.fillStyle = '#e8c547';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('[F] 招募', cpx + TILE_SIZE * 0.75 / 2, cpy - 20);
      }
    }
  }

  drawCompanionProjs(projs: { x: number; y: number; vx: number; vy: number; damage: number; ownerId: number; life: number; maxLife: number }[], cam: Camera) {
    const ctx = this.ctx;
    for (const p of projs) {
      const px = Math.floor(p.x - cam.x), py = Math.floor(p.y - cam.y);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffc85a';
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 伤害弹出数字（飘字）*/
  drawDamageTexts(dmgTexts: { x: number; y: number; vy: number; text: string; color: string; life: number; maxLife: number; crit: boolean }[], cam: Camera) {
    const ctx = this.ctx;
    for (const t of dmgTexts) {
      if (t.life <= 0) continue;
      const alpha = Math.min(1, t.life / t.maxLife);
      const px = Math.floor(t.x - cam.x);
      const py = Math.floor(t.y - cam.y - (1 - t.life / t.maxLife) * 20);
      ctx.globalAlpha = alpha;
      if (t.crit) {
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#ff8040';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(t.text, px, py);
        ctx.fillText(t.text, px, py);
      } else {
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = t.color;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText(t.text, px, py);
        ctx.fillText(t.text, px, py);
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  /** 小地图（右上角缩略图）*/
  drawMinimap(cam: Camera, tiles: Uint8Array, playerX: number, playerY: number) {
    const ctx = this.ctx;
    const mmW = 160, mmH = 80;
    const mmX = this.canvas.width - mmW - 12;
    const mmY = 12;
    const scaleX = mmW / MAP_WIDTH;
    const scaleY = mmH / MAP_HEIGHT;

    // 背景
    ctx.fillStyle = 'rgba(10, 6, 16, 0.85)';
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = '#5a3828'; ctx.lineWidth = 1;
    ctx.strokeRect(mmX + 0.5, mmY + 0.5, mmW - 1, mmH - 1);

    // 地形（抽稀绘制）
    const step = 2;
    for (let y = 0; y < MAP_HEIGHT; y += step) {
      for (let x = 0; x < MAP_WIDTH; x += step) {
        const idx = tiles[y * MAP_WIDTH + x];
        if (idx === 0) continue; // empty 跳过
        // 根据 BLOCKS 位置快速着色
        let c = '#5a3828';
        if (idx >= 21) c = '#5a1088'; // void
        else if (idx >= 15 && idx <= 19) c = '#8040e8'; // void_crystal 等
        else if (idx >= 13 && idx <= 14) c = '#404050'; // deep
        else if (idx >= 9 && idx <= 12) c = '#807060'; // ore
        else if (idx >= 4 && idx <= 8) c = '#b09060'; // surface
        else c = '#705040';
        ctx.fillStyle = c;
        ctx.fillRect(mmX + x * scaleX, mmY + y * scaleY, Math.max(1, scaleX * step), Math.max(1, scaleY * step));
      }
    }

    // 玩家位置
    const ppx = mmX + (playerX / TILE_SIZE) * scaleX;
    const ppy = mmY + (playerY / TILE_SIZE) * scaleY;
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(Math.floor(ppx - 1), Math.floor(ppy - 1), 3, 3);

    // 视野框
    ctx.strokeStyle = 'rgba(232, 197, 71, 0.5)';
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mmX + cam.x * scaleX,
      mmY + cam.y * scaleY,
      cam.width * scaleX,
      cam.height * scaleY
    );
    ctx.setLineDash([]);
  }

  /** 玩家 HP 条 + 躯壳 HUD + 饰品槽（左上）*/
  drawPlayerHUD(hp: number, maxHp: number, shellName: string, shellCooldown: number, invulnerable: boolean, acc: AccessoryManager) {
    const ctx = this.ctx;
    const barW = 200, barH = 18;
    const bx = 12, by = 12;
    // 背景
    ctx.fillStyle = 'rgba(10, 6, 16, 0.85)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    ctx.strokeStyle = '#5a3828'; ctx.lineWidth = 1;
    ctx.strokeRect(bx - 1.5, by - 1.5, barW + 3, barH + 3);
    // HP 条
    const frac = Math.max(0, hp / maxHp);
    if (invulnerable) { ctx.globalAlpha = 0.6; }
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(bx, by, barW, barH);
    const hpColor = frac > 0.5 ? '#40c060' : frac > 0.25 ? '#e8c547' : '#e84040';
    ctx.fillStyle = hpColor;
    ctx.fillRect(bx, by, barW * frac, barH);
    // 刻度
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 1; i < 5; i++) {
      ctx.fillRect(bx + barW * i / 5, by, 1, barH);
    }
    // 数值
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(hp)} / ${maxHp}`, bx + barW / 2, by + 13);
    ctx.globalAlpha = 1;

    // 躯壳名 + 冷却
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c8b898';
    ctx.font = '10px monospace';
    ctx.fillText(`◆ ${shellName}`, bx, by + barH + 14);
    if (shellCooldown > 0) {
      const cdW = (shellCooldown / 1.5) * 60;
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(bx + 80, by + barH + 4, 60, 8);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(bx + 80, by + barH + 4, cdW, 8);
      ctx.fillStyle = '#c8b898';
      ctx.fillText(`切换冷却 ${shellCooldown.toFixed(1)}s`, bx + 144, by + barH + 12);
    }

    // M11: 饰品槽绘制（左下，HP 条下方 20px 起）
    const slotY = by + barH + 22;
    const slotSize = 28;
    const slotGap = 4;
    const slotX = bx;
    const maxSlots = 3;
    const dashBuff = acc.getAggregatedBuff();
    const dashCd = dashBuff.dashCooldown ?? 1.2;

    for (let i = 0; i < maxSlots; i++) {
      const sx = slotX + i * (slotSize + slotGap);
      const isActive = i === acc.slotIndex;
      // 槽背景
      ctx.fillStyle = isActive ? '#2a1830' : '#1a1410';
      ctx.fillRect(sx, slotY, slotSize, slotSize);
      ctx.strokeStyle = isActive ? '#a860e8' : '#3a2828';
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(sx + 0.5, slotY + 0.5, slotSize - 1, slotSize - 1);

      if (i < acc.slots.length) {
        const aId = acc.slots[i].accessoryId;
        const aDef = ACCESSORY_DEFS[aId];
        if (aDef) {
          // 图标色块
          ctx.fillStyle = PALETTE_MAP.get(aDef.paletteId) ?? '#888';
          ctx.fillRect(sx + 4, slotY + 4, slotSize - 8, slotSize - 8);
          // 深色装饰
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(sx + 4, slotY + slotSize - 10, slotSize - 8, 6);
          // 字符图标
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(aDef.iconChar, sx + slotSize / 2, slotY + slotSize / 2 - 2);
          ctx.textBaseline = 'alphabetic';

          // 冲刺冷却遮罩（如果是 dash_boots 冷却中）
          if (aId === 'dash_boots' && acc.dashCooldownTimer > 0) {
            const ratio = acc.dashCooldownTimer / dashCd;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(sx + 4, slotY + 4, slotSize - 8, (slotSize - 8) * ratio);
          }
          // 冲刺中闪烁
          if (aId === 'dash_boots' && acc.isDashing) {
            ctx.fillStyle = 'rgba(232, 197, 71, 0.5)';
            ctx.fillRect(sx, slotY, slotSize, slotSize);
          }
        }
      } else {
        // 空格子虚线
        ctx.strokeStyle = 'rgba(90, 56, 40, 0.6)';
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, slotY + 0.5, slotSize - 1, slotSize - 1);
        ctx.setLineDash([]);
      }

      // 槽序号
      ctx.fillStyle = '#5a4838';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Q${i + 1}`, sx + 2, slotY + slotSize + 10);
    }

    // 右下文字提示
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8a6858';
    ctx.font = '10px monospace';
    ctx.fillText('[Q] 切槽  [Ctrl] 冲刺  [G] 装备/卸下', slotX + maxSlots * (slotSize + slotGap) + 6, slotY + slotSize - 4);
  }

  /** Boss HP 条（屏幕下方居中）*/
  drawBossHUD(bosses: { def: { name: string; hp: number; isNightBoss?: boolean }; hp: number; phase: string; isDead: boolean; x?: number; y?: number }[], playerX?: number, playerY?: number) {
    if (bosses.length === 0) return;
    // 选最近的 Boss（如果有坐标）
    let boss = bosses[0];
    if (playerX !== undefined && playerY !== undefined) {
      let bestD2 = Infinity;
      for (const b of bosses) {
        if (b.isDead) continue;
        if (b.x === undefined || b.y === undefined) continue;
        const d2 = (b.x - playerX) ** 2 + (b.y - playerY) ** 2;
        if (d2 < bestD2) { bestD2 = d2; boss = b; }
      }
    }
    if (boss.isDead) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const barW = Math.min(500, w - 100);
    const barH = 22;
    const bx = (w - barW) / 2;
    const by = this.canvas.height - 90;
    // 夜间 Boss 样式调整
    const isNightBoss = !!boss.def.isNightBoss;
    // 背景框
    ctx.fillStyle = isNightBoss ? 'rgba(20, 10, 25, 0.92)' : 'rgba(10, 6, 16, 0.9)';
    ctx.fillRect(bx - 4, by - 18, barW + 8, barH + 32);
    ctx.strokeStyle = isNightBoss ? '#6030a0' : '#801080'; ctx.lineWidth = 2;
    ctx.strokeRect(bx - 3, by - 17, barW + 6, barH + 30);
    // Boss 名
    ctx.fillStyle = isNightBoss ? '#a080e8' : '#ff40c0';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    const tag = isNightBoss ? '🌙 夜间精英 Boss ' : '☠ ';
    ctx.fillText(`${tag}${boss.def.name}`, bx + barW / 2, by - 4);
    // HP 条
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(bx, by, barW, barH);
    const frac = Math.max(0, boss.hp / boss.def.hp);
    let hpGrad = isNightBoss ? '#4a58a0' : '#a840e8';
    if (boss.phase === 'phase2') hpGrad = isNightBoss ? '#6078c0' : '#c060ff';
    if (boss.phase === 'phase3') hpGrad = isNightBoss ? '#8090e8' : '#ff40c0';
    const grd = ctx.createLinearGradient(bx, by, bx + barW * frac, by);
    grd.addColorStop(0, isNightBoss ? '#1a2050' : '#4a0a60');
    grd.addColorStop(0.5, hpGrad);
    grd.addColorStop(1, isNightBoss ? '#a8c0ff' : '#ff80ff');
    ctx.fillStyle = grd;
    ctx.fillRect(bx, by, barW * frac, barH);
    // 数值
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${Math.ceil(boss.hp)} / ${boss.def.hp}`, bx + barW / 2, by + 15);
    // 阶段指示
    const phaseNames: Record<string, string> = isNightBoss
      ? { phase1: '追击+弹幕', phase2: '狂暴+召唤' }
      : { phase1: '追击', phase2: '召唤+冲击波', phase3: '狂暴' };
    ctx.fillStyle = '#ff8040';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`阶段：${phaseNames[boss.phase] ?? boss.phase}`, bx + barW / 2, by + barH + 14);
    ctx.textAlign = 'start';
  }

  /** M15: 事件 HUD（顶部居中倒计时条）*/
  drawEventHUD(e: WorldEvent) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const barW = 300, barH = 14;
    const bx = (w - barW) / 2;
    const by = 46;
    // 不同事件的颜色
    const COLOR: Record<string, { bg: string; fg: string; border: string }> = {
      blood_moon: { bg: '#2a0505', fg: '#e04030', border: '#c02020' },
      sandstorm: { bg: '#2a1a00', fg: '#c8a840', border: '#b09040' },
      glow_tide: { bg: '#051a2a', fg: '#40c0e0', border: '#30a0c0' },
      void_rift: { bg: '#150520', fg: '#9040e8', border: '#6020a0' },
    };
    const c = COLOR[e.type] ?? COLOR.blood_moon;
    // 背景
    ctx.fillStyle = c.bg;
    ctx.fillRect(bx - 3, by - 3, barW + 6, barH + 18);
    ctx.strokeStyle = c.border; ctx.lineWidth = 2;
    ctx.strokeRect(bx - 2, by - 2, barW + 4, barH + 16);
    // 事件名
    ctx.fillStyle = c.fg;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${e.emoji} ${e.name}  ${Math.ceil(e.remaining)}s`, bx + barW / 2, by + 10);
    // 倒计时条
    const frac = e.remaining / e.duration;
    ctx.fillStyle = '#0a0610';
    ctx.fillRect(bx, by + 16, barW, 4);
    ctx.fillStyle = c.fg;
    ctx.fillRect(bx, by + 16, barW * frac, 4);
    ctx.textAlign = 'start';
  }

  /** M15: 世界事件滤镜层（在震屏偏移内，影响世界层但不影响 HUD）*/
  drawEventOverlay(e: WorldEvent | null) {
    if (!e) return;
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    // 不同事件颜色滤镜
    if (e.type === 'blood_moon') {
      ctx.fillStyle = 'rgba(200, 30, 10, 0.15)';
      ctx.fillRect(0, 0, width, height);
    } else if (e.type === 'sandstorm') {
      ctx.fillStyle = 'rgba(200, 160, 60, 0.20)';
      ctx.fillRect(0, 0, width, height);
      // 沙粒闪烁（少量随机点）
      const t = performance.now() / 1000;
      ctx.fillStyle = 'rgba(220, 180, 80, 0.35)';
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 137 + t * 200) % width);
        const sy = ((i * 89 + t * 120) % height);
        ctx.fillRect(sx, sy, 2, 2);
      }
    } else if (e.type === 'glow_tide') {
      ctx.fillStyle = 'rgba(60, 160, 200, 0.18)';
      ctx.fillRect(0, 0, width, height);
      // 飘光点
      const t = performance.now() / 1000;
      ctx.fillStyle = 'rgba(120, 220, 240, 0.45)';
      for (let i = 0; i < 25; i++) {
        const sx = ((i * 211 + t * 100) % width);
        const sy = ((i * 149 + Math.sin(t + i) * 50 + height * 0.3) % height);
        ctx.fillRect(sx, sy, 2, 2);
      }
    } else if (e.type === 'void_rift') {
      ctx.fillStyle = 'rgba(120, 40, 180, 0.18)';
      ctx.fillRect(0, 0, width, height);
      // 紫色闪电粒子
      const t = performance.now() / 1000;
      ctx.fillStyle = 'rgba(180, 100, 240, 0.5)';
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 173 + t * 250) % width);
        const sy = ((i * 97 + t * 180) % height);
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }

  /** M17: 任务 HUD — 右侧列表面板，显示未完成任务 + 已完成未领取的闪烁 */
  drawQuestHUD(quests: QuestState[]) {
    const ctx = this.ctx;
    const active = quests.filter(q => !q.claimed);
    if (active.length === 0) return;
    const w = 200;
    const rowH = 26;
    const pad = 6;
    const x = this.canvas.width - w - 8;
    const y = 8;
    // 背景
    ctx.fillStyle = 'rgba(10, 6, 16, 0.85)';
    ctx.fillRect(x - 3, y - 3, w + 6, active.length * rowH + pad * 2 + 14);
    ctx.strokeStyle = '#806040'; ctx.lineWidth = 1;
    ctx.strokeRect(x - 3, y - 3, w + 6, active.length * rowH + pad * 2 + 14);
    // 标题
    ctx.fillStyle = '#ffd060';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('📜 任务', x, y + 8);
    // 任务列表
    let cy = y + 22;
    for (const q of active) {
      const frac = q.progress / q.def.targetCount;
      // 已完成未领取 → 闪烁金色边框
      if (q.completed) {
        ctx.fillStyle = 'rgba(60, 40, 10, 0.8)';
        ctx.fillRect(x, cy - 10, w, rowH);
        ctx.strokeStyle = '#ffd060';
        ctx.strokeRect(x, cy - 10, w, rowH);
      } else {
        ctx.fillStyle = 'rgba(30, 20, 10, 0.6)';
        ctx.fillRect(x, cy - 10, w, rowH);
      }
      // 任务名
      ctx.fillStyle = q.completed ? '#ffd060' : '#e0e0e0';
      ctx.font = '11px monospace';
      ctx.fillText(q.def.name, x + 4, cy + 2);
      // 进度条
      ctx.fillStyle = '#1a0a0a';
      ctx.fillRect(x + 4, cy + 5, w - 8, 4);
      ctx.fillStyle = q.completed ? '#ffd060' : '#40c060';
      ctx.fillRect(x + 4, cy + 5, (w - 8) * frac, 4);
      // 进度文字
      ctx.fillStyle = '#a0a0a0';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${q.progress}/${q.def.targetCount}`, x + w - 4, cy + 8);
      ctx.textAlign = 'left';
      cy += rowH;
    }
  }

  /** M17: 任务完成弹窗 — 屏幕中央显示 3 秒 */
  drawQuestPopup(text: string) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const y = 110;
    ctx.fillStyle = 'rgba(60, 40, 10, 0.9)';
    const tw = ctx.measureText(text).width + 30;
    ctx.fillRect((w - tw) / 2, y, tw, 28);
    ctx.strokeStyle = '#ffd060'; ctx.lineWidth = 2;
    ctx.strokeRect((w - tw) / 2, y, tw, 28);
    ctx.fillStyle = '#ffd060';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, y + 19);
    ctx.textAlign = 'left';
  }

  /** M19: 成就 HUD — 底部紧凑进度条，显示已解锁/总数 */
  drawAchievementHUD(achievements: AchievementState[]) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const unlocked = achievements.filter(a => a.unlocked).length;
    const total = achievements.length;
    const barW = 140, barH = 10;
    const bx = w - barW - 8;
    const by = this.canvas.height - 60;
    // 背景
    ctx.fillStyle = 'rgba(10, 6, 16, 0.8)';
    ctx.fillRect(bx - 5, by - 14, barW + 10, barH + 20);
    ctx.strokeStyle = '#a08040'; ctx.lineWidth = 1;
    ctx.strokeRect(bx - 5, by - 14, barW + 10, barH + 20);
    // 标题
    ctx.fillStyle = '#ffd060';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`🏆 成就 ${unlocked}/${total}`, bx, by - 4);
    // 进度条
    const frac = unlocked / total;
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#ffd060';
    ctx.fillRect(bx, by, barW * frac, barH);
    ctx.textAlign = 'left';
  }

  /** M19: 成就解锁弹窗 — 屏幕中央上方，持续 4 秒 */
  drawAchievementPopup(text: string) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const y = 150;
    const tw = Math.max(260, ctx.measureText(text).width + 40);
    ctx.fillStyle = 'rgba(40, 30, 10, 0.95)';
    ctx.fillRect((w - tw) / 2, y, tw, 32);
    ctx.strokeStyle = '#ffd060'; ctx.lineWidth = 2;
    ctx.strokeRect((w - tw) / 2, y, tw, 32);
    ctx.fillStyle = '#ffd060';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, y + 21);
    ctx.textAlign = 'left';
  }

  /** M20: 商店面板 — 居中显示商品列表 + 金币 + 操作提示 */
  drawShop(items: ShopItem[], gold: number, msg: string) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const panelW = 340;
    const rowH = 22;
    const pad = 8;
    const headerH = 40;
    const x = (w - panelW) / 2;
    const y = 60;
    const h = headerH + items.length * rowH + pad * 2 + 40;
    // 背景
    ctx.fillStyle = 'rgba(10, 6, 16, 0.95)';
    ctx.fillRect(x, y, panelW, h);
    ctx.strokeStyle = '#ffd060'; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, panelW, h);
    // 标题 + 金币
    ctx.fillStyle = '#ffd060';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('🛒 流浪商人', x + pad, y + 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd040';
    ctx.fillText(`🪙 ${gold}`, x + panelW - pad, y + 20);
    ctx.textAlign = 'left';
    // 商品列表
    let cy = y + headerH;
    items.forEach((item, i) => {
      const name = BLOCKS[item.blockId]?.name ?? item.blockId;
      const soldOut = item.stock === 0;
      // 行背景
      ctx.fillStyle = i % 2 === 0 ? 'rgba(40, 20, 10, 0.6)' : 'rgba(20, 10, 5, 0.6)';
      ctx.fillRect(x, cy - 14, panelW, rowH);
      // 序号
      ctx.fillStyle = '#a0a0a0';
      ctx.font = '11px monospace';
      ctx.fillText(`${i + 1}.`, x + pad, cy);
      // 名称
      ctx.fillStyle = soldOut ? '#666' : '#e0e0e0';
      ctx.fillText(name, x + pad + 20, cy);
      // 价格
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd040';
      ctx.fillText(`🪙 ${item.buyPrice}`, x + panelW - pad - 40, cy);
      // 库存
      ctx.fillStyle = soldOut ? '#ff6040' : '#80c060';
      ctx.fillText(item.stock < 0 ? '∞' : `x${item.stock}`, x + panelW - pad, cy);
      ctx.textAlign = 'left';
      cy += rowH;
    });
    // 底部提示
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '10px monospace';
    ctx.fillText('数字键=购买  T=出售选中  E/B=关闭', x + pad, y + h - pad - 10);
    // 消息
    if (msg) {
      ctx.fillStyle = '#60c0ff';
      ctx.textAlign = 'center';
      ctx.fillText(msg, w / 2, y + h - pad + 2);
      ctx.textAlign = 'left';
    }
  }

  /** M21: 试炼 HUD — 顶部居中显示波次 + 剩余敌人 + 倒计时 */
  drawTrialHUD(trial: TrialManager, msg: string) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    if (trial.active && trial.currentTrial) {
      const total = trial.currentTrial.waves.length;
      const cur = trial.waveIndex + 1;
      const x = w / 2 - 120;
      const y = 10;
      // 背景
      ctx.fillStyle = 'rgba(60, 10, 10, 0.9)';
      ctx.fillRect(x, y, 240, 36);
      ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 240, 36);
      // 试炼名 + 波次
      ctx.fillStyle = '#ff8040';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${trial.currentTrial.emoji} ${trial.currentTrial.name}`, x + 8, y + 16);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd060';
      ctx.fillText(`第 ${cur}/${total} 波`, x + 232, y + 16);
      ctx.textAlign = 'left';
      // 剩余敌人 + 倒计时
      const remaining = trial.enemiesRemaining + trial.bossesRemaining;
      ctx.fillStyle = remaining > 0 ? '#ff6060' : '#60c060';
      ctx.font = '11px monospace';
      if (trial.waveStarted) {
        ctx.fillText(`剩余敌人: ${remaining}`, x + 8, y + 30);
      } else {
        ctx.fillStyle = '#ffd060';
        ctx.fillText(`下一波 ${trial.waveTimer.toFixed(1)}s...`, x + 8, y + 30);
      }
    }
    // 消息弹窗（通关/失败/波次提示）
    if (msg) {
      const tw = Math.max(200, ctx.measureText(msg).width + 40);
      const y = 60;
      ctx.fillStyle = 'rgba(30, 10, 10, 0.95)';
      ctx.fillRect((w - tw) / 2, y, tw, 30);
      ctx.strokeStyle = '#ff8040'; ctx.lineWidth = 2;
      ctx.strokeRect((w - tw) / 2, y, tw, 30);
      ctx.fillStyle = '#ffd060';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(msg, w / 2, y + 20);
      ctx.textAlign = 'left';
    }
  }

  /** M22: 药水 buff 图标 — 左上 HP 条下方，显示激活的 buff + 剩余时间 */
  drawPotionBuffs(buffs: ActiveBuff[]) {
    if (buffs.length === 0) return;
    const ctx = this.ctx;
    const iconSize = 16;
    const spacing = 4;
    const startX = 8;
    const startY = 52; // HP 条下方
    // buff 类型 → 颜色 + emoji
    const info: Record<string, { color: string; emoji: string }> = {
      defense: { color: '#8080ff', emoji: '🛡' },
      speed: { color: '#80ffff', emoji: '💨' },
      damage: { color: '#ff8040', emoji: '💪' },
      night_vision: { color: '#ffff80', emoji: '👁' },
    };
    buffs.forEach((b, i) => {
      const x = startX + i * (iconSize + spacing);
      const y = startY;
      const inf = info[b.type] ?? { color: '#fff', emoji: '?' };
      // 背景
      ctx.fillStyle = inf.color + '40';
      ctx.fillRect(x, y, iconSize, iconSize);
      ctx.strokeStyle = inf.color; ctx.lineWidth = 1;
      ctx.strokeRect(x, y, iconSize, iconSize);
      // emoji
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(inf.emoji, x + iconSize / 2, y + 12);
      ctx.textAlign = 'left';
      // 剩余时间
      ctx.fillStyle = '#fff';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(b.remaining)}s`, x + iconSize / 2, y + iconSize + 9);
      ctx.textAlign = 'left';
    });
  }
}
