// The screen: draws the room, listens to the mouse and keyboard, and shows text.
// It never decides what's allowed. Every click becomes the same command a
// terminal player would type, and the Game decides what happens.

import { Game } from "../game/game";
import { DIRECTION_STEP, Direction, ROOMS, Thing, ThingKind, mapPositions } from "../game/world";

const SIZE = 560; // the room canvas is SIZE x SIZE pixels
const CENTER = SIZE / 2;
const RADIUS = 236; // center to each corner of the octagon
const APOTHEM = RADIUS * Math.cos(Math.PI / 8); // center to the middle of each side
const TOKEN = 30; // radius of each thing in the room

const COLORS = {
  background: "#17161a",
  wall: "#4a4e57",
  floorIndoor: "#8d8578",
  floorOutdoor: "#8a9468",
  opening: "#211f1c",
  door: "#7a4e28",
  doorEdge: "#3e2712",
  label: "#f0d98c",
  text: "#e8e2d4",
  hover: "rgba(255, 240, 180, 0.95)",
  stairs: "#6d6352",
};

const THING_COLORS: Record<ThingKind, string> = {
  feature: "#5d6b78",
  item: "#c9a24a",
  creature: "#b5523b",
};

const EXIT_LABELS: Record<Direction, string> = {
  north: "N", northeast: "NE", east: "E", southeast: "SE",
  south: "S", southwest: "SW", west: "W", northwest: "NW", up: "UP", down: "DOWN",
};

// The angle each side of the octagon faces, in radians (0 is east, north is up).
const SIDE_ANGLE: Partial<Record<Direction, number>> = {
  east: 0, southeast: Math.PI / 4, south: Math.PI / 2, southwest: (3 * Math.PI) / 4,
  west: Math.PI, northwest: (-3 * Math.PI) / 4, north: -Math.PI / 2, northeast: -Math.PI / 4,
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

canvas.width = SIZE;
canvas.height = SIZE;

// Everything clickable in the current drawing, and the command each one sends.
interface Hotspot { x: number; y: number; r: number; command: string }
let hotspots: Hotspot[] = [];
let mouse: { x: number; y: number } | null = null;

// ---- drawing the room ----

function draw(): void {
  const room = game.room;
  roomName.textContent = room.name;
  hotspots = [];

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // The room itself: one octagon. Light sets how dark the floor looks.
  octagon(ctx, CENTER, CENTER, RADIUS);
  ctx.fillStyle = room.indoor ? COLORS.floorIndoor : COLORS.floorOutdoor;
  ctx.fill();
  ctx.fillStyle = `rgba(8, 8, 20, ${darkness(room.light)})`;
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = COLORS.wall;
  ctx.stroke();

  for (const [dir, exit] of game.visibleExits()) {
    if (dir === "up" || dir === "down") continue;
    drawSideExit(dir, exit.door ? (exit.door.closed ? "closed" : "open") : "opening");
  }

  // Things in the room, plus any stairs, sit in a ring around the middle.
  const tokens: { draw: (x: number, y: number) => void; command: string }[] = [];
  for (const [dir] of game.visibleExits()) {
    if (dir === "up" || dir === "down") tokens.push({ draw: (x, y) => drawStairs(x, y, dir), command: dir });
  }
  for (const thing of room.contents) {
    tokens.push({ draw: (x, y) => drawThing(x, y, thing), command: `look ${thing.keywords[0]}` });
  }
  tokens.forEach((token, i) => {
    const { x, y } = ringSpot(i, tokens.length);
    ctx.globalAlpha = 0.45 + 0.55 * (room.light / 100);
    token.draw(x, y);
    ctx.globalAlpha = 1;
    hotspots.push({ x, y, r: TOKEN + 6, command: token.command });
  });

  const hovered = hotspotUnderMouse();
  if (hovered) {
    ctx.strokeStyle = COLORS.hover;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hovered.x, hovered.y, hovered.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  canvas.style.cursor = hovered ? "pointer" : "default";

  drawWorldMap();
}

// Light runs from 0 (perfect dark) to 100 (summer noon). Never fully black, so you can still play.
function darkness(light: number): number {
  return Math.min(0.75, (1 - light / 100) * 0.8);
}

// Spread n things evenly around a circle in the middle of the room.
function ringSpot(i: number, n: number): { x: number; y: number } {
  if (n === 1) return { x: CENTER, y: CENTER };
  const ring = n <= 3 ? 90 : 120;
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: CENTER + Math.cos(angle) * ring, y: CENTER + Math.sin(angle) * ring };
}

// A doorway cut into one side of the octagon.
function drawSideExit(dir: Direction, state: "opening" | "closed" | "open"): void {
  const angle = SIDE_ANGLE[dir]!;
  const x = CENTER + Math.cos(angle) * APOTHEM;
  const y = CENTER + Math.sin(angle) * APOTHEM;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2); // the doorway now lies along the x axis
  const w = 70;
  const d = 22;
  ctx.fillStyle = COLORS.opening;
  ctx.fillRect(-w / 2, -d / 2, w, d);
  if (state === "closed") {
    ctx.fillStyle = COLORS.doorEdge;
    ctx.fillRect(-w / 2, -d / 2, w, d);
    ctx.fillStyle = COLORS.door;
    ctx.fillRect(-w / 2 + 3, -d / 2 + 3, w - 6, d - 6);
    ctx.fillStyle = COLORS.label;
    ctx.beginPath();
    ctx.arc(w / 2 - 12, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (state === "open") {
    // The door swung inward, hinged on one side.
    ctx.fillStyle = COLORS.door;
    ctx.save();
    ctx.translate(-w / 2, d / 2);
    ctx.rotate(Math.PI / 3); // +y points into the room
    ctx.fillRect(0, -3, w * 0.8, 6);
    ctx.restore();
  }
  ctx.restore();

  // The direction label sits just outside the wall.
  const lx = CENTER + Math.cos(angle) * (APOTHEM + 24);
  const ly = CENTER + Math.sin(angle) * (APOTHEM + 24);
  ctx.fillStyle = COLORS.label;
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(EXIT_LABELS[dir], lx, ly);

  hotspots.push({ x, y, r: 38, command: game.commandForExit(dir) });
}

function drawThing(x: number, y: number, thing: Thing): void {
  ctx.fillStyle = THING_COLORS[thing.kind];
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (thing.kind === "item") {
    // Items are diamonds.
    ctx.moveTo(x, y - TOKEN);
    ctx.lineTo(x + TOKEN, y);
    ctx.lineTo(x, y + TOKEN);
    ctx.lineTo(x - TOKEN, y);
    ctx.closePath();
  } else if (thing.kind === "creature") {
    ctx.arc(x, y, TOKEN, 0, Math.PI * 2);
  } else {
    ctx.roundRect(x - TOKEN, y - TOKEN * 0.8, TOKEN * 2, TOKEN * 1.6, 6);
  }
  ctx.fill();
  ctx.stroke();

  if (thing.kind === "creature") {
    ctx.fillStyle = "#f4ead2";
    for (const ex of [-9, 9]) {
      ctx.beginPath();
      ctx.arc(x + ex, y - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawLabel(thing.name, x, y + TOKEN + 14);
}

function drawStairs(x: number, y: number, dir: Direction): void {
  ctx.fillStyle = COLORS.stairs;
  ctx.beginPath();
  ctx.arc(x, y, TOKEN, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c2b59b";
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 16 + i * 4, y - 12 + i * 7, 32 - i * 8, 4);
  drawLabel(dir === "up" ? "stairs up" : "stairs down", x, y + TOKEN + 14);
}

function drawLabel(text: string, x: number, y: number): void {
  ctx.font = "14px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(10, 10, 14, 0.75)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(text, x, y);
}

// An octagon with its eight flat sides facing the eight compass directions.
function octagon(c: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}

// ---- the map of explored rooms ----
// Each room is a small octagon, joined by its exits. Only rooms on the current floor are shown.

function drawWorldMap(): void {
  const size = 12; // octagon radius in pixels
  const gap = 34; // distance between room centers
  const here = positions[game.roomId];
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
    mapCtx.fillStyle = id === game.roomId ? "#2f6fd6" : "#a39883";
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

// ---- input ----

function runCommand(text: string): void {
  print([text], "you");
  print(game.handleCommand(text));
  draw();
}

function canvasPoint(e: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width; // the canvas may be shrunk to fit the screen
  return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
}

function hotspotUnderMouse(): Hotspot | undefined {
  if (!mouse) return undefined;
  return hotspots.find((h) => Math.hypot(h.x - mouse!.x, h.y - mouse!.y) <= h.r);
}

canvas.addEventListener("click", (e) => {
  mouse = canvasPoint(e);
  const hit = hotspotUnderMouse();
  if (hit) runCommand(hit.command);
});

canvas.addEventListener("mousemove", (e) => {
  mouse = canvasPoint(e);
  draw();
});

canvas.addEventListener("mouseleave", () => {
  mouse = null;
  draw();
});

input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = input.value;
  input.value = "";
  if (text.trim()) runCommand(text);
});

// ---- start ----

print(["Welcome to Big Dawg's Castle.", "Click a doorway to go through it or open its door, click things to look at them, or type commands below (try \"help\")."]);
print(game.look());
draw();
input.focus();
