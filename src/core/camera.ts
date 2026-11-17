/**
 * 烬海纪元 · 摄像机
 * 带震屏效果 — rock_titan 撞击 / 跺脚 时触发
 */
export interface Camera {
  x: number;
  y: number;
  width: number;
  height: number;
  lerpSpeed: number;
  // 震屏状态
  shakeAmt: number;   // 当前震屏强度（0 = 无震屏）
}

export function createCamera(width: number, height: number): Camera {
  return { x: 0, y: 0, width, height, lerpSpeed: 0.14, shakeAmt: 0 };
}

export function follow(cam: Camera, targetX: number, targetY: number, mapWidth: number, mapHeight: number, tileSize: number) {
  const targetCX = targetX - cam.width / 2;
  const targetCY = targetY - cam.height / 2;
  cam.x += (targetCX - cam.x) * cam.lerpSpeed;
  cam.y += (targetCY - cam.y) * cam.lerpSpeed;
  cam.x = Math.max(0, Math.min(mapWidth * tileSize - cam.width, cam.x));
  cam.y = Math.max(0, Math.min(mapHeight * tileSize - cam.height, cam.y));
}

/** 触发震屏 — intensity 建议 4-15 */
export function shake(cam: Camera, intensity: number) {
  cam.shakeAmt = Math.max(cam.shakeAmt, intensity);
}

/**
 * 计算本帧震屏偏移 + 衰减 shakeAmt
 * 在主循环 update 中每帧调用
 */
export function updateShake(cam: Camera, dt: number) {
  if (cam.shakeAmt > 0) {
    cam.shakeAmt = Math.max(0, cam.shakeAmt - dt * 30); // 每秒衰减 30 单位
  }
}

/** 取当前帧的屏幕偏移量（renderer 在 apply transform 时使用） */
export function getShakeOffset(cam: Camera): { ox: number; oy: number } {
  if (cam.shakeAmt <= 0) return { ox: 0, oy: 0 };
  const ox = (Math.random() - 0.5) * cam.shakeAmt * 2;
  const oy = (Math.random() - 0.5) * cam.shakeAmt * 2;
  return { ox, oy };
}
