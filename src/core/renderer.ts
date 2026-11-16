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

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private starField: { x: number; y: number; b: number }[] = [];
  // 日夜循环 0..1 (0 = 黎明, 0.5 = 正午, 0.9 = 深夜)
  timeOfDay = 0.3;

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
    const ctx = this.ctx;
    // 根据 timeOfDay 调整背景色
    const t = this.timeOfDay;
    let topC: string, midC: string, botC: string;
    if (t < 0.25) { // 黎明
      topC = '#0a0608'; midC = '#2a0e14'; botC = '#4a1a1a';
    } else if (t < 0.55) { // 白天
      topC = '#1a1820'; midC = '#2a1418'; botC = '#3a1a14';
    } else if (t < 0.75) { // 黄昏
      topC = '#0a0a18'; midC = '#1a0818'; botC = '#3a1008';
    } else { // 深夜
      topC = '#030308'; midC = '#08060e'; botC = '#10080a';
    }
    const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, topC);
    grad.addColorStop(0.5, midC);
    grad.addColorStop(1, botC);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBackground(cam: Camera) {
    const ctx = this.ctx;
    // 夜晚才显示星星
    const t = this.timeOfDay;
    if (t > 0.55 || t < 0.1) {
      const alpha = t > 0.55 ? (t - 0.55) * 2.2 : (0.1 - t) * 4;
      for (const s of this.starField) {
        const sx = s.x - cam.x * 0.2;
        const sy = s.y - cam.y * 0.2;
        ctx.fillStyle = `rgba(232, 197, 71, ${s.b * alpha * 0.5})`;
        ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
      }
    }
    // 远处山脉剪影
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

  drawWorld(tiles: Uint8Array, cam: Camera, breaking: BreakState | null) {
    const ctx = this.ctx;
    const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE) - 1);
    const endX = Math.min(MAP_WIDTH, Math.ceil((cam.x + cam.width) / TILE_SIZE) + 1);
    const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE) - 1);
    const endY = Math.min(MAP_HEIGHT, Math.ceil((cam.y + cam.height) / TILE_SIZE) + 1);

    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const idx = ty * MAP_WIDTH + tx;
        const id = biToBlock(tiles[idx]);
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

    // 夜晚全局暗光
    const t = this.timeOfDay;
    if (t > 0.55 || t < 0.1) {
      const darkness = t > 0.55 ? Math.min(0.5, (t - 0.55) * 1.5) : Math.min(0.3, (0.1 - t) * 2);
      ctx.fillStyle = `rgba(0, 0, 30, ${darkness})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private drawTile(ctx: CanvasRenderingContext2D, px: number, py: number, def: typeof BLOCKS[string], tx: number, ty: number) {
    const baseColor = PALETTE_MAP.get(def.paletteId) ?? '#888';
    ctx.fillStyle = baseColor;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    const seed = (tx * 374761393 + ty * 668265263) >>> 0;
    for (let i = 0; i < 8; i++) {
      const s = (seed + i * 12345) >>> 0;
      const v = s & 0xff;
      const vx = (s >> 8) % TILE_SIZE;
      const vy = (s >> 16) % TILE_SIZE;
      if (v < 60 && def.variants.length > 0) {
        const vId = def.variants[v % def.variants.length];
        const vc = PALETTE_MAP.get(vId);
        if (vc) { ctx.fillStyle = vc; ctx.fillRect(px + vx, py + vy, 1, 1); }
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px, py, TILE_SIZE, 1);
    ctx.fillRect(px, py, 1, TILE_SIZE);
    if (def.emitsLight && def.emitsLight > 0) {
      const intensity = def.emitsLight / 15;
      ctx.fillStyle = `rgba(${intensity * 200 + 55}, ${intensity * 150 + 50}, ${intensity * 100 + 55}, ${intensity * 0.25})`;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
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

  drawPlayer(p: Player, cam: Camera, shell?: ShellDef, alpha = 1) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    const px = Math.floor(p.x - cam.x - p.width / 2);
    const py = Math.floor(p.y - cam.y - p.height / 2);

    // 躯壳配色
    const shellColors = shell ? SHELL_COLORS[shell.palette] : { head: '#e8dcc0', body: '#8a9096', eye: '#ffc85a' };

    // 身体
    ctx.fillStyle = shellColors.body;
    ctx.fillRect(px, py + TILE_SIZE, p.width, p.height - TILE_SIZE);
    // 头部
    ctx.fillStyle = shellColors.head;
    ctx.fillRect(px + 2, py + 2, p.width - 4, TILE_SIZE - 4);
    // 眼睛
    ctx.fillStyle = shellColors.eye;
    const eyeX = p.facing === 1 ? px + p.width - 6 : px + 4;
    ctx.fillRect(eyeX, py + 6, 2, 2);
    // 手脚暗边
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px - 1, py + TILE_SIZE + 4, 2, TILE_SIZE * 0.5);
    ctx.fillRect(px + p.width - 1, py + TILE_SIZE + 4, 2, TILE_SIZE * 0.5);

    // 手持工具
    const toolName = (p as Player & { toolName?: string }).toolName ?? 'hand_pickaxe';
    const tool = TOOLS[toolName] ?? TOOLS.hand_pickaxe;
    const handX = p.facing === 1 ? px + p.width : px - 10;
    const handY = py + TILE_SIZE + 2;
    ctx.fillStyle = PALETTE_MAP.get(tool.paletteId) ?? '#888';
    ctx.fillRect(handX, handY, 10, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.facing === 1 ? handX - 2 : handX + 9, handY + 1, 2, 2);

    // HP bar
    const barW = p.width + 4, barH = 3;
    const barX = px - 2, barY = py - 6;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX, barY, barW, barH);
    const hpFrac = p.hp / p.maxHp;
    ctx.fillStyle = hpFrac > 0.5 ? '#7ad4e8' : hpFrac > 0.25 ? '#e89430' : '#ff4a3a';
    ctx.fillRect(barX, barY, barW * hpFrac, barH);

    // 躯壳名（头顶）
    if (shell) {
      ctx.fillStyle = shellColors.head;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
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
      if (e.def.behavior === 'hopper') {
        ctx.fillStyle = main;
        this.roundRect(ctx, epx, epy + 2, w, h - 2, 4); ctx.fill();
        ctx.fillStyle = dark;
        this.roundRect(ctx, epx + 2, epy + h - 5, w - 4, 3, 2); ctx.fill();
        ctx.fillStyle = eye;
        ctx.fillRect(epx + w / 2 - 4 + e.facing, epy + 5, 2, 2);
        ctx.fillRect(epx + w / 2 + 2 + e.facing, epy + 5, 2, 2);
      } else if (e.def.behavior === 'chaser') {
        ctx.fillStyle = main;
        ctx.fillRect(epx + 2, epy + 8, w - 4, h - 8);
        ctx.fillStyle = dark;
        ctx.fillRect(epx + 3, epy + 3, w - 6, 8);
        ctx.fillStyle = eye;
        ctx.fillRect(epx + w / 2 - 3 + e.facing, epy + 5, 2, 2);
        ctx.fillRect(epx + w / 2 + 1 + e.facing, epy + 5, 2, 2);
        ctx.fillStyle = dark;
        ctx.fillRect(epx + 1, epy + 10, 2, h - 12);
        ctx.fillRect(epx + w - 3, epy + 10, 2, h - 12);
      } else if (e.def.behavior === 'flyer') {
        const wingFlap = Math.sin(Date.now() * 0.03) > 0 ? 1 : -1;
        ctx.fillStyle = dark;
        ctx.fillRect(epx - 2, epy + h / 2 - 3 + wingFlap, 4, 3);
        ctx.fillRect(epx + w - 2, epy + h / 2 - 3 + wingFlap, 4, 3);
        ctx.fillStyle = main;
        ctx.fillRect(epx, epy + 3, w, h - 6);
        ctx.fillStyle = eye;
        ctx.fillRect(epx + w / 2 - 1 + e.facing, epy + h / 2 - 1, 2, 2);
        ctx.fillStyle = 'rgba(248, 212, 255, 0.15)';
        ctx.fillRect(epx - 4, epy - 2, w + 8, h + 4);
      }
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

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
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

    // Boss 主体（矩形身体 + 触手）
    const w = boss.def.width, h = boss.def.height;
    // 主体（梯形上宽下窄）
    ctx.fillStyle = bodyColor;
    this.roundRect(ctx, bpx + 4, bpy + 10, w - 8, h - 18, 6); ctx.fill();
    // 头部
    ctx.fillStyle = darkColor;
    this.roundRect(ctx, bpx + 6, bpy + 4, w - 12, 14, 4); ctx.fill();
    // 双眼
    ctx.fillStyle = eyeColor;
    ctx.fillRect(bpx + 14 + boss.facing * 2, bpy + 8, 4, 4);
    ctx.fillRect(bpx + w - 18 + boss.facing * 2, bpy + 8, 4, 4);
    // 身体暗纹
    ctx.fillStyle = darkColor;
    ctx.fillRect(bpx + w / 2 - 8, bpy + 18, 16, 3);
    ctx.fillRect(bpx + w / 2 - 5, bpy + 24, 10, 2);
    // 触手（底部 4 根）
    const tentacleWobble = Math.sin(Date.now() * 0.006) * 3;
    for (let i = 0; i < 4; i++) {
      const tx = bpx + 6 + i * 10;
      const ty = bpy + h - 8;
      ctx.fillStyle = bodyColor;
      ctx.fillRect(tx, ty, 5, 8 + tentacleWobble + Math.sin(Date.now() * 0.008 + i) * 2);
    }
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
      // 身体
      ctx.fillStyle = sc.body;
      ctx.fillRect(cpx, cpy + TILE_SIZE, TILE_SIZE * 0.75, TILE_SIZE * 0.75);
      // 头
      ctx.fillStyle = sc.head;
      ctx.fillRect(cpx + 2, cpy + 2, TILE_SIZE * 0.75 - 4, TILE_SIZE - 4);
      // 眼
      ctx.fillStyle = sc.eye;
      const eyeX = c.facing === 1 ? cpx + TILE_SIZE * 0.75 - 6 : cpx + 4;
      ctx.fillRect(eyeX, cpy + 6, 2, 2);
      // 武器指示
      const wColor = c.def.weapon === 'melee' ? '#e8c547' : '#ff8040';
      ctx.fillStyle = wColor;
      const handX = c.facing === 1 ? cpx + TILE_SIZE * 0.75 : cpx - 6;
      ctx.fillRect(handX, cpy + TILE_SIZE + 2, 6, 2);
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
}
