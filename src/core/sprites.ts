/**
 * 烬海纪元 · 角色像素模型
 * 统一风格的参数化像素模型：头 / 躯干 / 四肢 / 眼睛 / 武器 / 王冠 / 触须
 * 替代原先的纯色矩形，为玩家、NPC、敌人、Boss 提供可辨识的角色形象
 */

export type CharKind = 'humanoid' | 'beast' | 'flyer' | 'blob' | 'titan';

export interface CharModel {
  kind: CharKind;
  main: string;
  dark: string;
  light: string;
  eye: string;
  accent?: string;
  weapon?: string;
  crown?: boolean;
  horns?: boolean;
  wings?: boolean;
  multiEye?: boolean;
}

/** 颜色明暗调整，支持 #rgb / #rrggbb；解析失败时原样返回 */
export function shade(color: string, amt: number): string {
  const hex = color.trim();
  let r = 0, g = 0, b = 0;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    return color;
  }
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function makeModel(main: string, eye: string, opts: Partial<CharModel> = {}): CharModel {
  return {
    kind: 'humanoid',
    main,
    dark: shade(main, -0.32),
    light: shade(main, 0.28),
    eye,
    ...opts,
  };
}

function rect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function roundFill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number, color: string,
) {
  const rad = Math.max(1, Math.min(r, w / 2, h / 2));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
  ctx.fill();
}

/** NPC 模型：商人 / 医师 / 工程师 */
export const NPC_MODELS: Record<string, CharModel> = {
  merchant_npc: {
    kind: 'humanoid',
    main: '#b8863a',
    dark: '#6e4c1c',
    light: '#e8c078',
    eye: '#ffe9a8',
    accent: '#8a2f2f',
    weapon: '#c9a050',
    crown: false,
  },
  medic_settler: {
    kind: 'humanoid',
    main: '#d8dde2',
    dark: '#7a838c',
    light: '#f4f8fb',
    eye: '#4ad0a8',
    accent: '#3f9d7a',
  },
  engineer_settler: {
    kind: 'humanoid',
    main: '#c07030',
    dark: '#6e3a12',
    light: '#f0a860',
    eye: '#ffd24a',
    accent: '#4a4a52',
    weapon: '#9a9aa2',
  },
};

/**
 * 绘制角色像素模型
 * @param x 左上角 X，y 左上角 Y，w 宽，h 高
 * @param facing 1 朝右 / -1 朝左
 * @param time 秒（用于呼吸、摆动、扇翅）
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  m: CharModel,
  x: number,
  y: number,
  w: number,
  h: number,
  facing: number,
  time: number,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const u = Math.max(1, Math.round(w / 10));
  const breathe = Math.sin(time * 3) > 0.6 ? 1 : 0;
  const cx = x + w / 2;

  switch (m.kind) {
    case 'humanoid': drawHumanoid(ctx, m, y + breathe, w, h, facing, time, u, cx); break;
    case 'beast': drawBeast(ctx, m, x, y, w, h, facing, time, u); break;
    case 'flyer': drawFlyer(ctx, m, x, y, w, h, facing, time, u); break;
    case 'blob': drawBlob(ctx, m, x, y, w, h, facing, time, u); break;
    case 'titan': drawTitan(ctx, m, x, y, w, h, facing, time, u, cx); break;
  }
  ctx.restore();
}

function drawHumanoid(
  ctx: CanvasRenderingContext2D, m: CharModel,
  y: number, w: number, h: number,
  facing: number, time: number, u: number, cx: number,
) {
  // 比例：头 24% / 躯干 36% / 腿 40% —— 人形轮廓清晰，不再是竖条
  const headW = Math.max(6, Math.round(w * 0.62));
  const headH = Math.max(6, Math.round(h * 0.24));
  const bodyY = y + headH;
  const bodyH = Math.max(5, Math.round(h * 0.36));
  const bodyW = Math.max(6, Math.round(w * 0.76));
  const legW = Math.max(3, Math.round(w * 0.22));
  const gap = Math.max(1, Math.round(w * 0.06));
  const legY = bodyY + bodyH;
  const legH = Math.max(4, y + h - legY);
  const swing = Math.sin(time * 9);
  const lift = swing > 0 ? u : 0;
  const bootH = Math.max(2, Math.round(u * 1.5));

  // ---- 腿（双脚错步 + 靴子）----
  rect(ctx, cx - gap / 2 - legW, legY, legW, Math.max(1, legH - lift), m.dark);
  rect(ctx, cx + gap / 2, legY, legW, Math.max(1, legH - (u - lift)), m.dark);
  ctx.fillStyle = shade(m.dark, -0.2);
  ctx.fillRect(Math.round(cx - gap / 2 - legW), Math.round(legY + legH - bootH - lift), legW, bootH);
  ctx.fillRect(Math.round(cx + gap / 2), Math.round(legY + legH - bootH - (u - lift)), legW, bootH);

  // ---- 躯干（左缘受光 / 右缘阴影 / 腰带）----
  rect(ctx, cx - bodyW / 2, bodyY, bodyW, bodyH, m.main);
  rect(ctx, cx - bodyW / 2, bodyY, u, bodyH, m.light);
  rect(ctx, cx + bodyW / 2 - u, bodyY, u, bodyH, m.dark);
  rect(ctx, cx - bodyW / 2, bodyY + bodyH - u, bodyW, u, m.dark);
  // 肩线
  rect(ctx, cx - bodyW / 2 - u, bodyY, bodyW + u * 2, u, m.light);
  // 胸甲 / 围裙
  if (m.accent) {
    rect(ctx, cx - bodyW * 0.24, bodyY + u * 1.5, bodyW * 0.48, bodyH * 0.52, m.accent);
  }

  // ---- 双臂（前后摆动；前臂用主色提高辨识度）----
  const armW = Math.max(2, Math.round(w * 0.15));
  const armH = Math.max(4, Math.round(bodyH * 0.86));
  const armSwing = Math.round(swing * u);
  rect(ctx, cx - bodyW / 2 - armW, bodyY + u + armSwing, armW, armH, m.dark);
  rect(ctx, cx + bodyW / 2, bodyY + u - armSwing, armW, armH, m.main);

  // ---- 头（浅色皮肤 + 头发/头盔 + 双眼）----
  const hx = Math.round(cx - headW / 2 + facing * u * 0.5);
  // 脖子
  rect(ctx, cx - u, y + headH - u, u * 2, u, m.dark);
  rect(ctx, hx, y, headW, headH, m.light);
  rect(ctx, hx + headW - u, y, u, headH, m.main);
  rect(ctx, hx, y + headH - u, headW, u, m.main);
  // 头发 / 头盔
  const hair = m.accent ?? m.dark;
  rect(ctx, hx, y, headW, Math.max(2, Math.round(headH * 0.34)), hair);
  rect(ctx, hx + (facing >= 0 ? 0 : headW - u), y + u, u, Math.round(headH * 0.45), hair);

  // 双眼（朝向侧的偏移）
  const eyeY = y + Math.round(headH * 0.56);
  const eyeSize = Math.max(1, u);
  const ex = facing >= 0 ? hx + Math.round(headW * 0.40) : hx + Math.round(headW * 0.24);
  rect(ctx, ex, eyeY, eyeSize, eyeSize, m.eye);
  rect(ctx, ex + (facing >= 0 ? eyeSize * 2 : -eyeSize * 2), eyeY, eyeSize, eyeSize, m.eye);

  // ---- 武器（镐 / 工具，握在前手）----
  if (m.weapon) {
    const handY = bodyY + u + armH * 0.6;
    const len = Math.max(4, Math.round(w * 0.42));
    const hxx = facing >= 0 ? cx + bodyW / 2 + armW - u : cx - bodyW / 2 - armW - len + u;
    rect(ctx, hxx, handY, len, Math.max(2, u), m.weapon);
    rect(ctx, hxx + (facing >= 0 ? len - u * 2 : 0), handY - u * 2.5, Math.max(2, u * 2), u * 3, m.weapon);
  }

  // 王冠（精英）
  if (m.crown) {
    const cy = y - u * 2;
    rect(ctx, cx - headW * 0.42, cy, headW * 0.84, u, '#ffd75e');
    rect(ctx, cx - headW * 0.42, cy - u, u, u, '#ffd75e');
    rect(ctx, cx - u / 2, cy - u * 1.4, u, u * 1.4, '#ffe9a0');
    rect(ctx, cx + headW * 0.42 - u, cy - u, u, u, '#ffd75e');
  }

  // 角
  if (m.horns) {
    rect(ctx, cx - headW * 0.5, y - u * 2, Math.max(1, u), u * 2, m.dark);
    rect(ctx, cx + headW * 0.5 - u, y - u * 2, Math.max(1, u), u * 2, m.dark);
  }
}

function drawBeast(
  ctx: CanvasRenderingContext2D, m: CharModel,
  x: number, y: number, w: number, h: number,
  facing: number, time: number, u: number,
) {
  const phase = Math.sin(time * 10);

  // 四条腿
  for (let i = 0; i < 4; i++) {
    const lx = x + w * (0.14 + i * 0.22);
    const lift = ((i % 2 === 0 ? phase : -phase) > 0 ? u : 0);
    rect(ctx, lx, y + h - u * 2 - lift, Math.max(1, u), u * 2 + lift, m.dark);
  }

  // 身体（拱背）
  rect(ctx, x + w * 0.04, y + h * 0.30, w * 0.92, h * 0.56, m.main);
  rect(ctx, x + w * 0.10, y + h * 0.22, w * 0.62, h * 0.14, m.main);
  rect(ctx, x + w * 0.04, y + h * 0.30, w * 0.92, u, m.light);
  rect(ctx, x + w * 0.04, y + h * 0.86 - u, w * 0.92, u, m.dark);

  // 头部
  const hx = facing >= 0 ? x + w * 0.64 : x;
  rect(ctx, hx, y + h * 0.16, w * 0.36, h * 0.36, m.main);
  rect(ctx, hx, y + h * 0.16, w * 0.36, u, m.light);
  // 眼
  const ex = facing >= 0 ? hx + w * 0.18 : hx + w * 0.06;
  rect(ctx, ex, y + h * 0.26, Math.max(1, u * 1.4), Math.max(1, u * 1.4), m.eye);
  // 背刺 / 尾
  if (m.horns) {
    for (let i = 0; i < 3; i++) {
      rect(ctx, x + w * (0.22 + i * 0.22), y + h * 0.16, Math.max(1, u), u * 2, m.dark);
    }
  }
  rect(ctx, facing >= 0 ? x - u : x + w, y + h * 0.42, u * 2, u, m.dark);
}

function drawFlyer(
  ctx: CanvasRenderingContext2D, m: CharModel,
  x: number, y: number, w: number, h: number,
  facing: number, time: number, u: number,
) {
  const flap = Math.sin(time * 14) * (h * 0.20);

  // 翅膀
  rect(ctx, x - w * 0.24, y + h * 0.34 + flap, w * 0.30, Math.max(2, u * 1.6), m.dark);
  rect(ctx, x + w * 0.94, y + h * 0.34 - flap, w * 0.30, Math.max(2, u * 1.6), m.dark);

  // 身体核心（菱形）
  rect(ctx, x + w * 0.22, y + h * 0.20, w * 0.56, h * 0.60, m.main);
  rect(ctx, x + w * 0.34, y + h * 0.08, w * 0.32, h * 0.84, m.main);
  rect(ctx, x + w * 0.22, y + h * 0.20, w * 0.56, u, m.light);
  rect(ctx, x + w * 0.22, y + h * 0.72, w * 0.56, u, m.dark);

  // 眼睛
  rect(ctx, x + w * 0.42 + facing * u, y + h * 0.40, Math.max(1, u * 1.5), Math.max(1, u * 1.5), m.eye);

  // 能量尾迹
  rect(ctx, x + w * 0.46, y + h * 0.86, u * 2, u, 'rgba(255,255,255,0.22)');
}

function drawBlob(
  ctx: CanvasRenderingContext2D, m: CharModel,
  x: number, y: number, w: number, h: number,
  facing: number, time: number, u: number,
) {
  const squish = Math.sin(time * 6) * u;
  const bh = Math.max(h * 0.55, h * 0.72 + squish);
  const by = y + h - bh;
  const r = Math.min(w, bh) * 0.34;

  roundFill(ctx, x, by, w, bh, r, m.main);
  roundFill(ctx, x + w * 0.12, by + bh * 0.12, w * 0.50, bh * 0.34, r * 0.7, m.light);
  roundFill(ctx, x + w * 0.18, by + bh * 0.70, w * 0.64, bh * 0.26, r * 0.5, m.dark);

  rect(ctx, x + w * 0.30 + facing * u, y + h * 0.38, Math.max(1, u * 1.6), Math.max(1, u * 1.6), m.eye);
  rect(ctx, x + w * 0.58 + facing * u, y + h * 0.38, Math.max(1, u * 1.6), Math.max(1, u * 1.6), m.eye);
}

function drawTitan(
  ctx: CanvasRenderingContext2D, m: CharModel,
  x: number, y: number, w: number, h: number,
  facing: number, time: number, u: number, cx: number,
) {
  // 触须（底部）
  const wob = Math.sin(time * 4) * u * 1.5;
  for (let i = 0; i < 4; i++) {
    const tx = x + w * (0.14 + i * 0.20);
    const th = h * 0.16 + (i % 2 === 0 ? wob : -wob);
    rect(ctx, tx, y + h * 0.78, Math.max(1, u * 2), Math.max(2, th), m.dark);
  }

  // 肩甲
  const armor = m.accent ?? m.dark;
  rect(ctx, x - w * 0.02, y + h * 0.30, w * 0.26, h * 0.20, armor);
  rect(ctx, x + w * 0.76, y + h * 0.30, w * 0.26, h * 0.20, armor);
  // 躯干
  rect(ctx, x + w * 0.16, y + h * 0.24, w * 0.68, h * 0.42, m.main);
  rect(ctx, x + w * 0.16, y + h * 0.24, w * 0.68, u, m.light);
  rect(ctx, x + w * 0.22, y + h * 0.62, w * 0.56, h * 0.18, m.dark);
  // 胸口能量核
  rect(ctx, cx - w * 0.08, y + h * 0.38, w * 0.16, h * 0.10, m.eye);

  // 头
  rect(ctx, cx - w * 0.20, y + h * 0.02, w * 0.40, h * 0.22, m.dark);
  rect(ctx, cx - w * 0.20, y + h * 0.02, w * 0.40, u, m.light);

  // 多眼
  const eyes = m.multiEye ? 3 : 2;
  for (let i = 0; i < eyes; i++) {
    const ex = cx - w * 0.15 + i * (w * 0.15) + facing * u;
    rect(ctx, ex, y + h * 0.10, Math.max(1, u * 2), Math.max(1, u * 2), m.eye);
  }

  // 角
  if (m.horns) {
    rect(ctx, cx - w * 0.24, y - h * 0.05, Math.max(1, u * 2), h * 0.10, '#e8dcc0');
    rect(ctx, cx + w * 0.18, y - h * 0.05, Math.max(1, u * 2), h * 0.10, '#e8dcc0');
  }

  // 王冠
  if (m.crown) {
    const cy = y - h * 0.10;
    rect(ctx, cx - w * 0.26, cy, w * 0.52, u * 2, '#ffd75e');
    rect(ctx, cx - w * 0.26, cy - u * 2, u * 2, u * 2, '#ffd75e');
    rect(ctx, cx - u, cy - u * 3, u * 2, u * 3, '#ffe9a0');
    rect(ctx, cx + w * 0.26 - u * 2, cy - u * 2, u * 2, u * 2, '#ffd75e');
  }
}
