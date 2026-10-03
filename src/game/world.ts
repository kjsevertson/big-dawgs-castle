// The world: what rooms exist, what's in them, and how they connect.
// This file is pure data and types. It knows nothing about drawing or the mouse.

// Four walls and four corners, plus up and down.
export type Direction =
  | "north" | "northeast" | "east" | "southeast"
  | "south" | "southwest" | "west" | "northwest"
  | "up" | "down";

export const DIRECTIONS: Direction[] = [
  "north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest", "up", "down",
];

// How each direction changes a room's coordinates: x grows east, y grows north, z grows up.
export const DIRECTION_STEP: Record<Direction, { dx: number; dy: number; dz: number }> = {
  north: { dx: 0, dy: 1, dz: 0 },
  northeast: { dx: 1, dy: 1, dz: 0 },
  east: { dx: 1, dy: 0, dz: 0 },
  southeast: { dx: 1, dy: -1, dz: 0 },
  south: { dx: 0, dy: -1, dz: 0 },
  southwest: { dx: -1, dy: -1, dz: 0 },
  west: { dx: -1, dy: 0, dz: 0 },
  northwest: { dx: -1, dy: 1, dz: 0 },
  up: { dx: 0, dy: 0, dz: 1 },
  down: { dx: 0, dy: 0, dz: -1 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  north: "south", northeast: "southwest", east: "west", southeast: "northwest",
  south: "north", southwest: "northeast", west: "east", northwest: "southeast",
  up: "down", down: "up",
};

// ---- room qualities ----
// What each of these does to play is decided later. For now rooms just carry them.

export type Sector = "city" | "forest" | "swamp" | "mountain" | "hill" | "plains" | "freshwater" | "river" | "sea";
export type Climate = "temperate" | "arctic" | "tropical" | "desert";

// A door sits on an exit. The room holds its exits, and each exit can hold a door.
export interface Door {
  closed: boolean;
  locked?: boolean;  // can't be opened without its key
  secret?: boolean;  // hidden until someone searches for it
  trapped?: boolean; // springs something when opened (what it does comes later)
}

export interface Exit {
  to: string; // the room id this exit leads to
  door?: Door; // only a doorway (an exit through a wall) can hold a door
}

// ---- walls ----
// A room has eight wall pieces, one for each exit position: four walls and four corners.
// An exit through a wall is a doorway. An exit where there's no wall is open air,
// which joins rooms that are parts of one bigger space (say, a great hall drawn as six rooms).

export type Side = Exclude<Direction, "up" | "down">;
export const SIDES: Side[] = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

export type WallMaterial = "none" | "stone" | "brick" | "wood" | "rock" | "hedge" | "palisade";

export interface Wall {
  material: WallMaterial; // later: what skills can break through it
  height: number;         // in feet; later: what skills can climb over it
}

export const NO_WALL: Wall = { material: "none", height: 0 };

export function wallAt(room: Room, side: Side): Wall {
  return room.walls?.[side] ?? room.wall;
}

// An exit is open air when there's no wall where it is. Up and down never are.
export function isOpenAir(room: Room, dir: Direction): boolean {
  if (dir === "up" || dir === "down") return false;
  return wallAt(room, dir).material === "none";
}

// Something in a room you can interact with. You never walk over to it:
// being in the room is enough, just like a classic MUD.
export type ThingKind = "feature" | "item" | "creature";

export interface Thing {
  name: string;        // how it's listed, e.g. "an old well"
  keywords: string[];  // words a player can type to mean it, e.g. ["well"]
  kind: ThingKind;
  description: string; // shown when you look at it
}

export interface Room {
  id: string;
  // Where the room sits. Each plane is its own world with its own coordinates,
  // so two planes can both have a room at 0, 0, 0 without the map mixing them up.
  plane: string;
  x: number; // east is +x
  y: number; // north is +y
  z: number; // up is +z
  name: string;
  description: string;
  sector: Sector;
  climate: Climate;
  road?: boolean;   // a road runs through this room, whatever its sector
  indoor: boolean;  // indoor rooms don't feel weather, daylight or night
  light: number;    // 0 is perfect darkness, 100 is the brightest summer noon
  wall: Wall;                          // the wall on every side, unless overridden below
  walls?: Partial<Record<Side, Wall>>; // sides that differ from the usual wall
  exits: Partial<Record<Direction, Exit>>;
  contents: Thing[];
}

export const ROOMS: Record<string, Room> = {
  gatehouse: {
    id: "gatehouse",
    plane: "castle", x: 0, y: 0, z: 0,
    name: "The Gatehouse",
    description: "A cramped stone room under the castle wall. The courtyard lies to the north.",
    sector: "city", climate: "temperate", road: true, indoor: true, light: 35,
    wall: { material: "stone", height: 15 },
    exits: { north: { to: "courtyard", door: { closed: true } } },
    contents: [
      { name: "a portcullis winch", keywords: ["winch", "portcullis"], kind: "feature", description: "A big iron winch, rusted solid. Nobody has lowered the portcullis in years." },
      { name: "a guard's stool", keywords: ["stool"], kind: "item", description: "A three-legged stool, worn smooth by a lot of bored guards." },
    ],
  },
  courtyard: {
    id: "courtyard",
    plane: "castle", x: 0, y: 1, z: 0,
    name: "The Courtyard",
    description: "An open yard of stone and grass. Ways lead off in many directions.",
    sector: "city", climate: "temperate", road: true, indoor: false, light: 80,
    wall: { material: "stone", height: 20 },
    walls: { east: NO_WALL, southwest: NO_WALL },
    exits: {
      north: { to: "greatHall" },
      northeast: { to: "kitchen" },
      south: { to: "gatehouse", door: { closed: true } },
      east: { to: "courtyardEast" },
      west: { to: "towerBase" },
      southwest: { to: "garden" },
    },
    contents: [
      { name: "an old well", keywords: ["well"], kind: "feature", description: "An old stone well. You hear water far below." },
      { name: "a stray dog", keywords: ["dog"], kind: "creature", description: "A scruffy brown dog. It watches you, hoping for food." },
    ],
  },
  greatHall: {
    id: "greatHall",
    plane: "castle", x: 0, y: 2, z: 0,
    name: "The Great Hall",
    description: "A long hall with a feasting table. The kitchen is to the east.",
    sector: "city", climate: "temperate", indoor: true, light: 60,
    wall: { material: "stone", height: 12 },
    exits: {
      south: { to: "courtyard" },
      east: { to: "kitchen", door: { closed: true } },
      west: { to: "passage", door: { closed: true, secret: true } },
    },
    contents: [
      { name: "a feasting table", keywords: ["table"], kind: "feature", description: "A long, heavy oak table, scarred by knives." },
      { name: "a cold hearth", keywords: ["hearth", "fireplace"], kind: "feature", description: "A great stone fireplace. The ashes are long cold. One stone in the west wall beside it looks newer than the rest." },
      { name: "a tattered banner", keywords: ["banner"], kind: "feature", description: "A faded banner showing a large black dog on a red field." },
    ],
  },
  courtyardEast: {
    id: "courtyardEast",
    plane: "castle", x: 1, y: 1, z: 0,
    name: "The Courtyard, East Side",
    description: "The east end of the courtyard, under the kitchen windows. The yard opens up to the west.",
    sector: "city", climate: "temperate", road: true, indoor: false, light: 80,
    wall: { material: "stone", height: 20 },
    walls: { west: NO_WALL },
    exits: {
      west: { to: "courtyard" },
      north: { to: "kitchen" },
    },
    contents: [
      { name: "a hay cart", keywords: ["cart", "hay"], kind: "feature", description: "A cart half full of damp hay, one wheel missing." },
    ],
  },
  kitchen: {
    id: "kitchen",
    plane: "castle", x: 1, y: 2, z: 0,
    name: "The Kitchen",
    description: "Smoke-stained walls and a long work table. It smells of old bread.",
    sector: "city", climate: "temperate", indoor: true, light: 50,
    wall: { material: "stone", height: 10 },
    exits: {
      west: { to: "greatHall", door: { closed: true } },
      southwest: { to: "courtyard" },
      south: { to: "courtyardEast" },
      north: { to: "pantry", door: { closed: true, locked: true, trapped: true } },
    },
    contents: [
      { name: "a bread oven", keywords: ["oven"], kind: "feature", description: "A domed brick oven, still faintly warm." },
      { name: "a kitchen knife", keywords: ["knife"], kind: "item", description: "A short, sharp kitchen knife." },
      { name: "a fat rat", keywords: ["rat"], kind: "creature", description: "A rat the size of a small cat, chewing on a crust." },
    ],
  },
  pantry: {
    id: "pantry",
    plane: "castle", x: 1, y: 3, z: 0,
    name: "The Pantry",
    description: "Shelves of jars and sacks. Somebody keeps this locked for a reason.",
    sector: "city", climate: "temperate", indoor: true, light: 15,
    wall: { material: "stone", height: 10 },
    exits: { south: { to: "kitchen", door: { closed: true, locked: true, trapped: true } } },
    contents: [
      { name: "sacks of flour", keywords: ["sacks", "flour"], kind: "item", description: "Heavy sacks of flour, stacked to the ceiling." },
    ],
  },
  garden: {
    id: "garden",
    plane: "castle", x: -1, y: 0, z: 0,
    name: "The Herb Garden",
    description: "Overgrown beds of herbs inside a low wall. The tower rises to the north.",
    sector: "city", climate: "temperate", indoor: false, light: 85,
    wall: { material: "stone", height: 4 },
    walls: { northeast: NO_WALL },
    exits: { northeast: { to: "courtyard" }, north: { to: "towerBase" } },
    contents: [
      { name: "a patch of mint", keywords: ["mint", "patch"], kind: "feature", description: "Mint has taken over half the garden. It smells wonderful." },
      { name: "a stone bench", keywords: ["bench"], kind: "feature", description: "A mossy stone bench in the sun." },
    ],
  },
  towerBase: {
    id: "towerBase",
    plane: "castle", x: -1, y: 1, z: 0,
    name: "Base of the Tower",
    description: "A tall, round room with stairs climbing up into darkness.",
    sector: "city", climate: "temperate", indoor: true, light: 20,
    wall: { material: "stone", height: 12 },
    exits: {
      east: { to: "courtyard" },
      south: { to: "garden" },
      north: { to: "passage" },
      up: { to: "towerTop" },
    },
    contents: [
      { name: "a cobwebbed barrel", keywords: ["barrel"], kind: "item", description: "An old barrel wrapped in cobwebs. Something sloshes inside." },
    ],
  },
  towerTop: {
    id: "towerTop",
    plane: "castle", x: -1, y: 1, z: 1,
    name: "Top of the Tower",
    description: "Wind whips across the battlements. You can see the whole castle from here.",
    sector: "city", climate: "temperate", indoor: false, light: 90,
    wall: { material: "stone", height: 3 },
    exits: { down: { to: "towerBase" } },
    contents: [
      { name: "a rusty spyglass", keywords: ["spyglass", "glass"], kind: "item", description: "A brass spyglass, green with age. The lens is cracked." },
    ],
  },
  passage: {
    id: "passage",
    plane: "castle", x: -1, y: 2, z: 0,
    name: "A Secret Passage",
    description: "A narrow, dusty passage hidden inside the castle wall.",
    sector: "city", climate: "temperate", indoor: true, light: 5,
    wall: { material: "stone", height: 8 },
    exits: {
      east: { to: "greatHall", door: { closed: true, secret: true } },
      south: { to: "towerBase" },
    },
    contents: [
      { name: "an empty torch bracket", keywords: ["bracket", "torch"], kind: "feature", description: "An iron torch bracket. Whoever used this passage took the torch with them." },
    ],
  },
};

export const STARTING_ROOM = "gatehouse";

// A check for world builders: every exit should lead to a room on the same plane
// that sits one step away in that direction, with an exit leading back.
// Returns a list of problems (empty when the world is consistent).
export function checkWorld(): string[] {
  const problems: string[] = [];
  for (const room of Object.values(ROOMS)) {
    for (const [dir, exit] of Object.entries(room.exits) as [Direction, Exit][]) {
      const target = ROOMS[exit.to];
      if (!target) { problems.push(`${room.id} ${dir} leads to missing room "${exit.to}"`); continue; }
      const step = DIRECTION_STEP[dir];
      if (target.plane !== room.plane) problems.push(`${room.id} ${dir} leads to another plane`);
      else if (target.x !== room.x + step.dx || target.y !== room.y + step.dy || target.z !== room.z + step.dz) {
        problems.push(`${room.id} ${dir} leads to ${target.id}, but its coordinates don't line up`);
      }
      const back = target.exits[OPPOSITE[dir]];
      if (back?.to !== room.id) problems.push(`${target.id} has no ${OPPOSITE[dir]} exit back to ${room.id}`);
      else if (isOpenAir(room, dir) !== isOpenAir(target, OPPOSITE[dir])) problems.push(`${room.id} ${dir} has a wall on one side but not the other`);
      if (isOpenAir(room, dir) && exit.door) problems.push(`${room.id} ${dir} has no wall, so it can't have a door`);
    }
  }
  return problems;
}
