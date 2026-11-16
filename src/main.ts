/**
 * 烬海纪元 · M0 主入口
 * 技术验证：工程骨架 + 一格破坏系统
 */
import './style.css';
import {
  generateTerrain, TerrainData, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, biToBlock, regionNameAt,
} from './core/terrain.js';
import { BLOCKS, isSolid } from './core/blocks.js';
import { createCamera, follow } from './core/camera.js';
import { createPlayer, updatePlayer, placePlayerOnGround } from './core/player.js';
import { Renderer } from './core/renderer.js';
import { createBreakState, startBreaking, stopBreaking, updateBreaking, updateParticles } from './core/break.js';

// ================ 启动 ================
const loading = document.getElementById('loading')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudPos = document.getElementById('hud-pos')!;
const hudBlock = document.getElementById('hud-block')!;
const hudRegion = document.getElementById('hud-region')!;

const renderer = new Renderer(canvas);

// 状态
let terrain: TerrainData;
let cam = createCamera(window.innerWidth, window.innerHeight);
let player = createPlayer();
let breakState = createBreakState();

// 输入
const input = { left: false, right: false, jump: false, brake: false };
let mouseTile: { x: number; y: number } | null = null;
let mouseLeft = false;

// 初始化
init();

async function init() {
  terrain = generateTerrain(20261116);
  placePlayerOnGround(player, terrain.heightMap);
  resize();
  window.addEventListener('resize', resize);
  bindInput();
  loading.classList.add('hidden');
  requestAnimationFrame(loop);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.resize(w, h);
  cam.width = w; cam.height = h;
}

function bindInput() {
  window.addEventListener('keydown', e => {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': input.left = true; break;
      case 'ArrowRight': case 'KeyD': input.right = true; break;
      case 'ArrowUp': case 'KeyW': case 'Space': input.jump = true; break;
      case 'ShiftLeft': case 'ShiftRight': input.brake = true; break;
    }
  });
  window.addEventListener('keyup', e => {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': input.left = false; break;
      case 'ArrowRight': case 'KeyD': input.right = false; break;
      case 'ArrowUp': case 'KeyW': case 'Space': input.jump = false; break;
      case 'ShiftLeft': case 'ShiftRight': input.brake = false; break;
    }
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wx = sx + cam.x;
    const wy = sy + cam.y;
    mouseTile = { x: Math.floor(wx / TILE_SIZE), y: Math.floor(wy / TILE_SIZE) };
  });

  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) mouseLeft = true;
    if (e.button === 0 && mouseTile) {
      const px = Math.floor(player.x / TILE_SIZE);
      const py = Math.floor(player.y / TILE_SIZE);
      const d = Math.abs(mouseTile.x - px) + Math.abs(mouseTile.y - py);
      if (d <= 6) startBreaking(breakState, mouseTile.x, mouseTile.y, getBlock);
    }
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) { mouseLeft = false; stopBreaking(breakState); }
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// ================ 世界查询 ================
function getBlock(tx: number, ty: number): string {
  if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return 'empty';
  return biToBlock(terrain.tiles[ty * MAP_WIDTH + tx]);
}

function setBlock(tx: number, ty: number, id: string) {
  if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return;
  const ids = Object.keys(BLOCKS);
  terrain.tiles[ty * MAP_WIDTH + tx] = ids.indexOf(id);
}

function getTileSolid(tx: number, ty: number): boolean {
  return isSolid(getBlock(tx, ty));
}

// ================ 主循环 ================
let lastT = performance.now();
let totalFrames = 0, totalTime = 0;

function loop(t: number) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  totalFrames++; totalTime += dt;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function update(dt: number) {
  // 玩家
  updatePlayer(player, dt, input, getTileSolid);

  // 摄像机跟随
  follow(cam, player.x, player.y, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE);

  // 破坏系统
  if (mouseLeft && mouseTile) {
    const px = Math.floor(player.x / TILE_SIZE);
    const py = Math.floor(player.y / TILE_SIZE);
    const d = Math.abs(mouseTile.x - px) + Math.abs(mouseTile.y - py);
    if (d <= 6) {
      if (!breakState.targetTile) startBreaking(breakState, mouseTile.x, mouseTile.y, getBlock);
      else if (breakState.targetTile.x !== mouseTile.x || breakState.targetTile.y !== mouseTile.y) {
        stopBreaking(breakState);
        startBreaking(breakState, mouseTile.x, mouseTile.y, getBlock);
      }
    } else {
      stopBreaking(breakState);
    }
  } else {
    stopBreaking(breakState);
  }
  updateBreaking(breakState, dt, getBlock, setBlock);
  updateParticles(breakState, dt, getTileSolid);

  // 掉落物拾取
  for (let i = breakState.drops.length - 1; i >= 0; i--) {
    const d = breakState.drops[i];
    const dx = d.x - player.x, dy = d.y - player.y;
    if (dx * dx + dy * dy < 24 * 24) {
      player.hp = Math.min(player.maxHp, player.hp + 1); // 简化：掉落=微量回血（占位）
      breakState.drops.splice(i, 1);
    }
  }

  updateHUD();
}

function render() {
  renderer.clear();
  renderer.drawBackground(cam);
  renderer.drawWorld(terrain.tiles, cam, breakState);
  renderer.drawPlayer(player, cam);

  // 十字准星
  if (mouseTile) {
    const sx = mouseTile.x * TILE_SIZE - cam.x + TILE_SIZE / 2;
    const sy = mouseTile.y * TILE_SIZE - cam.y + TILE_SIZE / 2;
    renderer.drawCrosshair(sx, sy);
  }
}

function updateHUD() {
  const px = Math.floor(player.x / TILE_SIZE);
  const py = Math.floor(player.y / TILE_SIZE);
  hudPos.textContent = `坐标: (${px}, ${py}) | FPS: ${(totalFrames / Math.max(0.001, totalTime)).toFixed(0)}`;

  if (mouseTile) {
    const id = getBlock(mouseTile.x, mouseTile.y);
    const def = BLOCKS[id];
    if (def && id !== 'empty') {
      hudBlock.textContent = `方块: ${def.name} (硬度 ${def.hardness}${def.toolLevel > 0 ? ` · 需镐II${def.toolLevel}` : ''})`;
    } else {
      hudBlock.textContent = '方块: — (空气)';
    }
    hudRegion.textContent = `区块: ${regionNameAt(mouseTile.x)}`;
  } else {
    hudBlock.textContent = '方块: —';
    hudRegion.textContent = `区块: ${regionNameAt(px)}`;
  }
}
