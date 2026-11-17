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
  /** 肤色（脸 / 手 / 脖子），缺省为暖肤色 */
  skin?: string;
  /** 头饰：宽檐帽 / 头盔 / 护目镜 / 兜帽 */
  headgear?: 'hat' | 'helmet' | 'goggles' | 'hood';
  /** 胸前标记颜色（医师十字 / 工程师齿轮 / 商人金币） */
  emblem?: string;
  /** 人形绘制放大倍率（仅影响外观，不改碰撞体积） */
  visualScale?: number;
}

/**
 * 角色动作状态（仅人形使用）
 * — 让模型知道「在走 / 在跳 / 在挥砍 / 在瞄准」，而不是永远原地摆腿
 */
export interface CharAnim {
  moving?: boolean;
  onGround?: boolean;
  sprint?: boolean;
  /** 攻击动作剩余进度 0..1（1 = 刚出手，0 = 结束） */
  attack?: number;
  /** 远程武器瞄准角（世界弧度） */
  aim?: number;
  /** 武器形态：pickaxe / axe / hammer / sword / bow / staff / rod */
  weaponKind?: string;
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
    skin: '#d8a273',
    headgear: 'hat',        // 宽檐帽
    emblem: '#f0c040',      // 金币胸章
    visualScale: 1.2,
  },
  medic_settler: {
    kind: 'humanoid',
    main: '#d8dde2',
    dark: '#7a838c',
    light: '#f4f8fb',
    eye: '#4ad0a8',
    accent: '#3f9d7a',
    skin: '#e0b088',
    headgear: 'hood',       // 医师兜帽
    emblem: '#d24a4a',      // 红十字
    visualScale: 1.2,
  },
  engineer_settler: {
    kind: 'humanoid',
    main: '#c07030',
    dark: '#6e3a12',
    light: '#f0a860',
    eye: '#ffd24a',
    accent: '#4a4a52',
    weapon: '#9a9aa2',
    skin: '#c98d5a',
    headgear: 'goggles',    // 护目镜
    emblem: '#ffd24a',      // 齿轮标记
    visualScale: 1.2,
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
  anim?: CharAnim,
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const u = Math.max(1, Math.round(w / 10));
  const breathe = !anim && Math.sin(time * 3) > 0.6 ? 1 : 0;
  const cx = x + w / 2;

  switch (m.kind) {
    case 'humanoid': {
      // 人形外观可放大，脚底锚定，不影响实际碰撞体积
      const s = m.visualScale ?? 1;
      if (s !== 1) {
        const vw = w * s, vh = h * s;
        const vx = x + (w - vw) / 2;
        const vy = y + h - vh + breathe;
        drawHumanoid(ctx, m, vy, vw, vh, facing, time, Math.max(2, Math.round(vw / 10)), vx + vw / 2, anim);
      } else {
        drawHumanoid(ctx, m, y + breathe, w, h, facing, time, u, cx, anim);
      }
      break;
    }
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
  anim?: CharAnim,
) {
  // 比例：头 30% / 躯干 34% / 腿 36%，肩宽腰窄 —— 一眼能看出人形
  const headW = Math.max(7, Math.round(w * 0.70));
  const headH = Math.max(7, Math.round(h * 0.30));
  const bodyY = y + headH;
  const bodyH = Math.max(6, Math.round(h * 0.34));
  const bodyW = Math.max(7, Math.round(w * 0.86));   // 肩宽
  const waistW = Math.max(6, Math.round(w * 0.70));  // 腰宽
  const legW = Math.max(3, Math.round(w * 0.24));
  const gap = Math.max(1, Math.round(w * 0.05));
  const legY = bodyY + bodyH;
  const legH = Math.max(5, y + h - legY);
  const moving = anim?.moving ?? true;
  const onGround = anim?.onGround ?? true;
  const pace = anim?.sprint ? 19 : 13;
  const swing = Math.sin(time * (moving ? pace : 3));
  const bootH = Math.max(2, Math.round(u * 1.4));
  const skin = m.skin ?? '#d8a273';
  const outline = shade(m.dark, -0.5);
  const hair = m.accent ?? m.dark;
  const armW = Math.max(2, Math.round(w * 0.16));
  const armH = Math.max(5, Math.round(bodyH * 0.9));

  // ---- 腿（走路错步 / 跳跃收腿 / 站立轻晃）----
  let liftA = 0, liftB = 0;
  if (!onGround) {
    liftA = Math.round(u * 1.6);  // 跳跃：前腿收起
  } else if (moving) {
    liftA = swing > 0 ? u : 0;
    liftB = swing > 0 ? 0 : u;
  }
  const legLenA = Math.max(1, legH - liftA);
  const legLenB = Math.max(1, legH - liftB);
  const legXA = Math.round(cx - gap / 2 - legW);
  const legXB = Math.round(cx + gap / 2);
  // 腿部轮廓
  rect(ctx, legXA - 1, legY - 1, legW + 2, legLenA + 1, outline);
  rect(ctx, legXB - 1, legY - 1, legW + 2, legLenB + 1, outline);
  // 裤腿
  rect(ctx, legXA, legY, legW, legLenA, m.dark);
  rect(ctx, legXB, legY, legW, legLenB, m.dark);
  // 膝盖高光
  const kneeH = Math.max(1, Math.round(u * 0.6));
  rect(ctx, legXA, legY + Math.round(legLenA * 0.5), legW, kneeH, shade(m.dark, 0.14));
  rect(ctx, legXB, legY + Math.round(legLenB * 0.5), legW, kneeH, shade(m.dark, 0.14));
  // 靴子（比裤腿更厚重）
  const bootColor = shade(m.dark, -0.35);
  rect(ctx, legXA - 1, legY + legLenA - bootH, legW + 2, bootH, bootColor);
  rect(ctx, legXB - 1, legY + legLenB - bootH, legW + 2, bootH, bootColor);

  // ---- 躯干（肩宽腰窄 + 衣领 + 腰带 + 胸前标记）----
  const bodyX = Math.round(cx - bodyW / 2);
  rect(ctx, bodyX - 1, bodyY - 1, bodyW + 2, bodyH + 2, outline);
  rect(ctx, bodyX, bodyY, bodyW, bodyH, m.main);
  // 腰部收窄
  const waistTop = bodyY + Math.round(bodyH * 0.52);
  const waistX = Math.round(cx - waistW / 2);
  rect(ctx, waistX, waistTop, waistW, bodyY + bodyH - waistTop, shade(m.main, -0.12));
  // 左缘受光 / 右缘阴影
  const edge = Math.max(1, Math.round(u * 0.8));
  rect(ctx, bodyX, bodyY, edge, bodyH, m.light);
  rect(ctx, bodyX + bodyW - edge, bodyY, edge, bodyH, m.dark);
  // 衣领
  rect(ctx, cx - Math.round(bodyW * 0.26), bodyY, Math.round(bodyW * 0.52), Math.max(1, Math.round(u)), shade(m.main, 0.2));
  // 胸前标记（医师十字 / 工程师齿轮点 / 商人金币）
  if (m.emblem) {
    const ew = Math.max(1, Math.round(u * 0.9));
    const eh = Math.max(2, Math.round(u * 1.7));
    const ex = Math.round(cx - ew / 2);
    const ey = bodyY + Math.round(bodyH * 0.26);
    rect(ctx, ex, ey, ew, eh, m.emblem);
    rect(ctx, ex - ew, ey + Math.round(eh * 0.32), ew * 3, ew, m.emblem);
  }
  // 腰带
  const beltH = Math.max(1, Math.round(u * 1.1));
  rect(ctx, waistX, bodyY + bodyH - beltH, waistW, beltH, shade(m.dark, -0.12));
  rect(ctx, Math.round(cx - u * 0.8), bodyY + bodyH - beltH, Math.max(1, Math.round(u * 1.6)), beltH, m.accent ?? m.light);

  // ---- 后臂（摆动；手用肤色）----
  const armSwing = moving && onGround ? Math.round(swing * u) : 0;
  const backArmX = Math.round(cx - bodyW / 2 - armW + u * 0.3);
  const backArmY = onGround ? bodyY + Math.round(u * 0.5) + armSwing : bodyY + Math.round(u * 0.5) - Math.round(u * 1.2);
  rect(ctx, backArmX - 1, backArmY - 1, armW + 2, armH + 2, outline);
  rect(ctx, backArmX, backArmY, armW, armH, shade(m.main, -0.14));
  rect(ctx, backArmX, backArmY + armH - Math.max(1, Math.round(u * 1.1)), armW, Math.max(1, Math.round(u * 1.1)), skin);

  // ---- 头（肤色脸 + 头发/头饰 + 双眼 + 嘴）----
  const hx = Math.round(cx - headW / 2 + facing * u * 0.45);
  // 脖子（带阴影）
  const neckW = Math.max(2, Math.round(u * 1.8));
  rect(ctx, Math.round(cx - neckW / 2), bodyY - Math.round(u * 0.9), neckW, Math.round(u * 1.6), skin);
  rect(ctx, Math.round(cx - neckW / 2), bodyY - Math.round(u * 0.3), neckW, Math.max(1, Math.round(u * 0.5)), shade(skin, -0.3));
  // 头部轮廓与脸
  rect(ctx, hx - 1, y - 1, headW + 2, headH + 2, outline);
  rect(ctx, hx, y, headW, headH, skin);
  // 脸部背光侧
  rect(ctx, facing >= 0 ? hx + headW - u : hx, y + Math.round(headH * 0.22), Math.max(1, u), Math.round(headH * 0.7), shade(skin, -0.16));
  // 头发（顶部 + 后脑）
  rect(ctx, hx, y, headW, Math.max(2, Math.round(headH * 0.24)), hair);
  rect(ctx, facing >= 0 ? hx : hx + headW - u, y + Math.round(headH * 0.10), Math.max(1, u), Math.round(headH * 0.5), hair);
  // 耳朵
  rect(ctx, facing >= 0 ? hx + headW - 1 : hx, y + Math.round(headH * 0.46), Math.max(1, Math.round(u * 0.7)), Math.max(1, Math.round(u * 0.9)), shade(skin, -0.12));

  // 头饰：宽檐帽 / 头盔 / 护目镜 / 兜帽
  if (m.headgear === 'hat') {
    const brimW = headW + u * 4;
    rect(ctx, Math.round(cx - brimW / 2), y - Math.round(u * 0.6), brimW, Math.max(2, Math.round(u * 0.9)), hair);
    rect(ctx, hx + Math.round(headW * 0.18), y - Math.round(u * 2.2), Math.round(headW * 0.64), Math.round(u * 1.8), hair);
    rect(ctx, hx + Math.round(headW * 0.18), y - Math.round(u * 2.2), Math.round(headW * 0.64), Math.max(1, Math.round(u * 0.5)), shade(hair, 0.22));
  } else if (m.headgear === 'helmet') {
    const bandH = Math.max(2, Math.round(headH * 0.3));
    rect(ctx, hx - 1, y - 1 - Math.round(u * 0.5), headW + 2, bandH + Math.round(u * 0.5), shade(m.main, 0.05));
    rect(ctx, hx + Math.round(headW * 0.12), y, Math.max(1, Math.round(u * 0.8)), Math.round(headH * 0.5), shade(m.main, 0.18));
    rect(ctx, hx - 1, y + bandH - 1, headW + 2, Math.max(1, Math.round(u * 0.5)), shade(m.main, -0.25));
  } else if (m.headgear === 'goggles') {
    const gH = Math.max(2, Math.round(u * 1.2));
    rect(ctx, hx - 1, y + Math.round(headH * 0.34), headW + 2, gH, '#2a2a30');
    const lens = Math.max(2, Math.round(u * 1.3));
    rect(ctx, hx + Math.round(headW * 0.14), y + Math.round(headH * 0.32), lens, lens, '#79cfff');
    rect(ctx, hx + Math.round(headW * 0.62), y + Math.round(headH * 0.32), lens, lens, '#79cfff');
    rect(ctx, hx + Math.round(headW * 0.14), y + Math.round(headH * 0.32), Math.max(1, Math.round(lens * 0.4)), Math.max(1, Math.round(lens * 0.4)), '#eafaff');
  } else if (m.headgear === 'hood') {
    rect(ctx, hx - 1, y - Math.round(u), headW + 2, Math.round(headH * 0.42), hair);
    rect(ctx, facing >= 0 ? hx : hx + headW - u, y, Math.max(1, u), headH, hair);
    rect(ctx, facing >= 0 ? hx + headW - u : hx, y, Math.max(1, u), headH, hair);
  }

  // 双眼（朝向前方）与嘴
  const eyeSize = Math.max(1, Math.round(u * 0.9));
  const eyeY = y + Math.round(headH * 0.54);
  const eyeX = facing >= 0 ? hx + Math.round(headW * 0.42) : hx + Math.round(headW * 0.26);
  const eyeGap = Math.max(2, Math.round(headW * 0.22));
  rect(ctx, eyeX, eyeY, eyeSize, eyeSize, m.eye);
  rect(ctx, eyeX + (facing >= 0 ? eyeGap : -eyeGap), eyeY, eyeSize, eyeSize, m.eye);
  rect(ctx, facing >= 0 ? hx + Math.round(headW * 0.50) : hx + Math.round(headW * 0.20), y + Math.round(headH * 0.80), Math.max(1, Math.round(u * 0.8)), 1, shade(skin, -0.38));

  // ---- 前臂 + 武器（按动作状态旋转）----
  const weaponKind = anim?.weaponKind ?? 'pickaxe';
  let armAngle: number;
  if ((weaponKind === 'bow' || weaponKind === 'staff') && anim?.aim !== undefined) {
    // 远程：武器指向鼠标（翻转坐标系下需要换算角度）
    armAngle = facing >= 0 ? anim.aim : Math.PI - anim.aim;
  } else if ((anim?.attack ?? 0) > 0) {
    // 近战：从举起到下劈的挥砍轨迹
    const p = 1 - (anim?.attack ?? 0);
    armAngle = -1.2 + 2.05 * Math.min(1, p * 1.6);
  } else if (!onGround) {
    armAngle = -0.5; // 空中举着武器
  } else {
    armAngle = weaponKind === 'sword' ? 0.35 : weaponKind === 'rod' ? 0.6 : 0.75;
    if (moving) armAngle += Math.max(0, swing) * 0.12;
  }

  if (m.weapon) {
    const shX = cx + facing * bodyW * 0.32;
    const shY = bodyY + u * 1.15;
    const armLen = Math.max(4, Math.round(bodyH * 0.66));
    ctx.save();
    ctx.translate(Math.round(shX), Math.round(shY));
    ctx.scale(facing, 1);
    ctx.rotate(armAngle);
    rect(ctx, -1, -Math.round(armW / 2) - 1, armLen + 1, armW + 2, outline);
    rect(ctx, 0, -Math.round(armW / 2), armLen, armW, m.main);
    rect(ctx, 0, -Math.round(armW / 2), Math.max(1, Math.round(armW * 0.35)), armW, m.light);
    rect(ctx, armLen - u, -Math.round(armW / 2) - 1, u + 1, armW + 2, skin);
    drawWeaponShape(ctx, weaponKind, m.weapon, armLen + u * 0.4, u);
    ctx.restore();
  } else {
    const frontArmX = Math.round(cx + bodyW / 2 - armW + u * 0.3);
    const frontArmY = onGround ? bodyY + Math.round(u * 0.5) - armSwing : bodyY + Math.round(u * 0.5) - Math.round(u * 1.2);
    rect(ctx, frontArmX - 1, frontArmY - 1, armW + 2, armH + 2, outline);
    rect(ctx, frontArmX, frontArmY, armW, armH, m.main);
    rect(ctx, frontArmX, frontArmY + armH - Math.max(1, Math.round(u * 1.1)), armW, Math.max(1, Math.round(u * 1.1)), skin);
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

/**
 * 武器外形 —— 不同类别有不同剪影，不再所有武器都画成镐
 * 局部坐标系：原点在手上，+x 为武器朝向
 */
function drawWeaponShape(
  ctx: CanvasRenderingContext2D, kind: string, color: string, x0: number, u: number,
) {
  const dark = shade(color, -0.4);
  const light = shade(color, 0.35);

  switch (kind) {
    case 'sword': {
      const len = Math.max(10, Math.round(u * 8));
      ctx.fillStyle = dark;
      ctx.fillRect(Math.round(x0 - u * 0.8), Math.round(-u * 1.5), Math.max(2, Math.round(u * 1.2)), Math.round(u * 3));
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x0), Math.round(-u * 0.6), len, Math.max(2, Math.round(u * 1.2)));
      ctx.fillStyle = light;
      ctx.fillRect(Math.round(x0), Math.round(-u * 0.6), len, Math.max(1, Math.round(u * 0.4)));
      // 剑尖
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x0 + len), Math.round(-u * 0.25), Math.max(1, Math.round(u)), Math.max(1, Math.round(u * 0.5)));
      break;
    }
    case 'bow': {
      const r = Math.max(6, Math.round(u * 3.4));
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, u * 0.85);
      ctx.beginPath();
      ctx.arc(x0 + u, 0, r, -Math.PI * 0.62, Math.PI * 0.62);
      ctx.stroke();
      // 弦
      const ex = x0 + u + Math.cos(Math.PI * 0.62) * r;
      const ey = Math.sin(Math.PI * 0.62) * r;
      ctx.strokeStyle = 'rgba(240,232,208,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ex, -ey);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      break;
    }
    case 'staff': {
      const len = Math.max(10, Math.round(u * 7));
      ctx.fillStyle = '#7a5a34';
      ctx.fillRect(Math.round(x0), Math.round(-u * 0.4), len, Math.max(2, Math.round(u * 0.8)));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(Math.round(x0 + len), 0, Math.max(2, u * 1.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(Math.round(x0 + len - u * 0.4), -u * 0.4, Math.max(1, u * 0.45), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rod': {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x0), Math.round(-u * 0.3), Math.round(u * 8), Math.max(1, Math.round(u * 0.6)));
      break;
    }
    default: {
      // 镐 / 斧 / 锤：木柄 + 金属头
      const len = Math.max(8, Math.round(u * 5.5));
      ctx.fillStyle = '#8a6038';
      ctx.fillRect(Math.round(x0 - u), Math.round(-u * 0.4), len, Math.max(2, Math.round(u * 0.8)));
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x0 + len - u * 2), Math.round(-u * 2.0), Math.max(2, Math.round(u * 2.2)), Math.max(1, Math.round(u)));
      ctx.fillRect(Math.round(x0 + len - u * 0.6), Math.round(-u * 1.3), Math.max(1, Math.round(u * 1.2)), Math.max(2, Math.round(u * 2.4)));
      ctx.fillStyle = light;
      ctx.fillRect(Math.round(x0 + len - u * 2), Math.round(-u * 2.0), Math.max(1, Math.round(u * 2.2)), Math.max(1, Math.round(u * 0.5)));
      break;
    }
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
