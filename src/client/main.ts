// The screen: draws the room, listens to the mouse and keyboard, and shows text.
// It never decides what's allowed. It asks the Game and draws the answer.

import { Game, Position } from "../game/game";
import { DIRECTION_STEP, Direction, ROOMS, ROOM_SIZE, TileKind, mapPositions } from "../game/world";

const TILE = 52; // pixels per tile on screen
const STEP_MS = 110; // how long each step of walking takes

const COLORS: Record<TileKind, string> = {
  void: "#17161a",
  wall: "#4a4e57",
  floor: "#a39883",
  grass: "#6f8f4e",
  table: "#7a5230",
  well: "#5d6b78",
  stairsUp: "#c2b59b",
  stairsDown: "#c2b59b",
  exit: "#2a2622",
  doorClosed: "#6b4423",
  doorOpen: "#2a2622",
};

const game = new Game();

const canvas = document.getElementById("map") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const roomName = document.getElementById("room-name")!;
const log = document.getElementById("log")!;
const input = document.getElementById("command") as HTMLInputElement;

const mapCanvas = document.getElementById("world-map") as HTMLCanvasElement;
const mapCtx = mapCanvas.getContext("2d")!;
const positions = mapPositions();

canvas.width = ROOM_SIZE * TILE;
canvas.height = ROOM_SIZE * TILE;

let hover: Position | null = null;
let walking = false;

// ---- drawing ----

function draw(): void {
  const room = game.room;
  roomName.textContent = room.name;

  for (let y = 0; y < ROOM_SIZE; y++) {
    for (let x = 0; x < ROOM_SIZE; x++) {
      const tile = game.tileAt(x, y);
      drawTile(x, y, tile.info.kind, tile.exit);
    }
  }

  drawDarkness(room.light);

  if (hover && game.tileAt(hover.x, hover.y).info.kind !== "void") {
    ctx.strokeStyle = "rgba(255, 240, 180, 0.9)";
    ctx.lineWidth = 3;
    ctx.strokeRect(hover.x * TILE + 2, hover.y * TILE + 2, TILE - 4, TILE - 4);
  }

  drawPlayer(game.player.pos);
  drawWorldMap();
}

const EXIT_LABELS: Record<Direction, string> = {
  north: "N", northeast: "NE", east: "E", southeast: "SE",
  south: "S", southwest: "SW", west: "W", northwest: "NW", up: "UP", down: "DOWN",
};

function drawTile(x: number, y: number, kind: TileKind, exit?: Direction): void {
  const px = x * TILE;
  const py = y * TILE;
  if (kind === "void") {
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(px, py, TILE, TILE);
    return;
  }
  // Tables and wells sit on a floor, so draw the floor first.
  ctx.fillStyle = kind === "table" || kind === "well" ? COLORS.floor : COLORS[kind];
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);

  ctx.fillStyle = COLORS[kind];
  if (kind === "table") {
    ctx.fillRect(px + 4, py + 14, TILE - 8, TILE - 28);
  } else if (kind === "well") {
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, TILE * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d2a36";
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, TILE * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "stairsUp" || kind === "stairsDown") {
    ctx.fillStyle = "#6d6352";
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 8, py + 10 + i * 12, TILE - 16, 5);
  }

  if (kind === "doorClosed") {
    ctx.fillStyle = "#3e2712";
    ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
    ctx.fillStyle = COLORS.doorClosed;
    ctx.fillRect(px + 9, py + 9, TILE - 18, TILE - 18);
  } else if (kind === "doorOpen") {
    ctx.fillStyle = COLORS.doorClosed;
    ctx.fillRect(px + 4, py + 4, 6, TILE - 8);
  }

  if (exit) {
    ctx.fillStyle = "#f0d98c";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(EXIT_LABELS[exit], px + TILE / 2, py + TILE / 2);
  }
}

// Light runs from 0 (perfect dark) to 100 (summer noon). Dim rooms get a dark veil.
// Below 100 the veil gets thicker, but never fully black, so you can still play.
function drawDarkness(light: number): void {
  const veil = Math.min(0.8, (1 - light / 100) * 0.85);
  if (veil <= 0) return;
  ctx.fillStyle = `rgba(8, 8, 20, ${veil})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPlayer(pos: Position): void {
  const cx = pos.x * TILE + TILE / 2;
  const cy = pos.y * TILE + TILE / 2;
  ctx.fillStyle = "#2f6fd6";
  ctx.beginPath();
  ctx.arc(cx, cy, TILE * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e9f0ff";
  ctx.lineWidth = 3;
  ctx.stroke();
}

// The map of explored rooms: each room is a small octagon, joined by its exits.
// Only rooms on the player's current floor are shown.
function drawWorldMap(): void {
  const size = 22; // octagon width in pixels
  const gap = 34; // distance between room centers
  const here = positions[game.player.roomId];
  const cx = mapCanvas.width / 2;
  const cy = mapCanvas.height / 2;
  const toScreen = (p: { x: number; y: number }) => ({ x: cx + (p.x - here.x) * gap, y: cy + (p.y - here.y) * gap });

  mapCtx.fillStyle = "#222127";
  mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

  const shown = [...game.visited].filter((id) => positions[id].z === here.z);

  mapCtx.strokeStyle = "#6d6352";
  mapCtx.lineWidth = 3;
  for (const id of shown) {
    const from = toScreen(positions[id]);
    for (const dir of Object.keys(ROOMS[id].exits) as Direction[]) {
      const step = DIRECTION_STEP[dir];
      if (step.dz !== 0 || !game.knowsExit(id, dir)) continue;
      mapCtx.beginPath();
      mapCtx.moveTo(from.x, from.y);
      mapCtx.lineTo(from.x + (step.dx * gap) / 2, from.y + (step.dy * gap) / 2);
      mapCtx.stroke();
    }
  }

  for (const id of shown) {
    const p = toScreen(positions[id]);
    octagon(mapCtx, p.x, p.y, size);
    mapCtx.fillStyle = id === game.player.roomId ? "#2f6fd6" : "#a39883";
    mapCtx.fill();
    const exits = ROOMS[id].exits;
    if (exits.up || exits.down) {
      mapCtx.fillStyle = "#17161a";
      mapCtx.font = "bold 10px sans-serif";
      mapCtx.textAlign = "center";
      mapCtx.textBaseline = "middle";
      mapCtx.fillText(exits.up && exits.down ? "UD" : exits.up ? "U" : "D", p.x, p.y);
    }
  }
}

function octagon(c: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const r = size / 2;
  const k = r * 0.414; // tan(22.5 degrees): makes all eight sides equal
  c.beginPath();
  c.moveTo(x - k, y - r);
  c.lineTo(x + k, y - r);
  c.lineTo(x + r, y - k);
  c.lineTo(x + r, y + k);
  c.lineTo(x + k, y + r);
  c.lineTo(x - k, y + r);
  c.lineTo(x - r, y + k);
  c.lineTo(x - r, y - k);
  c.closePath();
}

// ---- text ----

function print(lines: string[], kind: "game" | "you" = "game"): void {
  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = kind === "you" ? `> ${line}` : line;
    p.className = kind;
    log.appendChild(p);
  }
  log.scrollTop = log.scrollHeight;
}

// ---- actions ----

function runCommand(text: string): void {
  if (walking) return;
  print([text], "you");
  print(game.handleCommand(text));
  draw();
}

function walk(path: Position[], then?: () => void): void {
  walking = true;
  let i = 0;
  const timer = setInterval(() => {
    if (i >= path.length) {
      clearInterval(timer);
      walking = false;
      then?.();
      draw();
      return;
    }
    game.step(path[i++]);
    draw();
  }, STEP_MS);
}

function tileFromMouse(e: MouseEvent): Position {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width; // the canvas may be shrunk to fit the screen
  return {
    x: Math.floor(((e.clientX - rect.left) * scale) / TILE),
    y: Math.floor(((e.clientY - rect.top) * scale) / TILE),
  };
}

canvas.addEventListener("click", (e) => {
  if (walking) return;
  const { x, y } = tileFromMouse(e);
  const result = game.clickTile(x, y);
  print(result.messages);
  // Clicking an exit or a door is the same as typing the command, once you get there.
  walk(result.path, result.command ? () => runCommand(result.command!) : undefined);
});

canvas.addEventListener("mousemove", (e) => {
  hover = tileFromMouse(e);
  const kind = game.tileAt(hover.x, hover.y).info;
  const clickable = kind.walkable || kind.kind === "doorClosed";
  canvas.style.cursor = kind.kind === "void" ? "default" : clickable ? "pointer" : "help";
  draw();
});

canvas.addEventListener("mouseleave", () => {
  hover = null;
  draw();
});

input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = input.value;
  input.value = "";
  if (text.trim()) runCommand(text);
});

// ---- start ----

print(["Welcome to Big Dawg's Castle.", "Click the floor to walk, click things to look at them, or type commands below (try \"help\")."]);
print(game.look());
draw();
input.focus();
