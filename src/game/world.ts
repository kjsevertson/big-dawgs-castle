// The world: what rooms exist, what they look like, and how they connect.
// This file is pure data and types. It knows nothing about drawing or the mouse.

// Eight sides of the octagon, plus up and down.
export type Direction =
  | "north" | "northeast" | "east" | "southeast"
  | "south" | "southwest" | "west" | "northwest"
  | "up" | "down";

export const DIRECTIONS: Direction[] = [
  "north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest", "up", "down",
];

// How each direction moves you on the world map (x grows east, y grows south).
// Up and down stay in place on the map but change floor.
export const DIRECTION_STEP: Record<Direction, { dx: number; dy: number; dz: number }> = {
  north: { dx: 0, dy: -1, dz: 0 },
  northeast: { dx: 1, dy: -1, dz: 0 },
  east: { dx: 1, dy: 0, dz: 0 },
  southeast: { dx: 1, dy: 1, dz: 0 },
  south: { dx: 0, dy: 1, dz: 0 },
  southwest: { dx: -1, dy: 1, dz: 0 },
  west: { dx: -1, dy: 0, dz: 0 },
  northwest: { dx: -1, dy: -1, dz: 0 },
  up: { dx: 0, dy: 0, dz: 1 },
  down: { dx: 0, dy: 0, dz: -1 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  north: "south", northeast: "southwest", east: "west", southeast: "northwest",
  south: "north", southwest: "northeast", west: "east", northwest: "southeast",
  up: "down", down: "up",
};

// Every kind of tile a room can be built from.
export type TileKind = "void" | "wall" | "floor" | "grass" | "table" | "well" | "stairsUp" | "stairsDown" | "exit";

export interface TileInfo {
  kind: TileKind;
  walkable: boolean;
  description: string; // shown when the player clicks this tile
}

// Each tile kind gets one character, so room layouts can be typed as little pictures.
export const TILES: Record<string, TileInfo> = {
  " ": { kind: "void", walkable: false, description: "" },
  "#": { kind: "wall", walkable: false, description: "Cold grey stone, fitted tight." },
  ".": { kind: "floor", walkable: true, description: "Worn flagstones." },
  ",": { kind: "grass", walkable: true, description: "Patchy grass pushing up between the stones." },
  "T": { kind: "table", walkable: false, description: "A long, heavy oak table, scarred by knives." },
  "o": { kind: "well", walkable: false, description: "An old well. You hear water far below." },
  "<": { kind: "stairsUp", walkable: true, description: "Stairs leading up." },
  ">": { kind: "stairsDown", walkable: true, description: "Stairs leading down." },
};

// Every room is an octagon drawn on an 11 x 11 grid of tiles.
export const ROOM_SIZE = 11;
const CORNER_CUT = 4; // how many tiles are cut off each corner to make the octagon
const LAST = ROOM_SIZE - 1;
const MID = Math.floor(ROOM_SIZE / 2);

export interface Room {
  id: string;
  name: string;
  description: string;
  // ROOM_SIZE strings of ROOM_SIZE characters, using the keys of TILES.
  // Only the inside matters: the octagon's walls are added automatically.
  layout: string[];
  // Where each exit leads, by room id.
  exits: Partial<Record<Direction, string>>;
}

// Is (x, y) inside the octagon at all?
function insideOctagon(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x > LAST || y > LAST) return false;
  return x + y >= CORNER_CUT
    && (LAST - x) + y >= CORNER_CUT
    && x + (LAST - y) >= CORNER_CUT
    && (LAST - x) + (LAST - y) >= CORNER_CUT;
}

// The outer ring of the octagon is wall: inside tiles that touch the outside.
function onOctagonEdge(x: number, y: number): boolean {
  if (!insideOctagon(x, y)) return false;
  return !insideOctagon(x + 1, y) || !insideOctagon(x - 1, y) || !insideOctagon(x, y + 1) || !insideOctagon(x, y - 1);
}

// Each side of the octagon has one spot where a doorway can be cut.
// Up and down exits are the stairs tile inside the room.
export function exitTile(room: Room, dir: Direction): { x: number; y: number } | null {
  const d = CORNER_CUT / 2; // middle of a diagonal side
  switch (dir) {
    case "north": return { x: MID, y: 0 };
    case "south": return { x: MID, y: LAST };
    case "west": return { x: 0, y: MID };
    case "east": return { x: LAST, y: MID };
    case "northwest": return { x: d, y: d };
    case "northeast": return { x: LAST - d, y: d };
    case "southwest": return { x: d, y: LAST - d };
    case "southeast": return { x: LAST - d, y: LAST - d };
    case "up": return findTile(room, "<");
    case "down": return findTile(room, ">");
  }
}

function findTile(room: Room, char: string): { x: number; y: number } | null {
  for (let y = 0; y < room.layout.length; y++) {
    const x = room.layout[y].indexOf(char);
    if (x !== -1) return { x, y };
  }
  return null;
}

// What is at (x, y)? The octagon shape comes first, then exits, then the layout.
export function tileAt(room: Room, x: number, y: number): { info: TileInfo; exit?: Direction } {
  if (!insideOctagon(x, y)) return { info: TILES[" "] };

  for (const dir of Object.keys(room.exits) as Direction[]) {
    const pos = exitTile(room, dir);
    if (pos && pos.x === x && pos.y === y) {
      if (dir === "up" || dir === "down") return { info: TILES[room.layout[y][x]], exit: dir };
      return { info: { kind: "exit", walkable: true, description: `An opening leading ${dir}.` }, exit: dir };
    }
  }

  if (onOctagonEdge(x, y)) return { info: TILES["#"] };
  return { info: TILES[room.layout[y][x]] ?? TILES["."] };
}

export const ROOMS: Record<string, Room> = {
  gatehouse: {
    id: "gatehouse",
    name: "The Gatehouse",
    description: "A cramped stone room under the castle wall. The courtyard opens to the north.",
    layout: [
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
    ],
    exits: { north: "courtyard" },
  },
  courtyard: {
    id: "courtyard",
    name: "The Courtyard",
    description: "An open yard of stone and grass with a well in the middle. Ways lead off in many directions.",
    layout: [
      "...........",
      "...,,,,,...",
      "..,,...,,..",
      ".,,.....,,.",
      ".,.......,.",
      ".,...o...,.",
      ".,.......,.",
      ".,,.....,,.",
      "..,,...,,..",
      "...,,,,,...",
      "...........",
    ],
    exits: { north: "greatHall", northeast: "kitchen", south: "gatehouse", west: "towerBase", southwest: "garden" },
  },
  greatHall: {
    id: "greatHall",
    name: "The Great Hall",
    description: "A long hall with feasting tables. The kitchen is to the east.",
    layout: [
      "...........",
      "...........",
      "...........",
      "...TTTTT...",
      "...........",
      "...........",
      "...........",
      "...TTTTT...",
      "...........",
      "...........",
      "...........",
    ],
    exits: { south: "courtyard", east: "kitchen" },
  },
  kitchen: {
    id: "kitchen",
    name: "The Kitchen",
    description: "Smoke-stained walls and a long work table. It smells of old bread.",
    layout: [
      "...........",
      "...........",
      "...........",
      "...........",
      "....TTT....",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
    ],
    exits: { west: "greatHall", southwest: "courtyard" },
  },
  garden: {
    id: "garden",
    name: "The Herb Garden",
    description: "Overgrown beds of herbs inside a low wall. The tower rises to the north.",
    layout: [
      "...........",
      "...........",
      "..,,,,,,,..",
      ".,,,,,,,,,.",
      ".,,,...,,,.",
      ".,,,...,,,.",
      ".,,,...,,,.",
      ".,,,,,,,,,.",
      "..,,,,,,,..",
      "...........",
      "...........",
    ],
    exits: { northeast: "courtyard", north: "towerBase" },
  },
  towerBase: {
    id: "towerBase",
    name: "Base of the Tower",
    description: "A tall room with stairs climbing up into darkness.",
    layout: [
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      ".....<.....",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
    ],
    exits: { east: "courtyard", south: "garden", up: "towerTop" },
  },
  towerTop: {
    id: "towerTop",
    name: "Top of the Tower",
    description: "Wind whips across the battlements. You can see the whole castle from here.",
    layout: [
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      ".....>.....",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
    ],
    exits: { down: "towerBase" },
  },
};

export const STARTING_ROOM = "gatehouse";

// Lay the rooms out on a world map by walking their exits from the start.
// Returns each room's x, y and floor (z), used to draw the map of explored rooms.
export function mapPositions(): Record<string, { x: number; y: number; z: number }> {
  const positions: Record<string, { x: number; y: number; z: number }> = { [STARTING_ROOM]: { x: 0, y: 0, z: 0 } };
  const queue = [STARTING_ROOM];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const here = positions[id];
    for (const [dir, targetId] of Object.entries(ROOMS[id].exits) as [Direction, string][]) {
      if (positions[targetId]) continue;
      const step = DIRECTION_STEP[dir];
      positions[targetId] = { x: here.x + step.dx, y: here.y + step.dy, z: here.z + step.dz };
      queue.push(targetId);
    }
  }
  return positions;
}
