// The rules: where the player is, and what happens when they act.
// Everything the player does, whether they click or type, ends up here.
// Later this file moves onto the server, and the screen will only draw what it says.

import { Direction, OPPOSITE, ROOMS, ROOM_SIZE, Room, STARTING_ROOM, exitTile, tileAt } from "./world";

export interface Position { x: number; y: number }

export interface PlayerState {
  roomId: string;
  pos: Position;
}

// Words and short forms players can type, MUD style.
const DIRECTION_WORDS: Record<string, Direction> = {
  n: "north", north: "north",
  ne: "northeast", northeast: "northeast",
  e: "east", east: "east",
  se: "southeast", southeast: "southeast",
  s: "south", south: "south",
  sw: "southwest", southwest: "southwest",
  w: "west", west: "west",
  nw: "northwest", northwest: "northwest",
  u: "up", up: "up",
  d: "down", down: "down",
};

const CENTER = Math.floor(ROOM_SIZE / 2);

export class Game {
  player: PlayerState;
  visited = new Set<string>();

  constructor() {
    this.player = { roomId: STARTING_ROOM, pos: { x: CENTER, y: CENTER } };
    this.visited.add(STARTING_ROOM);
  }

  get room(): Room {
    return ROOMS[this.player.roomId];
  }

  // Run one command and return the lines of text to show the player.
  handleCommand(input: string): string[] {
    const words = input.trim().toLowerCase().split(/\s+/);
    let verb = words[0] ?? "";
    if (verb === "go" && words[1]) verb = words[1];

    if (verb === "") return [];
    if (DIRECTION_WORDS[verb]) return this.move(DIRECTION_WORDS[verb]);
    if (verb === "look" || verb === "l") return this.look();
    if (verb === "help") {
      return ["Move with north, northeast, east, southeast, south, southwest, west, northwest, up, down (or n ne e se s sw w nw u d). Also: look, help."];
    }
    return [`You don't know how to "${input.trim()}".`];
  }

  look(): string[] {
    const room = this.room;
    const exits = Object.keys(room.exits).join(", ");
    return [room.name, room.description, `Exits: ${exits}.`];
  }

  move(dir: Direction): string[] {
    const targetId = this.room.exits[dir];
    if (!targetId) return ["You can't go that way."];

    const target = ROOMS[targetId];
    this.player.roomId = target.id;
    this.player.pos = arrivalSpot(target, OPPOSITE[dir]);
    this.visited.add(target.id);
    return [`You go ${dir}.`, ...this.look()];
  }

  // Clicking a tile. Floor: walk there. Exit: walk there and go through.
  // Anything else: describe it.
  // Returns the steps to animate, any text to show, and the exit to take at the end.
  clickTile(x: number, y: number): { path: Position[]; messages: string[]; exit?: Direction } {
    const tile = tileAt(this.room, x, y);
    if (tile.info.kind === "void") return { path: [], messages: [] };
    if (!tile.info.walkable) return { path: [], messages: [tile.info.description] };

    const path = findPath(this.room, this.player.pos, { x, y });
    if (!path) return { path: [], messages: ["You can't get there from here."] };
    return { path, messages: [], exit: tile.exit };
  }

  // Take one step along a path. The screen calls this once per animation step.
  step(pos: Position): void {
    this.player.pos = pos;
  }
}

// Where you appear when you come in through an exit: one step in from it,
// toward the middle of the room. Coming up or down, you stand on the stairs.
function arrivalSpot(room: Room, cameFrom: Direction): Position {
  const pos = exitTile(room, cameFrom)!;
  if (cameFrom === "up" || cameFrom === "down") return pos;
  return { x: pos.x + Math.sign(CENTER - pos.x), y: pos.y + Math.sign(CENTER - pos.y) };
}

// Breadth-first search: spread out from the start one tile at a time until
// we reach the goal, remembering how we got to each tile. It finds the
// shortest route around walls and tables. Diagonal steps are allowed,
// but not squeezing between two blocked corners.
function findPath(room: Room, from: Position, to: Position): Position[] | null {
  const key = (p: Position) => `${p.x},${p.y}`;
  const walkable = (x: number, y: number) => tileAt(room, x, y).info.walkable;
  const cameFrom = new Map<string, Position | null>([[key(from), null]]);
  const queue: Position[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === to.x && current.y === to.y) {
      const path: Position[] = [];
      for (let p: Position | null = current; p && key(p) !== key(from); p = cameFrom.get(key(p)) ?? null) {
        path.unshift(p);
      }
      return path;
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const next = { x: current.x + dx, y: current.y + dy };
        if (cameFrom.has(key(next)) || !walkable(next.x, next.y)) continue;
        if (dx !== 0 && dy !== 0 && (!walkable(current.x + dx, current.y) || !walkable(current.x, current.y + dy))) continue;
        cameFrom.set(key(next), current);
        queue.push(next);
      }
    }
  }
  return null;
}
