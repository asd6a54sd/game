/**
 * 烬海纪元 · 主入口
 * M0 + M1 核心玩法：工程骨架 + 一格破坏 + 背包 + 放置 + 工具 + 日夜
 */
import './style.css';
import { generateTerrain, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, biToBlock, regionNameAt } from './core/terrain.js';
import { BLOCKS, isSolid } from './core/blocks.js';
import { createCamera, follow } from './core/camera.js';
import { createPlayer, updatePlayer, placePlayerOnGround, Player } from './core/player.js';
import { Renderer } from './core/renderer.js';
import {
  createBreakState, startBreaking, stopBreaking, updateBreaking, updateParticles, BreakState,
} from './core/break.js';
import { Inventory } from './core/inventory.js';
import { TOOLS } from './core/tools.js';

// ========== DOM ==========
const loading = document.getElementById('loading')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudPos = document.getElementById('hud-pos')!;
const hudBlock = document.getElementById('hud-block')!;
const hudRegion = document.getElementById('hud-region')!;

// ========== 状态 ==========
let terrain = generateTerrain(20261116);
const renderer = new Renderer(canvas);
let cam = createCamera(window.innerWidth, window.innerHeight);
let player = createPlayer();
let breakState: BreakState = createBreakState();
const inv = new Inventory();

// ===== 给玩家挂 inventory + tool =====
interface PlayerExt extends Player {
  toolName: string;
}
const px = player as PlayerExt;
px.toolName = 'hand_pickaxe';

// 初始给些基础物品方便测试
inv.add('wreck_scrap', 20);
inv.add('cracked_ground', 30);
inv.add('wind_rock', 15);
inv.add('copper_pickaxe', 1);
inv.add('copper_sword', 1);
inv.selectHotbar(0);
// 把镐放到快捷栏第 1 格
inv.hotbar[1] = { blockId: 'copper_pickaxe', count: 1 };
inv.hotbar[2] = { blockId: 'copper_sword', count: 1 };

// ========== 输入 ==========
const input = { left: false, right: false, jump: false, brake: false };
let mouseTile: { x: number; y: number } | null = null;
let mouseLeft = false;
let mouseRight = false;
let mouseRightEdge = false;

// ========== 启动 ==========
init();

async function init() {
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
      case 'Digit1': case 'Numpad1': inv.selectHotbar(0); break;
      case 'Digit2': case 'Numpad2': inv.selectHotbar(1); break;
      case 'Digit3': case 'Numpad3': inv.selectHotbar(2); break;
      case 'Digit4': case 'Numpad4': inv.selectHotbar(3); break;
      case 'Digit5': case 'Numpad5': inv.selectHotbar(4); break;
      case 'Digit6': case 'Numpad6': inv.selectHotbar(5); break;
      case 'Digit7': case 'Numpad7': inv.selectHotbar(6); break;
      case 'Digit8': case 'Numpad8': inv.selectHotbar(7); break;
      case 'Digit9': case 'Numpad9': inv.selectHotbar(8); break;
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

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    inv.scrollHotbar(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) mouseLeft = true;
    if (e.button === 2) { mouseRight = true; mouseRightEdge = true; }
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) mouseLeft = false;
    if (e.button === 2) mouseRight = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

// ========== 世界查询 ==========
function getBlock(tx: number, ty: number): string {
  if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return 'empty';
  return biToBlock(terrain.tiles[ty * MAP_WIDTH + tx]);
}
function setBlock(tx: number, ty: number, id: string) {
  if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return;
  const ids = Object.keys(BLOCKS);
  const idx = ids.indexOf(id);
  if (idx >= 0) terrain.tiles[ty * MAP_WIDTH + tx] = idx;
}
function getTileSolid(tx: number, ty: number) {
  return isSolid(getBlock(tx, ty));
}

// ========== 主循环 ==========
let lastT = performance.now();
let fpsAcc = 0, fpsFrames = 0, fpsNow = 0;

function loop(t: number) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 1) { fpsNow = fpsFrames; fpsFrames = 0; fpsAcc = 0; }

  update(dt);
  render();

  mouseRightEdge = false;
  requestAnimationFrame(loop);
}

function update(dt: number) {
  // 日夜循环（每 240 秒 = 完整一天）
  renderer.timeOfDay = (renderer.timeOfDay + dt / 240) % 1;

  // 玩家
  updatePlayer(player, dt, input, getTileSolid);

  // 摄像机跟随
  follow(cam, player.x, player.y, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE);

  // 破坏系统（左键）
  if (mouseLeft && mouseTile) {
  const pcol = Math.floor(player.x / TILE_SIZE);
  const prow = Math.floor(player.y / TILE_SIZE);
  const colDist = Math.abs(mouseTile.x - pcol) + Math.abs(mouseTile.y - prow);
  if (colDist <= 6) {
      if (!breakState.targetTile) {
        startBreaking(breakState, mouseTile.x, mouseTile.y, getBlock, px.toolName);
      } else if (breakState.targetTile.x !== mouseTile.x || breakState.targetTile.y !== mouseTile.y) {
        stopBreaking(breakState);
        startBreaking(breakState, mouseTile.x, mouseTile.y, getBlock, px.toolName);
      }
    } else {
      stopBreaking(breakState);
    }
  } else {
    stopBreaking(breakState);
  }
  updateBreaking(breakState, dt, px.toolName, getBlock, setBlock);
  updateParticles(breakState, dt, getTileSolid);

  // 放置系统（右键）
  if (mouseRightEdge && mouseTile) {
    const selected = inv.getSelected();
    if (selected.count > 0 && selected.blockId) {
      const existing = getBlock(mouseTile.x, mouseTile.y);
      if (existing === 'empty') {
        setBlock(mouseTile.x, mouseTile.y, selected.blockId);
        inv.consumeSelected(1);
      }
    }
  }

  // 掉落物拾取
  for (let i = breakState.drops.length - 1; i >= 0; i--) {
    const d = breakState.drops[i];
    const dx = d.x - player.x, dy = d.y - player.y;
    if (dx * dx + dy * dy < 28 * 28) {
      const picked = inv.add(d.blockId, 1);
      if (picked > 0) breakState.drops.splice(i, 1);
    }
  }

  // 工具自动切换（快捷栏 1-2 是工具）
  updateToolSelection();

  updateHUD();
}

function updateToolSelection() {
  const sel = inv.getSelected();
  if (sel.count > 0 && TOOLS[sel.blockId]) {
    px.toolName = sel.blockId;
  } else {
    // 没选中工具就徒手
    px.toolName = 'hand_pickaxe';
  }
}

function render() {
  renderer.clear();
  renderer.drawBackground(cam);
  renderer.drawWorld(terrain.tiles, cam, breakState);

  // 放置预览
  if (mouseRight && mouseTile) {
    const sel = inv.getSelected();
    if (sel.count > 0 && sel.blockId && BLOCKS[sel.blockId]) {
      const below = getBlock(mouseTile.x, mouseTile.y);
      renderer.drawPlacementGhost(sel.blockId, mouseTile.x, mouseTile.y, cam, below !== 'empty');
    }
  }

  renderer.drawPlayer(player, cam);

  // 十字准星
  if (mouseTile) {
    const sx = mouseTile.x * TILE_SIZE - cam.x + TILE_SIZE / 2;
    const sy = mouseTile.y * TILE_SIZE - cam.y + TILE_SIZE / 2;
    renderer.drawCrosshair(sx, sy);
  }

  // 快捷栏 UI
  renderer.drawHotbar(inv);
}

function updateHUD() {
  const pcol = Math.floor(player.x / TILE_SIZE);
  const prow = Math.floor(player.y / TILE_SIZE);
  const tool = TOOLS[px.toolName];
  hudPos.textContent = `坐标: (${pcol}, ${prow}) | FPS: ${fpsNow} | 时间: ${formatTime(renderer.timeOfDay)} | ${tool.name}`;

  if (mouseTile) {
    const id = getBlock(mouseTile.x, mouseTile.y);
    const def = BLOCKS[id];
    if (def && id !== 'empty') {
      const curTool = TOOLS[px.toolName];
      const canBreak = curTool.pickaxePower >= def.toolLevel;
      hudBlock.textContent = `方块: ${def.name} (硬度 ${def.hardness} · 需镐Lv${def.toolLevel} ${canBreak ? '✓' : '✗ 挖不动'})`;
    } else {
      hudBlock.textContent = '方块: — (空气)';
    }
    hudRegion.textContent = `区块: ${regionNameAt(mouseTile.x)}`;
  } else {
    hudBlock.textContent = '方块: —';
    hudRegion.textContent = `区块: ${regionNameAt(pcol)}`;
  }
}

function formatTime(t: number): string {
  const h = Math.floor(t * 24);
  const m = Math.floor((t * 24 - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

