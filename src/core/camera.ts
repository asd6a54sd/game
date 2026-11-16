/**
 * 烬海纪元 · 摄像机
 */
export interface Camera {
  x: number;
  y: number;
  width: number;
  height: number;
  lerpSpeed: number;
}

export function createCamera(width: number, height: number): Camera {
  return { x: 0, y: 0, width, height, lerpSpeed: 0.1 };
}

export function follow(cam: Camera, targetX: number, targetY: number, mapWidth: number, mapHeight: number, tileSize: number) {
  const targetCX = targetX - cam.width / 2;
  const targetCY = targetY - cam.height / 2;
  cam.x += (targetCX - cam.x) * cam.lerpSpeed;
  cam.y += (targetCY - cam.y) * cam.lerpSpeed;
  cam.x = Math.max(0, Math.min(mapWidth * tileSize - cam.width, cam.x));
  cam.y = Math.max(0, Math.min(mapHeight * tileSize - cam.height, cam.y));
}
